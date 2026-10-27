# CONSTRA × MST Blockchain Integration

Network facts and tooling: [MST-BLOCKCHAIN.md](MST-BLOCKCHAIN.md). Contract: [`contracts/EvidenceRegistry.sol`](../contracts/EvidenceRegistry.sol).

## 1. What gets anchored

| Kind | Entity | When | Signer |
|---|---|---|---|
| 1 | Evidence photo (server SHA-256) | `POST /supervisor/evidence` | Relayer |
| 2 | Delivery challan file | `POST /store/challans/{id}/confirm` | Relayer |
| 3 | Clearance certificate seal | `POST /api/v1/claims/{id}/submit` (approval) | Auditor's BridgeKey wallet if linked, else relayer |

Only 32-byte hashes go on-chain. No names, images, amounts or user IDs.

## 2. Contract (`EvidenceRegistry`)

- `anchor(bytes32 h, uint8 kind)`, `anchorMany(bytes32[] hs, uint8[] kinds)` (≤50, skips zero/duplicate/invalid kind) — owner or authorized anchorer.
- `verify(bytes32) → (uint256 time, uint8 kind, address by)`.
- `setAnchorer(address, bool)` (owner), `transferOwnership(address)`.
- Event `Anchored(bytes32 indexed hash, uint8 kind, uint256 time, address indexed by)`.
- Selectors used without ABI libs in the frontend: `anchor` `0xa25e29d7`, `verify` `0x75e36616`.

## 3. Backend relayer (`backend/src/services/chain.ts`)

`chain_anchors` (D1) is the queue. Status flow:

```
pending ──claim (atomic UPDATE…RETURNING, ≤50)──> sending ──anchorMany tx──> sent ──receipt ok──> anchored
   ^                                                                 │
   └────────── retry (attempts < 5, stale > 5 min, revert) ──────────┴──> failed (audit log)
awaiting_signature ──auditor tx verified──> anchored
```

- Runs on every evidence/challan/certificate write (`ctx.waitUntil`) and every minute (Cron Trigger `* * * * *`), so batches form naturally and stuck rows recover.
- Legacy `gasPrice` txs signed with `ANCHOR_PRIVATE_KEY` (viem). Relayer = contract owner.
- Evidence rows mirror status: `queued → submitted → confirmed` (+ tx hash, block number).
- `CHAIN_MODE=fake` simulates anchors (`0xFAKE…`) for keyless local dev only.

## 4. Auditor wallet (BridgeKey)

1. `GET /chain/wallet/message?address=` → text to sign.
2. Wallet `personal_sign` → `POST /chain/wallet {address, signature}`; backend verifies the signature, stores `users.wallet_address`, relayer sends `setAnchorer(address, true)`.
3. On approval the certificate row is `awaiting_signature`; the UI (certificate modal) calls `anchor(certHash, 3)` from BridgeKey and posts the tx hash to `POST /chain/certificates/{id}/onchain`.
4. Backend accepts only if the receipt succeeded, `to` = registry, `from` = linked wallet, and an `Anchored(certHash)` log exists.

## 5. Verification

- `GET /chain/verify/{sha256}` / `POST /chain/verify` (file): reads `verify()` on MST. If D1 says anchored but the chain returns 0 → `DATABASE_TAMPER_DETECTED` audit entry.
- `/verify` page (public): hashes the file in the browser and calls the contract via the public RPC; no backend trust.
- `GET /chain/config` (public): network, RPC, explorer, contract address.
- `GET /chain/status` (auditor): queue counts, relayer address/balance. `POST /chain/process` runs the relayer immediately.

## 6. Configuration

`backend/wrangler.json` vars: `CHAIN_MODE` (`mst`|`fake`), `MST_NETWORK`, `MST_CHAIN_ID`, `MST_RPC_URL`, `MST_EXPLORER_URL`, `CONTRACT_ADDRESS`. Secret: `ANCHOR_PRIVATE_KEY` (`wrangler secret put`). Switch to mainnet by changing the four `MST_*` vars and `CONTRACT_ADDRESS`.

## 7. Local end-to-end test

```bash
cd contracts && npx hardhat node                                   # terminal 1
npx hardhat run scripts/deploy.js --network localhost              # prints address
cd ../backend && npx wrangler dev --test-scheduled \
  --var CHAIN_MODE:mst --var MST_RPC_URL:http://127.0.0.1:8545 --var MST_CHAIN_ID:31337 \
  --var CONTRACT_ADDRESS:<address> --var ANCHOR_PRIVATE_KEY:<hardhat account #0 key>
curl "http://127.0.0.1:8787/__scheduled?cron=*+*+*+*+*"            # run the relayer
```
Verified 2026-10-27: evidence anchored and confirmed, `/chain/verify` authentic with `anchored_by`, wallet link + `setAnchorer`, unauthorized wallet reverted by contract, auditor-signed certificate accepted.
