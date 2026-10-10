import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Union

from google.api_core.exceptions import AlreadyExists
from google.cloud import firestore

from app.config import settings
from app.services.firestore_db import get_firestore_client

logger = logging.getLogger(__name__)

ENTITY_TO_KIND: dict[str, int] = {
    "photo": 1,
    "challan": 2,
    "certificate": 3,
}

KIND_TO_ENTITY: dict[int, str] = {
    1: "photo",
    2: "challan",
    3: "certificate",
}


def normalize_sha256(sha256_input: str) -> str:
    """Normalize and validate a SHA-256 hex string.
    Lowercases, strips leading '0x', and validates exactly 64 hex characters.
    Raises ValueError on invalid input.
    """
    if not isinstance(sha256_input, str):
        raise ValueError("SHA-256 must be a string")
    h = sha256_input.strip().lower()
    if h.startswith("0x"):
        h = h[2:]
    if len(h) != 64 or not all(c in "0123456789abcdef" for c in h):
        raise ValueError(f"Invalid SHA-256 hash: must be 64 hex characters, got '{sha256_input}'")
    return h


def canonical_summary_hash(obj: Dict[str, Any]) -> str:
    """Computes a deterministic, canonical SHA-256 hash of a certificate summary object.
    
    The object must include milestone/stage details, approval metadata, check results,
    and a list of evidence file hashes (sorted).
    Uses strict JSON formatting with sorted keys and no whitespace separators.
    """
    normalized_obj = dict(obj)
    if "evidence_hashes" in normalized_obj and isinstance(normalized_obj["evidence_hashes"], list):
        normalized_obj["evidence_hashes"] = sorted(
            [str(h).lower() for h in normalized_obj["evidence_hashes"]]
        )

    serialized = json.dumps(normalized_obj, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest().lower()


def enqueue_anchor(
    db: Any = None,
    *,
    entity: str,
    entity_id: Union[str, int],
    sha256: str,
    project_id: Optional[Union[str, int]] = None,
) -> Union[str, int]:
    """Create a pending anchor row in Firestore (idempotent on sha256) and return its document ID.
    
    Collection: 'chain_anchors'
    Document ID: lowercase sha256
    
    Uses doc_ref.create() and catches AlreadyExists to guarantee idempotency.
    Never raises into the caller: on any error it logs and returns -1, so the
    main business flow can never break because of the chain.
    """
    try:
        norm_entity = (entity or "").strip().lower()
        if norm_entity not in ENTITY_TO_KIND:
            logger.warning(
                "enqueue_anchor rejected invalid entity '%s'. Expected one of %s",
                entity,
                list(ENTITY_TO_KIND.keys()),
            )
            return -1

        try:
            norm_hash = normalize_sha256(sha256)
        except ValueError as val_err:
            logger.warning("enqueue_anchor rejected invalid hash '%s': %s", sha256, val_err)
            return -1

        kind = ENTITY_TO_KIND[norm_entity]
        client = get_firestore_client()
        doc_ref = client.collection("chain_anchors").document(norm_hash)

        now = datetime.now(timezone.utc)
        payload = {
            "entity": norm_entity,
            "entity_id": str(entity_id),
            "project_id": str(project_id) if project_id is not None else None,
            "sha256": norm_hash,
            "kind": int(kind),
            "status": "pending",
            "tx_hash": None,
            "chain_id": None,
            "block_number": None,
            "anchored_at": None,
            "attempts": 0,
            "next_attempt_at": now,
            "claimed_by": None,
            "lease_until": None,
            "last_error": None,
            "simulated": bool(settings.CHAIN_MODE.lower() == "fake"),
            "created_at": firestore.SERVER_TIMESTAMP,
            "schema_version": 1,
        }

        try:
            doc_ref.create(payload)
            logger.info("Enqueued anchor document: %s for entity=%s id=%s", norm_hash, norm_entity, entity_id)
            return norm_hash
        except AlreadyExists:
            # Idempotent: already exists in Firestore
            logger.debug("Anchor document %s already exists; idempotent return", norm_hash)
            return norm_hash

    except Exception as exc:
        logger.exception("Unexpected error in enqueue_anchor for entity=%s id=%s: %s", entity, entity_id, exc)
        return -1
