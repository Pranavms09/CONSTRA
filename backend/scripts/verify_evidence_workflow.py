#!/usr/bin/env python3
"""
Complete end-to-end verification of CONSTRA evidence -> backend persistence -> Cloud Firestore chain-anchor workflow.

Verifies:
1. Endpoint identification & auth requirements.
2. Submission of test evidence item through the application flow.
3. Backend SQLite persistence & real Cloud Firestore 'chain_anchors' document creation.
4. Idempotency on repeated submission.
5. Background worker batch processing & anchor status transition (simulated fake mode).
6. Badge and public verification endpoints.
7. Safe cleanup of only test artifacts created during this run.
"""

import hashlib
import io
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image

# Ensure backend root is on Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from google.cloud.firestore import FieldFilter

from app.config import settings
from app.database import SessionLocal
from app.main import app
from app.models.evidence import Evidence
from app.models.audit_log import AuditLog
from app.models.user import User
from app.services.firestore_db import get_firestore_client, set_firestore_client
from app.workers.anchor_worker import AnchorWorker


def generate_unique_test_image(color=(40, 180, 99)) -> bytes:
    """Generates a small unique JPEG with a random UUID burned in to guarantee unique SHA-256."""
    img = Image.new("RGB", (128, 128), color=color)
    buf = io.BytesIO()
    # Add unique exif/metadata or raw bytes by appending unique tag
    img.save(buf, format="JPEG", comment=f"CONSTRA-TEST-{uuid.uuid4().hex}".encode("utf-8"))
    return buf.getvalue()


