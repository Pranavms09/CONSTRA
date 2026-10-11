import asyncio
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from google.cloud import firestore

from app.config import settings
from app.services.chain import chain_service
from app.services.firestore_db import append_audit_log_entry, get_firestore_client

logger = logging.getLogger(__name__)


class AnchorWorker:
    def __init__(self):
        self.worker_id = f"worker-{os.getpid()}-{uuid.uuid4().hex[:6]}"
        self._is_running = False
        self._task: Optional[asyncio.Task] = None
        self._last_recovery_time: Optional[datetime] = None

    def start(self):
        if self._is_running:
            return
        self._is_running = True
        self._task = asyncio.create_task(self.run_loop())
        logger.info("AnchorWorker started with ID: %s", self.worker_id)

    def stop(self):
        self._is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
        logger.info("AnchorWorker stopped.")

    async def run_loop(self):
        # Initial recovery on startup
        try:
            self.recover_expired_leases()
        except Exception as startup_rec_err:
            logger.error("Initial lease recovery failed: %s", startup_rec_err)

        while self._is_running:
            try:
                # Check low wallet funds
                if not chain_service.is_fake_mode() and chain_service.is_wallet_low_on_funds():
                    logger.warning("Anchor wallet is low on funds. Please replenish ETH for gas fees.")

                # Every minute, perform expired lease recovery
                now = datetime.now(timezone.utc)
                if self._last_recovery_time is None or (now - self._last_recovery_time).total_seconds() >= 60:
                    self.recover_expired_leases()
                    self._last_recovery_time = now

                # Process a batch of pending rows
                self.process_batch()

            except asyncio.CancelledError:
                break
            except Exception as loop_err:
                logger.exception("Error in AnchorWorker loop: %s", loop_err)

            try:
                await asyncio.sleep(settings.ANCHOR_BATCH_INTERVAL_SEC)
            except asyncio.CancelledError:
                break

    def recover_expired_leases(self):
        """Finds rows stuck in 'sent' whose lease has expired (>5 minutes).
        Checks on-chain first; if anchored, marks anchored; otherwise resets to pending.
        """
        try:
            client = get_firestore_client()
            now = datetime.now(timezone.utc)
            query = (
                client.collection("chain_anchors")
                .where(filter=firestore.FieldFilter("status", "==", "sent"))
                .where(filter=firestore.FieldFilter("lease_until", "<=", now))
            )
            expired_docs = list(query.stream())
            if not expired_docs:
                return

            logger.info("Found %d expired lease(s) to recover", len(expired_docs))
            for doc in expired_docs:
                data = doc.to_dict() or {}
                sha256 = doc.id

                # Check on-chain first
                try:
                    time_val, kind_val = chain_service.check_hash(sha256, client)
                    if time_val > 0:
                        doc.reference.update({
                            "status": "anchored",
                            "anchored_at": datetime.fromtimestamp(time_val, tz=timezone.utc),
                            "claimed_by": None,
                            "lease_until": None,
                            "last_error": None,
                        })
                        logger.info("Recovered doc %s: confirmed anchored on-chain at timestamp %s", sha256, time_val)
                    else:
                        # Transaction was not mined; reset to pending
                        doc.reference.update({
                            "status": "pending",
                            "claimed_by": None,
                            "lease_until": None,
                            "next_attempt_at": now,
                            "last_error": "Lease expired without on-chain confirmation; reset to pending",
                        })
                        logger.info("Recovered doc %s: reset to pending", sha256)
                except Exception as rec_err:
                    logger.warning("Error recovering doc %s: %s", sha256, rec_err)

        except Exception as exc:
            logger.warning("recover_expired_leases encountered an error: %s", exc)

    def process_batch(self):
        """Queries due pending rows, claims them transactionally, and sends the batch to chain."""
        client = get_firestore_client()
        now = datetime.now(timezone.utc)

        # 1. Query candidate pending rows where next_attempt_at <= now
        try:
            query = (
                client.collection("chain_anchors")
                .where(filter=firestore.FieldFilter("status", "==", "pending"))
                .where(filter=firestore.FieldFilter("next_attempt_at", "<=", now))
                .order_by("next_attempt_at")
                .limit(settings.ANCHOR_BATCH_SIZE)
            )
            candidate_docs = list(query.stream())
        except Exception as q_err:
            # If query failed (e.g. index building or offline), log and return
            logger.debug("Failed querying due chain_anchors: %s", q_err)
            return

        if not candidate_docs:
            return

        # 2. Transactionally claim candidate rows
        claimed_items: List[Dict[str, Any]] = []

        for doc_snap in candidate_docs:
            doc_ref = doc_snap.reference

            @firestore.transactional
            def _claim_tx(transaction):
                snap = doc_ref.get(transaction=transaction)
                if not snap.exists:
                    return None
                data = snap.to_dict() or {}
                if data.get("status") != "pending":
                    return None
                next_att = data.get("next_attempt_at")
                if next_att and next_att > now:
                    return None

                attempts = int(data.get("attempts", 0)) + 1
                lease_until = now + timedelta(minutes=5)
                transaction.update(doc_ref, {
                    "status": "sent",
                    "claimed_by": self.worker_id,
                    "lease_until": lease_until,
                    "attempts": attempts,
                })
                data["attempts"] = attempts
                data["doc_ref"] = doc_ref
                data["id"] = doc_snap.id
                return data

            try:
                tx = client.transaction()
                claimed_data = _claim_tx(tx)
                if claimed_data:
                    claimed_items.append(claimed_data)
            except Exception as claim_err:
                logger.debug("Failed to claim doc %s: %s", doc_snap.id, claim_err)

        if not claimed_items:
            return

        logger.info("Worker %s claimed %d item(s) for batch anchoring", self.worker_id, len(claimed_items))

        # 3. Broadcast batch
        hashes = [item["sha256"] for item in claimed_items]
        kinds = [int(item["kind"]) for item in claimed_items]

        try:
            tx_hash = chain_service.send_batch(hashes, kinds)

            # Record SUBMITTED status immediately
            is_sim = chain_service.is_fake_mode()
            for item in claimed_items:
                ref = item["doc_ref"]
                try:
                    ref.update({
                        "status": "submitted",
                        "tx_hash": tx_hash,
                        "chain_id": settings.CHAIN_ID or 11155111,
                        "simulated": is_sim,
                    })
                    _sync_sql_evidence(item.get("entity"), item.get("entity_id"), "submitted", tx_hash)
                except Exception as sub_err:
                    logger.debug("Failed updating submitted state: %s", sub_err)

            block_number, block_timestamp = chain_service.wait_for_receipt(tx_hash, timeout=120)

            anchored_dt = datetime.fromtimestamp(block_timestamp, tz=timezone.utc)
            for item in claimed_items:
                ref = item["doc_ref"]
                # Use 'confirmed' status while supporting queries
                ref.update({
                    "status": "confirmed",
                    "tx_hash": tx_hash,
                    "block_number": block_number,
                    "anchored_at": anchored_dt,
                    "chain_id": settings.CHAIN_ID or 11155111,
                    "simulated": is_sim,
                    "claimed_by": None,
                    "lease_until": None,
                    "last_error": None,
                })
                _sync_sql_evidence(
                    item.get("entity"),
                    item.get("entity_id"),
                    "confirmed" if not is_sim else "simulated",
                    tx_hash=tx_hash,
                    block_number=block_number
                )

            logger.info("Successfully confirmed %d item(s) on-chain in tx %s (block %s)", len(claimed_items), tx_hash, block_number)

        except Exception as batch_exc:
            logger.error("Failed anchoring batch of %d items: %s", len(claimed_items), batch_exc)
            err_msg = str(batch_exc)[:500]

            for item in claimed_items:
                ref = item["doc_ref"]
                attempts = int(item.get("attempts", 1))

                if attempts >= settings.ANCHOR_MAX_RETRIES:
                    status = "failed"
                    next_attempt_at = None
                    append_audit_log_entry(
                        client,
                        action="CHAIN_ANCHOR_MAX_RETRIES_EXCEEDED",
                        severity="ERROR",
                        detail=f"Hash {item['sha256']} reached max retries ({attempts}). Last error: {err_msg}",
                        entity=item.get("entity"),
                        entity_id=item.get("entity_id"),
                    )
                else:
                    status = "pending"
                    backoff_sec = min(300, 5 * (2 ** (attempts - 1)))
                    next_attempt_at = now + timedelta(seconds=backoff_sec)

                ref.update({
                    "status": status,
                    "next_attempt_at": next_attempt_at,
                    "claimed_by": None,
                    "lease_until": None,
                    "last_error": err_msg,
                })
                _sync_sql_evidence(
                    item.get("entity"),
                    item.get("entity_id"),
                    status if status == "failed" else "queued"
                )


def _sync_sql_evidence(
    entity: Optional[str],
    entity_id: Optional[Any],
    status: str,
    tx_hash: Optional[str] = None,
    block_number: Optional[int] = None
):
    """Synchronizes blockchain status from worker back to SQLite/PostgreSQL Evidence record."""
    if not entity or entity.lower() != "photo" or not entity_id:
        return
    try:
        from app.database import SessionLocal
        from app.models.evidence import Evidence
        db = SessionLocal()
        try:
            ev_id = int(entity_id)
            ev = db.query(Evidence).filter(Evidence.id == ev_id).first()
            if ev:
                ev.blockchain_status = status
                if tx_hash:
                    ev.blockchain_tx = tx_hash
                if block_number is not None:
                    ev.blockchain_block_number = block_number
                db.commit()
        finally:
            db.close()
    except Exception as exc:
        logger.debug("Could not sync SQL evidence entity_id=%s: %s", entity_id, exc)



# Global worker instance
anchor_worker = AnchorWorker()
