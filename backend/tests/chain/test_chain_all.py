import io
import threading
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.services.chain import chain_service
from app.services.chain_hooks import (
    canonical_summary_hash,
    enqueue_anchor,
    normalize_sha256,
)
from app.services.firestore_db import set_firestore_client
from app.workers.anchor_worker import AnchorWorker
from tests.chain.mock_firestore import MockFirestoreClient


@pytest.fixture(autouse=True)
def setup_mock_firestore():
    """Inject fresh MockFirestoreClient before each test."""
    mock_client = MockFirestoreClient()
    set_firestore_client(mock_client)
    yield mock_client
    set_firestore_client(None)


def test_normalize_sha256():
    h = "a" * 64
    assert normalize_sha256(h) == h
    assert normalize_sha256("0x" + ("B" * 64)) == "b" * 64

    with pytest.raises(ValueError):
        normalize_sha256("short")
    with pytest.raises(ValueError):
        normalize_sha256("z" * 64)
    with pytest.raises(ValueError):
        normalize_sha256(12345)


def test_canonical_summary_hash():
    obj1 = {
        "stage_id": 10,
        "project_id": 2,
        "stage_name": "Foundation Slab Pour",
        "approved_by": 5,
        "approved_at": "2026-10-10T00:00:00Z",
        "checks": [{"name": "rebar_spacing", "passed": True}],
        "evidence_hashes": ["0xBBB" + "0"*61, "0xAAA" + "0"*61],
    }
    obj2 = {
        "evidence_hashes": ["0xAAA" + "0"*61, "0xBBB" + "0"*61],
        "checks": [{"name": "rebar_spacing", "passed": True}],
        "approved_at": "2026-10-10T00:00:00Z",
        "approved_by": 5,
        "stage_name": "Foundation Slab Pour",
        "project_id": 2,
        "stage_id": 10,
    }

    h1 = canonical_summary_hash(obj1)
    h2 = canonical_summary_hash(obj2)
    assert h1 == h2
    assert len(h1) == 64

    # Altering a single character alters the output hash
    obj3 = dict(obj1)
    obj3["stage_name"] = "Foundation Slab Pour 2"
    assert canonical_summary_hash(obj3) != h1


def test_enqueue_anchor_idempotency_and_safety(setup_mock_firestore):
    client = setup_mock_firestore
    sample_hash = "1" * 64

    # 1. Enqueue returns document ID (sha256)
    doc_id = enqueue_anchor(
        entity="photo",
        entity_id="101",
        sha256=sample_hash,
        project_id="1",
    )
    assert doc_id == sample_hash

    # Verify Firestore document
    doc = client.collection("chain_anchors").document(sample_hash).get()
    assert doc.exists
    data = doc.to_dict()
    assert data["entity"] == "photo"
    assert data["kind"] == 1
    assert data["status"] == "pending"
    assert data["attempts"] == 0

    # 2. Duplicate enqueue creates exactly ONE document
    doc_id_2 = enqueue_anchor(
        entity="photo",
        entity_id="101",
        sha256=sample_hash,
        project_id="1",
    )
    assert doc_id_2 == sample_hash
    assert len(client.collection("chain_anchors").docs) == 1

    # 3. Invalid entity returns -1 safely (never raises)
    bad_entity = enqueue_anchor(
        entity="invalid_entity",
        entity_id="102",
        sha256="2" * 64,
    )
    assert bad_entity == -1

    # 4. Invalid hash returns -1 safely (never raises)
    bad_hash = enqueue_anchor(
        entity="challan",
        entity_id="103",
        sha256="not-valid-hash",
    )
    assert bad_hash == -1