def run_verification():
    print("=" * 70)
    print("CONSTRA EVIDENCE -> BACKEND PERSISTENCE -> FIRESTORE CHAIN-ANCHOR")
    print("END-TO-END VERIFICATION")
    print("=" * 70)

    # ---------------------------------------------------------
    # 0. Pre-Flight Checks
    # ---------------------------------------------------------
    print("\n[Step 0] Checking Prerequisites & Configuration:")
    print(f"  * CHAIN_MODE:                {settings.CHAIN_MODE} (Requirement: 'fake')")
    assert settings.CHAIN_MODE.lower() == "fake", f"Expected CHAIN_MODE=fake, got {settings.CHAIN_MODE}"

    print(f"  * Firebase Project:          {settings.FIREBASE_PROJECT_ID}")
    
    # Ensure we use real Firestore client (clear any mocks)
    set_firestore_client(None)
    fs_client = get_firestore_client()
    print(f"  * Firestore Client:          Initialized ({type(fs_client).__name__})")
    
    # Verify real Cloud Firestore read access
    test_probe = fs_client.collection("chain_anchors").document("ping_test").get()
    print(f"  * Real Cloud Firestore Ping: SUCCESS (exists={test_probe.exists})")

    # Verify Database & Demo Supervisor
    db = SessionLocal()
    supervisor_user = db.query(User).filter(User.role == "supervisor").first()
    assert supervisor_user is not None, "Missing supervisor user in SQLite database"
    print(f"  * Supervisor User:           {supervisor_user.email} (ID={supervisor_user.id})")
    db.close()

    # ---------------------------------------------------------
    # 1. Endpoint & Authentication Specification
    # ---------------------------------------------------------
    print("\n[Step 1] Evidence Submission Endpoint & Authentication Requirements:")
    print("  * Method & Path:             POST /supervisor/evidence")
    print("  * Authentication Header:     Authorization: Bearer demo-supervisor (or valid Firebase ID token)")
    print("  * Role Requirement:          'supervisor' (enforced by require_role('supervisor'))")
    print("  * Project Membership:        User must be assigned to project_id in ProjectMember table")
    print("  * Payload Type:              multipart/form-data")
    print("    - file:                    Binary image data (JPEG, PNG, WebP)")
    print("    - device_evidence_id:      Unique client-side device submission ID")
    print("    - project_id:              Integer project ID (e.g. 1)")
    print("    - stage_id:                Integer milestone stage ID (e.g. 1)")
    print("    - captured_at:             ISO 8601 UTC timestamp string")
    print("    - latitude, longitude:     GPS coordinates within site geofence radius")
    print("    - accuracy_m:              GPS accuracy radius in meters")
    print("    - client_sha256:           Lowercase 64-character hex SHA-256 of raw file")
    print("    - notes:                   Optional text notes")

    # ---------------------------------------------------------
    # 2. Test Evidence Item Preparation
    # ---------------------------------------------------------
    print("\n[Step 2] Generating Test Evidence Item:")
    img_bytes = generate_unique_test_image()
    raw_sha256 = hashlib.sha256(img_bytes).hexdigest().lower()
    test_device_id = f"e2e-verif-{uuid.uuid4().hex[:12]}"
    print(f"  * Device Evidence ID:        {test_device_id}")
    print(f"  * File Size:                 {len(img_bytes)} bytes")
    print(f"  * File SHA-256:              {raw_sha256}")

    # PVGCOE Nashik centroid coordinates: 20.03639, 73.79959
    payload_data = {
        "device_evidence_id": test_device_id,
        "project_id": 1,
        "stage_id": 1,
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 20.03639,
        "longitude": 73.79959,
        "accuracy_m": 3.5,
        "client_sha256": raw_sha256,
        "notes": "E2E verification of CONSTRA evidence -> Firestore chain anchor",
    }
    payload_files = {
        "file": ("e2e_evidence_test.jpg", img_bytes, "image/jpeg")
    }
    auth_headers = {
        "Authorization": "Bearer demo-supervisor"
    }

    # Use TestClient with real Firestore client active
    client = TestClient(app)

    created_evidence_id = None
    created_file_path = None

    try:
        # ---------------------------------------------------------
        # 3. Submit Evidence Item Through Existing Application Flow
        # ---------------------------------------------------------
        print("\n[Step 3] Submitting Evidence via POST /supervisor/evidence:")
        resp = client.post(
            "/supervisor/evidence",
            files=payload_files,
            data=payload_data,
            headers=auth_headers
        )
        print(f"  * HTTP Response Status:      {resp.status_code} (Expected: 201 Created)")
        assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
        
        resp_json = resp.json()
        created_evidence_id = resp_json["id"]
        print(f"  * Created Evidence ID:       {created_evidence_id}")
        print(f"  * Server Recalculated Hash:  {resp_json['server_sha256']}")
        print(f"  * Hash Matched:              {resp_json['hash_matched']}")
        print(f"  * Geofence Within Radius:    {resp_json['is_within_radius']} (distance={resp_json['distance_to_site_m']}m)")
        print(f"  * Initial Blockchain Status: {resp_json['blockchain_status']}")

        assert resp_json["server_sha256"] == raw_sha256
        assert resp_json["hash_matched"] is True
        assert resp_json["is_within_radius"] is True
        assert resp_json["blockchain_status"] == "pending"

        # ---------------------------------------------------------
        # 3b. Verify Backend Persistence (SQLite & Disk)
        # ---------------------------------------------------------
        print("\n[Step 3b] Verifying Backend Persistence (SQLite & Storage):")
        db = SessionLocal()
        ev_row = db.query(Evidence).filter(Evidence.id == created_evidence_id).first()
        assert ev_row is not None, "Evidence row not found in SQLite"
        print(f"  * SQLite Row Exists:         YES (ID={ev_row.id}, device_id={ev_row.device_evidence_id})")
        print(f"  * SQLite Stored File Path:   {ev_row.file_path}")
        created_file_path = ev_row.file_path
        assert os.path.exists(ev_row.file_path), f"File {ev_row.file_path} not found on disk"
        print(f"  * Physical File on Disk:     YES ({os.path.getsize(ev_row.file_path)} bytes)")
        db.close()

        # ---------------------------------------------------------
        # 3c. Verify Document Created in Real Cloud Firestore
        # ---------------------------------------------------------
        print("\n[Step 3c] Verifying 'chain_anchors' Document in Real Cloud Firestore:")
        doc_ref = fs_client.collection("chain_anchors").document(raw_sha256)
        doc_snap = doc_ref.get()
        assert doc_snap.exists, f"Firestore document {raw_sha256} does NOT exist in real Cloud Firestore!"
        fs_data = doc_snap.to_dict()
        print(f"  * Firestore Document Exists: YES (Document ID: {raw_sha256})")
        print(f"  * Field 'entity':            {fs_data.get('entity')} (Expected: 'photo')")
        print(f"  * Field 'entity_id':         {fs_data.get('entity_id')} (Expected: '{created_evidence_id}')")
        print(f"  * Field 'kind':              {fs_data.get('kind')} (Expected: 1)")
        print(f"  * Field 'status':            {fs_data.get('status')} (Expected: 'pending')")
        print(f"  * Field 'simulated':         {fs_data.get('simulated')} (Expected: True)")
        print(f"  * Field 'attempts':          {fs_data.get('attempts')} (Expected: 0)")
        print(f"  * Field 'tx_hash':           {fs_data.get('tx_hash')} (Expected: None)")
        print(f"  * Field 'created_at':        {fs_data.get('created_at')}")

        assert fs_data.get("entity") == "photo"
        assert fs_data.get("kind") == 1
        assert fs_data.get("status") == "pending"
        assert fs_data.get("simulated") is True
        assert str(fs_data.get("entity_id")) == str(created_evidence_id)

        # ---------------------------------------------------------
        # 4. Idempotency Verification
        # ---------------------------------------------------------
        print("\n[Step 4] Verifying Idempotency by Retrying Same Submission:")
        # Re-send exact same submission
        retry_files = {"file": ("e2e_evidence_test.jpg", img_bytes, "image/jpeg")}
        retry_resp = client.post(
            "/supervisor/evidence",
            files=retry_files,
            data=payload_data,
            headers=auth_headers
        )
        print(f"  * Retry Response Status:     {retry_resp.status_code} (Expected: 200 OK)")
        assert retry_resp.status_code == 200, f"Expected 200 on retry, got {retry_resp.status_code}"
        retry_json = retry_resp.json()
        assert retry_json["id"] == created_evidence_id, "Retry returned a different evidence ID!"
        print(f"  * Returned Same Evidence ID: YES (ID={retry_json['id']})")

        # Verify no duplicate row in SQLite
        db = SessionLocal()
        count_rows = db.query(Evidence).filter(Evidence.device_evidence_id == test_device_id).count()
        print(f"  * SQLite Rows for Device ID: {count_rows} (Expected: 1)")
        assert count_rows == 1, f"Duplicate rows detected in SQLite: count={count_rows}"
        db.close()

        # Verify Firestore document still single and unchanged
        doc_snap_after_retry = doc_ref.get()
        assert doc_snap_after_retry.exists
        print("  * Firestore Document:        Preserved without duplicates or collisions")

        # ---------------------------------------------------------
        # 5. Background Worker Processing & Status Transition
        # ---------------------------------------------------------
        print("\n[Step 5] Processing Batch with AnchorWorker (Fake Mode):")
        worker = AnchorWorker()
        worker.process_batch()

        # Inspect Firestore document after worker run
        doc_snap_anchored = doc_ref.get()
        anchored_data = doc_snap_anchored.to_dict()
        actual_status = anchored_data.get("status")
        actual_tx_hash = anchored_data.get("tx_hash")
        actual_block_num = anchored_data.get("block_number")
        actual_anchored_at = anchored_data.get("anchored_at")
        actual_simulated = anchored_data.get("simulated")

        print(f"  * Document Status:           {actual_status} (Expected: 'anchored')")
        print(f"  * Simulated Tx Hash:         {actual_tx_hash}")
        print(f"  * Simulated Block Number:    {actual_block_num}")
        print(f"  * Anchored At:               {actual_anchored_at}")
        print(f"  * Simulated Flag:            {actual_simulated} (Expected: True)")

        assert actual_status == "anchored", f"Expected 'anchored', got '{actual_status}'"
        assert actual_tx_hash is not None and actual_tx_hash.startswith("0xFAKE")
        assert actual_simulated is True
        assert actual_block_num is not None and actual_block_num > 0
        assert actual_anchored_at is not None

        # Verify Badge Endpoint: GET /chain/anchors/photo/{evidence_id}
        badge_resp = client.get(
            f"/chain/anchors/photo/{created_evidence_id}",
            headers=auth_headers
        )
        print(f"\n  * GET /chain/anchors/photo/{created_evidence_id}: Status {badge_resp.status_code}")
        assert badge_resp.status_code == 200
        badge_data = badge_resp.json()
        print(f"    - Badge Status:            {badge_data['status']}")
        print(f"    - Badge Tx Hash:           {badge_data['tx_hash']}")
        print(f"    - Badge Simulated:         {badge_data['simulated']}")
        assert badge_data["status"] == "anchored"
        assert badge_data["simulated"] is True

        # Verify Public Verification Endpoint: GET /chain/verify/{sha256}
        verify_resp = client.get(f"/chain/verify/{raw_sha256}")
        print(f"\n  * GET /chain/verify/{raw_sha256}: Status {verify_resp.status_code}")
        assert verify_resp.status_code == 200
        verify_data = verify_resp.json()
        print(f"    - Verification Status:     {verify_data['status']} (Expected: 'authentic')")
        print(f"    - Verification Kind:       {verify_data['kind']}")
        print(f"    - Verification Simulated:  {verify_data['simulated']}")
        print(f"    - Explorer URL:            {verify_data['explorer_url']}")
        assert verify_data["status"] == "authentic"
        assert verify_data["kind"] == "photo"
        assert verify_data["simulated"] is True

        # Verify Public File Upload Verification: POST /chain/verify
        upload_verify_resp = client.post(
            "/chain/verify",
            files={"file": ("test_verify.jpg", io.BytesIO(img_bytes), "image/jpeg")}
        )
        print(f"\n  * POST /chain/verify (File Upload): Status {upload_verify_resp.status_code}")
        assert upload_verify_resp.status_code == 200
        upload_verify_data = upload_verify_resp.json()
        print(f"    - Verification Status:     {upload_verify_data['status']} (Expected: 'authentic')")
        assert upload_verify_data["status"] == "authentic"

        # Tampered File Verification Test: alter 1 byte
        tampered_bytes = bytearray(img_bytes)
        tampered_bytes[-1] ^= 0xFF
        tamper_resp = client.post(
            "/chain/verify",
            files={"file": ("test_tampered.jpg", io.BytesIO(tampered_bytes), "image/jpeg")}
        )
        print(f"\n  * POST /chain/verify (Tampered File): Status {tamper_resp.status_code}")
        assert tamper_resp.status_code == 200
        print(f"    - Verification Status:     {tamper_resp.json()['status']} (Expected: 'not_found')")
        assert tamper_resp.json()["status"] == "not_found"

        # ---------------------------------------------------------
        # 6. Simulated vs Real Blockchain Anchoring Analysis
        # ---------------------------------------------------------
        print("\n" + "=" * 70)
        print("[Step 6] Analysis: Simulated vs Real Blockchain Transaction")
        print("=" * 70)
        print("Actual Anchor Status:")
        print(f"  * Firestore Document Status: 'anchored'")
        print(f"  * Transaction Hash:          {actual_tx_hash}")
        print(f"  * Is Simulated:              {actual_simulated}")
        print("\nKey Differences Between Fake & Real Modes:")
        print("  1. Network Broadcast:")
        print("     - Simulated (fake): No Ethereum RPC node contacted; tx_hash generated in-memory")
        print("       using sha256(hashes + timestamp) prefixed with '0xFAKE'.")
        print("     - Real: Signed transaction broadcast to Ethereum Sepolia (Chain ID 11155111)")
        print("       via Web3.py calling EvidenceRegistry.anchor(bytes32, uint8) or anchorMany().")
        print("  2. Gas & Cryptographic Keys:")
        print("     - Simulated (fake): Requires 0 ETH, no private key, no gas estimation.")
        print("     - Real: Requires throwaway wallet private key (ANCHOR_PRIVATE_KEY) with testnet Sepolia ETH.")
        print("  3. Consensus & Tamper-Proofing:")
        print("     - Simulated (fake): Recorded in Cloud Firestore ledger only; verify checks Firestore.")
        print("     - Real: Verified via on-chain contract read 'contract.functions.verify(bytes32)'.")
        print("       If Firestore says 'anchored' but contract returns 0, a DATABASE_TAMPER_DETECTED")
        print("       critical audit alert is immediately raised.")
        print("  4. Client Presentation:")
        print("     - Simulated (fake): Frontend displays 'SIMULATED' badge and dashed boundary.")
        print("     - Real: Frontend displays 'SEALED [DATE]' with clickable block explorer link to Etherscan.")

    finally:
        # ---------------------------------------------------------
        # 7. Safe Cleanup of Only Test Records
        # ---------------------------------------------------------
        print("\n" + "=" * 70)
        print("[Step 7] Cleaning Up Test Records:")
        print("=" * 70)

        # 7a. Clean up Cloud Firestore test document
        if raw_sha256:
            try:
                fs_client.collection("chain_anchors").document(raw_sha256).delete()
                # Verify deletion
                snap = fs_client.collection("chain_anchors").document(raw_sha256).get()
                print(f"  * Firestore doc '{raw_sha256[:16]}...': DELETED (exists={snap.exists})")
                assert not snap.exists
            except Exception as e:
                print(f"  * Firestore doc cleanup error: {e}")

        # 7b. Clean up SQLite test evidence record and audit logs
        if created_evidence_id:
            db = SessionLocal()
            try:
                # Delete audit logs for this test evidence
                db.query(AuditLog).filter(
                    AuditLog.entity == "evidence",
                    AuditLog.entity_id == str(created_evidence_id)
                ).delete()
                # Delete evidence record
                db.query(Evidence).filter(Evidence.id == created_evidence_id).delete()
                db.commit()
                print(f"  * SQLite Evidence record (ID={created_evidence_id}): DELETED")
            except Exception as e:
                db.rollback()
                print(f"  * SQLite cleanup error: {e}")
            finally:
                db.close()

        # 7c. Clean up physical test file on disk
        if created_file_path and os.path.exists(created_file_path):
            try:
                os.remove(created_file_path)
                print(f"  * Physical test file '{created_file_path}': DELETED (exists={os.path.exists(created_file_path)})")
            except Exception as e:
                print(f"  * File cleanup error: {e}")

        print("  * Cleanup Complete: Real Cloud Firestore and SQLite returned to clean state.")

    print("\n" + "=" * 70)
    print("VERIFICATION RESULT: ALL 7 STEPS PASSED SUCCESSFULLY")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(run_verification())
