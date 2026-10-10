# CONSTRA Blockchain Anchoring Integration Guide

This document is the integration guide for teammates working on role modules (Supervisor, Store In-Charge, Auditor).

---

## 1. What Gets Anchored and When

| Entity | Kind | Trigger Event | Hash Sourced From |
|---|---|---|---|
| **Delivery Challan** | `2` | When challan status transitions to `confirmed` | `challans.sha256` (SHA-256 of original file) |
| **Photo Evidence** | `1` | After verification passes with zero failed checks (or auditor approval) | SHA-256 of original image file stored |
| **Audit Certificate** | `3` | After certificate PDF is written | SHA-256 of PDF bytes **plus** canonical summary hash |

**Privacy & Security Invariant:**
No filenames, images, text, user PII, or amounts are sent to the blockchain. Only SHA-256 fingerprints (32 bytes) and entity kind integers (1, 2, 3) are stored.

---

## 2. The Single Function Call: `enqueue_anchor`

Import and call `enqueue_anchor` from `app.services.chain_hooks`:

```python
from app.services.chain_hooks import enqueue_anchor

enqueue_anchor(
    entity="challan",       # "photo" | "challan" | "certificate"
    entity_id=str(record.id),
    sha256=record.sha256,   # 64 lowercase hex characters
    project_id=str(record.project_id) if record.project_id else None,
)
```

### Safety Guarantees:
- **Never blocks / never raises**: Catches all network/database issues and returns `-1` on any failure.
- **Idempotent**: Uses Firestore `ref.create()` with `AlreadyExists` handling. Re-calling with the same hash returns the existing document ID without creating duplicates.
- **Asynchronous batching**: Does not perform blockchain network calls. The background `AnchorWorker` batches due rows every `ANCHOR_BATCH_INTERVAL_SEC`.

### Integration Snippets for Teammates:

#### A. Store Module (Delivery Challans) — *ALREADY WIRED*
In `backend/app/routers/store.py` when a delivery challan is confirmed:
```python
challan.status = "confirmed"
db.commit()

from app.services.chain_hooks import enqueue_anchor
enqueue_anchor(
    entity="challan",
    entity_id=str(challan.id),
    sha256=challan.sha256,
    project_id=str(challan.project_id) if challan.project_id else None,
)
```

#### B. Supervisor / AI Analysis Module (Photo Evidence)
When photo analysis completes with zero check failures (or when an auditor manually accepts a flagged photo):
```python
from app.services.chain_hooks import enqueue_anchor
enqueue_anchor(
    entity="photo",
    entity_id=str(analysis.id),
    sha256=analysis.sha256,
    project_id=str(analysis.project_id) if analysis.project_id else None,
)
```

#### C. Auditor Module (Issued Certificates)
When issuing an audit certificate:
1. Hash the PDF bytes and enqueue:
   ```python
   import hashlib
   from app.services.chain_hooks import enqueue_anchor, canonical_summary_hash

   pdf_hash = hashlib.sha256(pdf_bytes).hexdigest()
   enqueue_anchor(
       entity="certificate",
       entity_id=str(cert.id),
       sha256=pdf_hash,
       project_id=str(cert.project_id),
   )
   ```
2. Compute the canonical summary hash and enqueue as second anchor:
   ```python
   summary_data = {
       "stage_id": stage.id,
       "project_id": project.id,
       "stage_name": stage.name,
       "approved_by": auditor.id,
       "approved_at": cert.created_at.isoformat(),
       "checks": checks_summary_list,
       "evidence_hashes": sorted_evidence_hash_list,
   }
   summary_hash = canonical_summary_hash(summary_data)
   cert.summary_sha256 = summary_hash  # Store on certificate record

   enqueue_anchor(
       entity="certificate",
       entity_id=str(cert.id),
       sha256=summary_hash,
       project_id=str(cert.project_id),
   )
   ```

---

## 3. Frontend `AnchorBadge` Usage

Component: `<AnchorBadge entity="challan" entityId={challan.id} />`

### Props:
- `entity: "photo" | "challan" | "certificate"`
- `entityId: string | number`
- `className?: string` (optional Tailwind classes)

### Visual States:
- **PENDING**: Silver hairline outline, lock icon, uppercase `"SEALING..."` (polls every 5s for up to 2m).
- **ANCHORED**: Ink solid fill, ivory text, signal check icon, `"SEALED [DATE]"`. Clicking the external link opens the transaction on the block explorer.
- **FAILED**: Signal amber fill, ink text, `"SEAL FAILED"`.
- **SIMULATED**: Dashed outline, `"SIMULATED"` (visible indicator in `fake` mode).

---

## 4. Switching `CHAIN_MODE`

Controlled via `backend/.env`:

### Fake Mode (`CHAIN_MODE=fake`):
- Default for local development and demos.
- Requires no RPC URL, no private keys, and no wallet balance.
- Simulates on-chain transactions with deterministic `0xFAKE...` transaction hashes and block confirmations.
- Badges and public verification results display a clear `SIMULATED` pill.

### Real Mode (`CHAIN_MODE=real`):
- Connects to Ethereum Sepolia (or configured EVM testnet/mainnet).
- Requires:
  ```env
  CHAIN_MODE=real
  RPC_URL=https://sepolia.infura.io/v3/<API_KEY>
  CHAIN_ID=11155111
  CONTRACT_ADDRESS=0x<DEPLOYED_CONTRACT_ADDRESS>
  ANCHOR_PRIVATE_KEY=<THROWAWAY_WALLET_PRIVATE_KEY>
  EXPLORER_TX_URL=https://sepolia.etherscan.io/tx/
  EXPLORER_ADDRESS_URL=https://sepolia.etherscan.io/address/
  ```
- Startup validator halts backend boot if any required variable is empty.

---

## 5. 5-Step Verification & Demo Script

1. **Upload Evidence**:
   Upload a delivery challan in the Store In-Charge flow (`/store/challans`).
2. **Confirm & Inspect Badge**:
   Confirm the challan. Notice the `AnchorBadge` appear as `SEALING...`. Within `ANCHOR_BATCH_INTERVAL_SEC` (default 20s), the background worker processes the batch and the badge transitions to `SEALED` (with date).
3. **Inspect Explorer Link**:
   Click the badge link icon. In `fake` mode, it shows the simulated hash. In `real` mode, it opens the transaction on Etherscan testnet showing the `Anchored` event.
4. **Public Verification**:
   Navigate to `/verify` (no login required). Drop the original uploaded file into `VerifyDropzone`. The system verifies the fingerprint against the tamper-evident registry and displays **"AUTHENTIC"** sealed date and transaction proof.
5. **Tamper Test**:
   Open the file in a hex editor or text editor, change a single character or byte, and re-upload on `/verify`. The system immediately displays **"NOT FOUND — No record of this exact file. Even a one-character change produces a different fingerprint."**