def test_two_workers_concurrent_claim_exactly_one_winner(setup_mock_firestore):
    """Test required by Patch item 12: two workers claiming same row results in exactly one winner."""
    client = setup_mock_firestore
    test_hash = "3" * 64

    enqueue_anchor(
        entity="challan",
        entity_id="202",
        sha256=test_hash,
        project_id="1",
    )

    doc_ref = client.collection("chain_anchors").document(test_hash)
    now = datetime.now(timezone.utc)

    winners = []
    lock = threading.Lock()

    def worker_claim_attempt(worker_id: str):
        # Transactional claim logic identical to AnchorWorker
        def _try_claim():
            tx = client.transaction()
            snap = doc_ref.get(transaction=tx)
            if not snap.exists:
                return False
            data = snap.to_dict() or {}
            if data.get("status") != "pending":
                return False
            attempts = int(data.get("attempts", 0)) + 1
            lease = now + timedelta(minutes=5)
            tx.update(doc_ref, {
                "status": "sent",
                "claimed_by": worker_id,
                "lease_until": lease,
                "attempts": attempts,
            })
            tx.commit()
            return True

        try:
            if _try_claim():
                with lock:
                    winners.append(worker_id)
        except Exception:
            # Transaction conflict in losing thread
            pass

    t1 = threading.Thread(target=worker_claim_attempt, args=("worker-A",))
    t2 = threading.Thread(target=worker_claim_attempt, args=("worker-B",))

    t1.start()
    t2.start()
    t1.join()
    t2.join()

    # Exactly one winner must claim the row!
    assert len(winners) == 1
    final_doc = doc_ref.get().to_dict()
    assert final_doc["status"] == "sent"
    assert final_doc["claimed_by"] == winners[0]
    assert final_doc["attempts"] == 1


def test_anchor_worker_process_batch_and_fake_mode(setup_mock_firestore):
    client = setup_mock_firestore
    test_hash = "4" * 64

    enqueue_anchor(
        entity="certificate",
        entity_id="303",
        sha256=test_hash,
        project_id="1",
    )

    worker = AnchorWorker()
    worker.process_batch()

    doc = client.collection("chain_anchors").document(test_hash).get()
    data = doc.to_dict()
    assert data["status"] == "anchored"
    assert data["tx_hash"].startswith("0xFAKE")
    assert data["simulated"] is True
    assert data["block_number"] > 0
    assert data["anchored_at"] is not None

    # Check fake ledger verification
    t_val, k_val = chain_service.check_hash(test_hash, client)
    assert t_val > 0
    assert k_val == 3


def test_anchor_worker_recovery_of_expired_lease(setup_mock_firestore):
    client = setup_mock_firestore
    test_hash = "5" * 64

    doc_ref = client.collection("chain_anchors").document(test_hash)
    past_time = datetime.now(timezone.utc) - timedelta(minutes=10)
    doc_ref.set({
        "entity": "photo",
        "entity_id": "404",
        "sha256": test_hash,
        "kind": 1,
        "status": "sent",
        "claimed_by": "dead-worker",
        "lease_until": past_time,
        "attempts": 1,
        "next_attempt_at": past_time,
    })

    worker = AnchorWorker()
    worker.recover_expired_leases()

    # Since test_hash was not anchored on-chain, it should be reset to pending
    recovered_data = doc_ref.get().to_dict()
    assert recovered_data["status"] == "pending"
    assert recovered_data["claimed_by"] is None
    assert recovered_data["lease_until"] is None


def test_api_public_verify_endpoints(setup_mock_firestore):
    client = setup_mock_firestore
    test_client = TestClient(app)

    # 1. Unknown hash returns not_found
    res = test_client.get(f"/chain/verify/{'0' * 64}")
    assert res.status_code == 200
    assert res.json()["status"] == "not_found"

    # 2. Anchored hash returns authentic
    known_hash = "6" * 64
    enqueue_anchor(
        entity="photo",
        entity_id="505",
        sha256=known_hash,
        project_id="1",
    )
    worker = AnchorWorker()
    worker.process_batch()

    res2 = test_client.get(f"/chain/verify/{known_hash}")
    assert res2.status_code == 200
    body = res2.json()
    assert body["status"] == "authentic"
    assert body["sha256"] == known_hash
    assert body["kind"] == "photo"
    assert body["simulated"] is True
    assert body["tx_hash"].startswith("0xFAKE")

    # 3. File upload verify
    file_bytes = b"CONSTRA test document content for verification"
    import hashlib
    file_hash = hashlib.sha256(file_bytes).hexdigest()

    enqueue_anchor(
        entity="challan",
        entity_id="606",
        sha256=file_hash,
        project_id="1",
    )
    worker.process_batch()

    upload_res = test_client.post(
        "/chain/verify",
        files={"file": ("challan.pdf", io.BytesIO(file_bytes), "application/pdf")}
    )
    assert upload_res.status_code == 200
    assert upload_res.json()["status"] == "authentic"
    assert upload_res.json()["sha256"] == file_hash
    assert upload_res.json()["kind"] == "challan"

    # 4. Tamper test: modify one byte
    tampered_bytes = bytearray(file_bytes)
    tampered_bytes[0] ^= 0x01
    tamper_res = test_client.post(
        "/chain/verify",
        files={"file": ("challan.pdf", io.BytesIO(tampered_bytes), "application/pdf")}
    )
    assert tamper_res.status_code == 200
    assert tamper_res.json()["status"] == "not_found"


