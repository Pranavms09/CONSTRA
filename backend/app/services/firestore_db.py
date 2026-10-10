import logging
import os
from typing import Any, Dict, Optional
from google.auth.credentials import AnonymousCredentials
from google.cloud import firestore
import firebase_admin
from firebase_admin import credentials, firestore as admin_firestore

from app.config import settings

logger = logging.getLogger(__name__)

_firestore_client: Optional[firestore.Client] = None


def get_firestore_client() -> firestore.Client:
    """Returns the initialized Google Cloud Firestore client.
    
    Supports:
    1. Production service account credential.
    2. Local Firestore emulator via FIRESTORE_EMULATOR_HOST.
    3. AnonymousCredentials fallback for local testing without cloud credentials.
    """
    global _firestore_client
    if _firestore_client is not None:
        return _firestore_client

    project_id = getattr(settings, "FIREBASE_PROJECT_ID", None) or "constra-b561b"
    cert_path = getattr(settings, "FIREBASE_SERVICE_ACCOUNT_PATH", None)

    # Resolve certificate path across root and backend working directories
    resolved_cert = None
    backend_dir_secrets = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "secrets", "firebase-service-account.json"))
    if cert_path:
        raw_sub = cert_path.replace("backend/", "") if "backend/" in cert_path else cert_path
        for candidate in [
            cert_path,
            os.path.join("backend", cert_path),
            raw_sub,
            os.path.join("..", cert_path),
            os.path.abspath(cert_path),
            backend_dir_secrets,
        ]:
            if os.path.exists(candidate) and os.path.isfile(candidate):
                resolved_cert = candidate
                break

    # 1. Check if real service account JSON exists
    if resolved_cert:
        try:
            if firebase_admin._apps:
                app = firebase_admin.get_app()
                if isinstance(app.credential, credentials.ApplicationDefault):
                    firebase_admin.delete_app(app)
            if not firebase_admin._apps:
                cred = credentials.Certificate(resolved_cert)
                firebase_admin.initialize_app(cred, {"projectId": project_id})
            _firestore_client = admin_firestore.client()
            logger.info("Firestore initialized using service account: %s", resolved_cert)
            return _firestore_client
        except Exception as exc:
            logger.warning("Failed to initialize Firestore with service account: %s", exc)

    # 2. Check if emulator environment is active
    if os.environ.get("FIRESTORE_EMULATOR_HOST"):
        _firestore_client = firestore.Client(
            project=project_id,
            credentials=AnonymousCredentials()
        )
        logger.info("Firestore connected to emulator at %s", os.environ.get("FIRESTORE_EMULATOR_HOST"))
        return _firestore_client

    # 3. Default Admin SDK initialization attempt using Application Default Credentials (ADC)
    # Never silently fall back to AnonymousCredentials against production cloud endpoints
    if not firebase_admin._apps:
        firebase_admin.initialize_app(options={"projectId": project_id})
    _firestore_client = admin_firestore.client()
    return _firestore_client


def set_firestore_client(client: Any) -> None:
    """Allows injecting a client or mock in test suites."""
    global _firestore_client
    _firestore_client = client


def append_audit_log_entry(
    client: firestore.Client,
    *,
    action: str,
    severity: str = "INFO",
    detail: Optional[str] = None,
    actor_id: Optional[str] = None,
    entity: Optional[str] = None,
    entity_id: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> str:
    """Appends an audit log entry.
    
    If an audit hash chain is used, updates a single audit_head document
    within a transaction to prevent concurrent write forks.
    """
    import hashlib
    import time
    from datetime import datetime, timezone

    head_ref = client.collection("audit_head").document("head")
    logs_col = client.collection("audit_logs")

    @firestore.transactional
    def _transact_append(transaction):
        head_snap = head_ref.get(transaction=transaction)
        prev_hash = ""
        index = 1
        if head_snap.exists:
            head_data = head_snap.to_dict() or {}
            prev_hash = head_data.get("current_hash", "")
            index = int(head_data.get("count", 0)) + 1

        timestamp_iso = datetime.now(timezone.utc).isoformat()
        entry_data = {
            "index": index,
            "action": action,
            "severity": severity,
            "detail": detail,
            "actor_id": actor_id,
            "entity": entity,
            "entity_id": entity_id,
            "ip_address": ip_address,
            "prev_hash": prev_hash,
            "timestamp": timestamp_iso,
        }

        # Compute hash of this audit log entry
        payload = f"{index}|{action}|{severity}|{detail}|{prev_hash}|{timestamp_iso}"
        entry_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        entry_data["hash"] = entry_hash

        doc_ref = logs_col.document()
        transaction.set(doc_ref, entry_data)
        transaction.set(head_ref, {
            "current_hash": entry_hash,
            "count": index,
            "updated_at": firestore.SERVER_TIMESTAMP,
        })
        return doc_ref.id

    try:
        transaction = client.transaction()
        return _transact_append(transaction)
    except Exception as exc:
        logger.error("Failed to append transactional audit log: %s", exc)
        # Non-blocking fallback
        try:
            doc_ref = logs_col.document()
            doc_ref.set({
                "action": action,
                "severity": severity,
                "detail": detail,
                "created_at": firestore.SERVER_TIMESTAMP,
            })
            return doc_ref.id
        except Exception:
            return ""
