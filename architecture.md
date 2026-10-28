# Architecture

CONSTRA runs on Cloudflare's free plan (two Workers, one D1 database, one R2 bucket) and anchors evidence on MST Blockchain.

```
Browser (React SPA) ──┐                       ┌── Firebase Auth JWKS (token verify)
Android app ──────────┼──> constra-api Worker ─┼── Gemini API (Files API + generateContent)
                      │   (Hono + cron relayer) ├── D1 constra-db (all relational + JSON docs)
constra Worker ───────┘                       ├── R2 constra-files (evidence, challans, uploads)
(static assets)                               └── MST RPC → EvidenceRegistry (anchorMany, setAnchorer, verify)
                                                            AccessRegistry (roleOf, RoleSet logs)
Browser + BridgeKey ──── MST RPC (direct): auditor anchor() / setRole() txs, public /verify reads
```

## Components

| Component | Location | Responsibility |
|---|---|---|
| Frontend Worker | `wrangler.json` (root), `frontend/` | Serves `frontend/dist` with SPA fallback. No server code. |
| API Worker | `backend/src/index.ts` | CORS (exact origins from `FRONTEND_ORIGINS`), route mounting, `{detail}` error format. |
| Auth | `backend/src/auth.ts` | Resolves Bearer token: `sv-` HMAC session, `demo-<role>` (only when `DEMO_MODE` ≠ `"false"`), or Firebase ID token (verified with `jose` against Google JWKS). Role always read from D1; for wallet-linked users D1 mirrors `AccessRegistry` on MST. `ensureProjectAccess` returns 404 for non-members. |
| Routes | `backend/src/routes/` | `auth`, `users` (auditor), `pings`, `supervisor`, `store`, `claims` (`/api/v1`), `analysis` (health, analyze-image, uploads, EXIF demo), `chain`. |
| Store domain | `backend/src/services/store.ts` | Unit conversion, stock/BOQ SQL aggregates, anomaly detection (progress ratio + z-score), challan reconciliation + alerts, OCR pipeline. |
| Chain relayer | `backend/src/services/chain.ts`, `routes/chain.ts` | D1 `chain_anchors` queue → viem `anchorMany` (legacy gasPrice) on MST; receipt confirmation; wallet link + `setAnchorer`; verification of auditor-signed certificate txs; on-chain `verify`. Cron `* * * * *` + `waitUntil`. `CHAIN_MODE=fake` simulates for keyless dev. `syncRoles` mirrors `AccessRegistry` `RoleSet` logs (≤5000 blocks/run, cursor in `chain_sync`) by re-reading `roleOf`. |
| Contract | `contracts/EvidenceRegistry.sol` | Owner/anchorer-gated hash registry: `anchor`, `anchorMany`, `verify → (time, kind, by)`, `setAnchorer`. |
| Wallet UI | `frontend/src/lib/mst.js`, `components/MstCertificatePanel.jsx`, `pages/VerifyPage.jsx` | BridgeKey discovery (EIP-6963), network switch, `personal_sign` link and sign-in, certificate `anchor` tx, auditor `setRole` tx, direct RPC `verify`. |
| Libraries | `backend/src/lib/` | `exif.ts` (exifr-based GPS/time/software checks), `gemini.ts`, `fuzzy.ts` (rapidfuzz port), `util.ts` (hashing, MIME sniffing). |
| Schema | `backend/migrations/` | `0001_init.sql` schema, `0002_demo_seed.sql` demo users/project/BOQ, `0003_mst_chain.sql`, `0004_wallet_auth.sql` (`auth_nonces`, `chain_sync`, unique `wallet_address`). |
| Contracts | `contracts/` | `EvidenceRegistry.sol` (evidence hashes), `AccessRegistry.sol` (portal role per wallet: 0 none, 1 supervisor, 2 store in-charge, 3 auditor; owner or Auditor wallets call `setRole`). |

## Key flows