def test_api_status_and_retry_permissions(setup_mock_firestore):
    client = setup_mock_firestore
    test_client = TestClient(app)

    # Status without auth returns 401 or 422
    status_no_auth = test_client.get("/chain/status")
    assert status_no_auth.status_code in (401, 422)

    # Status with supervisor auth (not auditor) returns 403
    status_supervisor = test_client.get(
        "/chain/status",
        headers={"Authorization": "Bearer demo-supervisor"}
    )
    assert status_supervisor.status_code == 403

    # Status with auditor auth returns 200
    status_auditor = test_client.get(
        "/chain/status",
        headers={"Authorization": "Bearer demo-auditor"}
    )
    assert status_auditor.status_code == 200
    status_data = status_auditor.json()
    assert "counts" in status_data
    assert "mode" in status_data

    # Retry failed row
    failed_hash = "7" * 64
    doc_ref = client.collection("chain_anchors").document(failed_hash)
    doc_ref.set({
        "status": "failed",
        "sha256": failed_hash,
        "attempts": 5,
        "last_error": "Out of gas",
    })

    retry_res = test_client.post(
        f"/chain/anchors/{failed_hash}/retry",
        headers={"Authorization": "Bearer demo-auditor"}
    )
    assert retry_res.status_code == 200
    assert retry_res.json()["success"] is True

    updated_doc = doc_ref.get().to_dict()
    assert updated_doc["status"] == "pending"
    assert updated_doc["attempts"] == 0
    assert updated_doc["last_error"] is None


def test_real_mode_chain_id_mismatch_raises_before_signing():
    """Validates that real mode strictly checks connected RPC chain ID against configured CHAIN_ID before signing."""
    mock_w3 = MagicMock()
    mock_w3.is_connected.return_value = True
    mock_w3.eth.chain_id = 1  # RPC reports Ethereum Mainnet (chain ID 1)

    with patch.object(settings, "CHAIN_MODE", "real"), \
         patch.object(settings, "RPC_URL", "https://mock-rpc-provider.internal"), \
         patch.object(settings, "CHAIN_ID", 11155111), \
         patch.object(settings, "CONTRACT_ADDRESS", "0x1111111111111111111111111111111111111111"), \
         patch.object(settings, "ANCHOR_PRIVATE_KEY", "0x" + "a" * 64):

        # Reset cached Web3 instance
        chain_service._w3 = None
        chain_service._contract = None
        chain_service._account = None

        with patch("web3.Web3", return_value=mock_w3):
            # get_client should fail fast with chain ID mismatch
            with pytest.raises(ValueError, match="Connected RPC chain ID \\(1\\) does not match configured CHAIN_ID \\(11155111\\)"):
                chain_service.get_client()

            # send_batch should also fail fast before signing
            with pytest.raises(ValueError, match="Connected RPC chain ID \\(1\\) does not match configured CHAIN_ID \\(11155111\\)"):
                chain_service.send_batch(["a" * 64], [1])

        # Reset cached Web3 instance
        chain_service._w3 = None
        chain_service._contract = None
        chain_service._account = None

