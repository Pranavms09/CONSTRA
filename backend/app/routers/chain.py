import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user, require_role
from app.config import settings
from app.database import get_db
from app.limiter import limiter
from app.models.project import ProjectMember
from app.models.user import User
from app.schemas.chain import (
    AnchorStatusResponse,
    ChainCounts,
    ChainStatusResponse,
    PublicVerifyResponse,
    RetryAnchorResponse,
)
from app.services.chain import chain_service
from app.services.chain_hooks import KIND_TO_ENTITY, normalize_sha256
from app.services.firestore_db import append_audit_log_entry, get_firestore_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chain", tags=["blockchain"])

MAX_VERIFY_BYTES = 25 * 1024 * 1024  # 25 MB


def _format_anchored_at(anchored_at_val: Any) -> Optional[str]:
    if anchored_at_val is None:
        return None
    if hasattr(anchored_at_val, "isoformat"):
        return anchored_at_val.isoformat()
    if isinstance(anchored_at_val, (int, float)):
        return datetime.fromtimestamp(anchored_at_val, tz=timezone.utc).isoformat()
    return str(anchored_at_val)


def _verify_hash_internal(sha256_hex: str, client: Any, req: Request) -> PublicVerifyResponse:
    """Internal core verification logic for both file upload and direct hash lookup."""
    try:
        norm_hash = normalize_sha256(sha256_hex)
    except ValueError:
        return PublicVerifyResponse(status="not_found", sha256=sha256_hex, simulated=False)

    doc_ref = client.collection("chain_anchors").document(norm_hash)
    doc_snap = doc_ref.get()

    if not doc_snap.exists:
        return PublicVerifyResponse(status="not_found", sha256=norm_hash, simulated=False)

    data = doc_snap.to_dict() or {}
    db_status = data.get("status")

    if db_status != "anchored":
        return PublicVerifyResponse(status="not_found", sha256=norm_hash, simulated=False)

    # In REAL mode: must confirm with smart contract on-chain
    if not chain_service.is_fake_mode():
        chain_time, chain_kind = chain_service.check_hash(norm_hash, client)
        if chain_time == 0:
            # Database says anchored, but on-chain registry has no record: possible tampering!
            client_ip = req.client.host if req.client else "unknown"
            append_audit_log_entry(
                client,
                action="DATABASE_TAMPER_DETECTED",
                severity="CRITICAL",
                detail=(
                    f"Possible database tampering! Record {norm_hash} marked 'anchored' in Firestore "
                    f"but verify returned 0 on smart contract {settings.CONTRACT_ADDRESS}."
                ),
                entity=data.get("entity"),
                entity_id=str(data.get("entity_id")),
                ip_address=client_ip,
            )
            logger.critical("TAMPER ALERT: Firestore doc %s is 'anchored' but contract returned 0!", norm_hash)
            return PublicVerifyResponse(status="not_found", sha256=norm_hash, simulated=False)

    kind_int = data.get("kind", 1)
    kind_str = KIND_TO_ENTITY.get(kind_int, "photo")
    tx_hash = data.get("tx_hash")
    explorer_url = f"{settings.EXPLORER_TX_URL}{tx_hash}" if settings.EXPLORER_TX_URL and tx_hash else None
    simulated = bool(data.get("simulated", False) or chain_service.is_fake_mode())

    return PublicVerifyResponse(
        status="authentic",
        sha256=norm_hash,
        anchored_at=_format_anchored_at(data.get("anchored_at")),
        kind=kind_str,
        tx_hash=tx_hash,
        explorer_url=explorer_url,
        simulated=simulated,
    )


# 1. POST /chain/verify (Public, rate limited 10/min/IP)
@router.post("/verify", response_model=PublicVerifyResponse)
@limiter.limit("10/minute")
async def verify_file(request: Request, file: UploadFile = File(...)):
    """Public endpoint to verify evidence file authenticity.
    
    Streams file chunks, computes SHA-256 in memory, caps size at 25 MB,
    and checks against tamper-evident chain records without storing the file.
    """
    hasher = hashlib.sha256()
    bytes_read = 0
    chunk_size = 64 * 1024  # 64 KB

    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        bytes_read += len(chunk)
        if bytes_read > MAX_VERIFY_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size exceeds maximum allowed limit of 25 MB",
            )
        hasher.update(chunk)

    sha256_hex = hasher.hexdigest().lower()
    client = get_firestore_client()
    return _verify_hash_internal(sha256_hex, client, request)


# 2. GET /chain/verify/{sha256} (Public, rate limited 10/min/IP)
@router.get("/verify/{sha256}", response_model=PublicVerifyResponse)
@limiter.limit("10/minute")
async def verify_hash(request: Request, sha256: str):
    """Public endpoint to verify a known SHA-256 fingerprint."""
    client = get_firestore_client()
    return _verify_hash_internal(sha256, client, request)