**Wallet sign-in** (`POST /auth/wallet/challenge` → `/auth/wallet/login`): server stores a single-use nonce + exact message (5 min) → BridgeKey `personal_sign` → nonce deleted on read → `verifyMessage` → `AccessRegistry.roleOf` on MST (none → 403) → D1 user by `wallet_address` must exist and be active → claimed role must match (auditors exempt) → D1 role updated to the chain role → `sv-` session. Role changes: auditor BridgeKey `setRole` tx → `POST /chain/roles/sync` (also cron) → D1 role / `is_active` mirrored. `PATCH /users/:id` refuses role changes for wallet-linked users.

**Evidence upload** (`POST /supervisor/evidence`): idempotent on `device_evidence_id` → membership check → magic-byte MIME check → server SHA-256 vs client hash → geofence (radius + GPS accuracy) → R2 `evidence/` (private) → D1 row → HASH_MISMATCH / GEOFENCE_VIOLATION alerts → audit log → hash queued for MST (`queued → submitted → confirmed` on the evidence row) → `ctx.waitUntil` relayer + Gemini construction analysis.

**Challan** (`POST /store/projects/{pid}/challans`): validate size/magic bytes → R2 `challans/` → row `processing` → `waitUntil` OCR (Gemini, optional Claude for images; `OCR_MODE=fake` for dev) → fuzzy vendor/material match → `draft`. Edit uses optimistic `version`. Confirm validates items, may create unapproved vendor, anchors hash, runs reconciliation (duplicate file/number, date window, vendor approval, BOQ variance) creating alerts.

**Claim approval** (`POST /api/v1/claims/{id}/submit`, auditor): self-approval guard → rejection needs ≥5-char reason → blockers (stale fields, verdict consistency, open critical/high alerts, missing photo, processing challans) → stage `CLEARED`, certificate row with SHA-256 seal over canonical JSON → anchored on MST (`awaiting_signature` for BridgeKey auditors, else relayer).

## Storage

- **D1**: all tables from the former SQLAlchemy models, plus `claims` and `jobs` (JSON documents), `chain_anchors` (MST anchor queue/status) and `users.wallet_address`. Firestore is not used.
- **MST**: `EvidenceRegistry` is the source of truth for anchoring; D1 only caches tx hashes/status.
- **R2** keys: `evidence/{sha}_{deviceId}.jpg` (auth: owner supervisor or auditor), `challans/challan_{rand}.{ext}` (auth: store/auditor with project access; `?token=` allowed for `<img>`), `uploads/evd_{hash16}.{ext}` (public, analysis images). Objects carry R2 SHA-256 checksums so EXIF checks read only the first 256 KB.

## Trust boundaries

- All mutating routes require auth except: claims create/commands/decisions, analyze-image, chain verify (rate limited) — same as the previous backend.
- Login and chain-verify use Workers Rate Limiting bindings (10/min per IP).
- Secrets only via `wrangler secret put` / `.dev.vars`: `SECRET_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `ANCHOR_PRIVATE_KEY` (MST relayer = contract owner).
- Wallet sign-in: role authority is `AccessRegistry` on MST, never the client; challenges are bound to site, wallet, MST chain ID and expiry, and are single-use. Revocation reaches live sessions within one cron tick (sync sets `is_active = 0`).
- On-chain trust: only the owner and owner-authorized auditor wallets can anchor; auditor wallets are linked by signature; submitted certificate txs are checked against receipt, sender and `Anchored` log.

## Platform constraints

- Free plan: ~10 ms CPU/request, 50 D1 queries/request, no shared memory. Heavy work avoided: no image decoding/resizing; Gemini receives raw bytes via Files API (no base64); aggregates are single SQL queries.
- Background work uses `ctx.waitUntil` (~30 s). Upgrade path: Cloudflare Queues.
- Tesseract/OpenCV OCR was removed in the port. viem raises the Worker bundle to ~240 KiB gzip.
