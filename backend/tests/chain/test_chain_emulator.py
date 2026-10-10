import os
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.services.chain import chain_service
from app.services.chain_hooks import enqueue_anchor, normalize_sha256
from app.services.firestore_db import get_firestore_client, set_firestore_client
from app.workers.anchor_worker import AnchorWorker
from google.cloud.firestore import FieldFilter


# Only run these tests when FIRESTORE_EMULATOR_HOST is set
pytestmark = pytest.mark.skipif(
    not os.environ.get("FIRESTORE_EMULATOR_HOST"),
    reason="Requires active FIRESTORE_EMULATOR_HOST environment"
)


@pytest.fixture(autouse=True)
def real_emulator_client():
    """Bypasses MockFirestoreClient and connects directly to the active Firestore emulator."""
    set_firestore_client(None)
    client = get_firestore_client()
    yield client
    set_firestore_client(None)


@pytest.fixture
def client():
    return TestClient(app)


def test_emulator_enqueue_anchor_persists(real_emulator_client):
    """Verifies that enqueue_anchor creates a persistent pending document in real Firestore."""
    sample_hash = "e" * 64
    real_emulator_client.collection("chain_anchors").document(sample_hash).delete()

    doc_id = enqueue_anchor(
        entity="photo",
        entity_id="999",
        sha256=sample_hash,
        project_id="1"
    )
    assert doc_id == sample_hash

    # Read back from real Firestore emulator
    doc = real_emulator_client.collection("chain_anchors").document(sample_hash).get()
    assert doc.exists
    data = doc.to_dict()
    assert data["sha256"] == sample_hash
    assert data["status"] == "pending"
    assert data["entity"] == "photo"
    assert data["kind"] == 1
    assert data["attempts"] == 0


def test_emulator_duplicate_hashes_idempotent(real_emulator_client):
    """Verifies that duplicate enqueue calls do not create duplicate documents."""
    sample_hash = "d" * 64
    real_emulator_client.collection("chain_anchors").document(sample_hash).delete()

    # First enqueue
    doc_id_1 = enqueue_anchor(entity="challan", entity_id="101", sha256=sample_hash, project_id="2")
    assert doc_id_1 == sample_hash

    # Duplicate enqueue with same hash
    doc_id_2 = enqueue_anchor(entity="challan", entity_id="101", sha256=sample_hash, project_id="2")
    assert doc_id_2 == sample_hash

    doc = real_emulator_client.collection("chain_anchors").document(sample_hash).get()
    assert doc.exists


def test_emulator_worker_claims_and_fake_mode_anchors(real_emulator_client):
    """Verifies that the worker claims a due record safely and fake mode marks it as simulated."""
    sample_hash = "c" * 64
    real_emulator_client.collection("chain_anchors").document(sample_hash).delete()

    enqueue_anchor(entity="photo", entity_id="500", sha256=sample_hash, project_id="1")

    worker = AnchorWorker()
    worker.process_batch()

    # Read back document
    doc = real_emulator_client.collection("chain_anchors").document(sample_hash).get()
    assert doc.exists
    data = doc.to_dict()
    assert data["status"] == "anchored"
    assert data["simulated"] is True
    assert data["tx_hash"] is not None
    assert data["tx_hash"].startswith("0xFAKE")
    assert data["block_number"] is not None
    assert data["anchored_at"] is not None
    assert data["claimed_by"] is None
    assert data["lease_until"] is None


def test_emulator_status_counts(real_emulator_client):
    """Verifies that count aggregations can be accurately read from Firestore."""
    for s in ["pending", "sent", "anchored", "failed"]:
        cnt = len(list(real_emulator_client.collection("chain_anchors").where(filter=FieldFilter("status", "==", s)).stream()))
        assert isinstance(cnt, int)


def test_emulator_public_verification_truthfulness(client, real_emulator_client):
    """Public verification does not claim authenticity unless record is anchored."""
    unanchored_hash = "b" * 64
    real_emulator_client.collection("chain_anchors").document(unanchored_hash).delete()

    # 1. Non-existent hash
    resp = client.get(f"/chain/verify/{unanchored_hash}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "not_found"

    # 2. Pending hash
    enqueue_anchor(entity="photo", entity_id="888", sha256=unanchored_hash, project_id="1")
    resp_pending = client.get(f"/chain/verify/{unanchored_hash}")
    assert resp_pending.status_code == 200
    assert resp_pending.json()["status"] == "not_found"

    # 3. After worker anchors it
    worker = AnchorWorker()
    worker.process_batch()
    resp_anchored = client.get(f"/chain/verify/{unanchored_hash}")
    assert resp_anchored.status_code == 200
    data = resp_anchored.json()
    assert data["status"] == "authentic"
    assert data["sha256"] == unanchored_hash
    assert data["simulated"] is True