# 3. GET /chain/anchors/{entity}/{entity_id} (Authenticated role, project membership required)
@router.get("/anchors/{entity}/{entity_id}", response_model=AnchorStatusResponse)
async def get_anchor_status_for_badge(
    entity: str,
    entity_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves anchor status for badge presentation.
    
    Requires project membership (returns 404 otherwise to avoid leaking existence).
    """
    norm_entity = entity.strip().lower()
    client = get_firestore_client()

    # Query chain_anchors by entity and entity_id
    from google.cloud.firestore import FieldFilter
    query = (
        client.collection("chain_anchors")
        .where(filter=FieldFilter("entity", "==", norm_entity))
        .where(filter=FieldFilter("entity_id", "==", str(entity_id)))
        .limit(1)
    )
    docs = list(query.stream())
    if not docs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anchor not found")

    data = docs[0].to_dict() or {}
    project_id = data.get("project_id")

    # Verify project membership if project_id is present and user is not auditor
    if project_id and user.role != "auditor":
        try:
            pid = int(project_id)
            membership = (
                db.query(ProjectMember)
                .filter(ProjectMember.project_id == pid, ProjectMember.user_id == user.id)
                .first()
            )
            if not membership:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anchor not found")
        except ValueError:
            pass

    tx_hash = data.get("tx_hash")
    explorer_url = f"{settings.EXPLORER_TX_URL}{tx_hash}" if settings.EXPLORER_TX_URL and tx_hash else None
    simulated = bool(data.get("simulated", False) or chain_service.is_fake_mode())

    return AnchorStatusResponse(
        status=data.get("status", "pending"),
        sha256=docs[0].id,
        entity=data.get("entity", norm_entity),
        entity_id=str(data.get("entity_id", entity_id)),
        kind=int(data.get("kind", 1)),
        tx_hash=tx_hash,
        anchored_at=_format_anchored_at(data.get("anchored_at")),
        explorer_url=explorer_url,
        simulated=simulated,
        attempts=int(data.get("attempts", 0)),
        last_error=data.get("last_error"),
    )


# 4. GET /chain/status (Auditor only)
@router.get("/status", response_model=ChainStatusResponse)
async def get_chain_diagnostics(
    user: User = Depends(require_role("auditor")),
):
    """Returns diagnostic chain status, wallet balance, and anchor counts per status."""
    client = get_firestore_client()

    def _get_count(status_name: str) -> int:
        from google.cloud.firestore import FieldFilter
        try:
            col = client.collection("chain_anchors").where(filter=FieldFilter("status", "==", status_name))
            aggr = col.count().get()
            return int(aggr[0][0].value)
        except Exception:
            try:
                return len(list(client.collection("chain_anchors").where(filter=FieldFilter("status", "==", status_name)).stream()))
            except Exception:
                return 0

    counts = ChainCounts(
        pending=_get_count("pending"),
        sent=_get_count("sent"),
        anchored=_get_count("anchored"),
        failed=_get_count("failed"),
    )

    wallet_address = chain_service.get_wallet_address()
    wallet_balance = chain_service.get_wallet_balance_eth()
    wallet_low_funds = chain_service.is_wallet_low_on_funds()

    return ChainStatusResponse(
        mode=settings.CHAIN_MODE.lower(),
        chain_id=settings.CHAIN_ID,
        contract_address=settings.CONTRACT_ADDRESS,
        wallet_address=wallet_address,
        wallet_balance_eth=wallet_balance,
        wallet_low_funds=wallet_low_funds,
        counts=counts,
        explorer_tx_url=settings.EXPLORER_TX_URL,
        explorer_address_url=settings.EXPLORER_ADDRESS_URL,
        show_chain_copy=bool(settings.SHOW_CHAIN_COPY),
    )


# 5. POST /chain/anchors/{id}/retry (Auditor only)
@router.post("/anchors/{id}/retry", response_model=RetryAnchorResponse)
async def retry_failed_anchor(
    id: str,
    user: User = Depends(require_role("auditor")),
):
    """Resets a failed anchor row back to pending state with zero attempts."""
    client = get_firestore_client()
    doc_ref = client.collection("chain_anchors").document(id)
    doc_snap = doc_ref.get()

    if not doc_snap.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anchor not found")

    now = datetime.now(timezone.utc)
    doc_ref.update({
        "status": "pending",
        "attempts": 0,
        "next_attempt_at": now,
        "claimed_by": None,
        "lease_until": None,
        "last_error": None,
    })

    return RetryAnchorResponse(
        success=True,
        sha256=id,
        message="Anchor status reset to pending for immediate worker processing",
    )
