# Technical Requirements Document (TRD)

**Product:** CONSTRA · **Version:** 2.0 (shipped build, 2026-10-28)
**Related:** [PRD](PRD.md) · [DESIGN](DESIGN.md) · [DB-SCHEMA](DB-SCHEMA.md) · [SECURITY](SECURITY.md) · [architecture.md](../architecture.md)

## Scope

Web portal, Flutter supervisor app, a Cloudflare Worker API with D1 and R2, an MST relayer, and two Solidity contracts on MST Blockchain.

## Stack

| Layer | Technology | Constraint |
| --- | --- | --- |
| Web | React 19, Vite, Tailwind, React Router; Worker static assets with SPA fallback | Only public `VITE_*` build-time vars |
| Mobile | Flutter; `camera`, `geolocator`, `flutter_secure_storage`, `reown_sign` | Supervisor role only |
| API | Cloudflare Workers + Hono (TypeScript), no `nodejs_compat` | ~10 ms CPU/request, 50 D1 queries/request |
| Data | D1 (SQLite), R2 | No shared memory between requests |
| AI | Gemini `gemini-2.5-flash` via Files API; optional Claude vision fallback for challan images | No base64, no image decoding |
| Chain | viem; Solidity 0.8.24; Hardhat | Legacy `gasPrice` only (no EIP-1559 on MST) |
| Auth | `jose` (Firebase JWKS), HMAC sessions, PBKDF2 | Roles from D1 / `AccessRegistry` |

## Module requirements

### TR-1 Auth and RBAC (`backend/src/auth.ts`, `routes/auth.ts`)
- Bearer token types: `sv-` HMAC session (24 h), Firebase ID token (signature, issuer, audience, expiry; verified email), `demo-<role>` only when `DEMO_MODE` ≠ `"false"`.
- Role always loaded from D1. `requireRole(...)` per route; `ensureProjectAccess` returns 404 for non-members.
- Wallet login: `/auth/wallet/challenge` stores nonce + exact message (5 min, single use); `/auth/wallet/login` verifies the signature, reads `AccessRegistry.roleOf` (0 → 403), requires an active D1 user with that `wallet_address`, mirrors the chain role into D1.
- QR pairing: `/auth/wallet/pair` returns id + secret (only SHA-256 stored, 5 min); desktop BridgeKey approves; phone claims once with the secret.
- Rate limits: `LOGIN_LIMITER`, `VERIFY_LIMITER` (10/min per IP); analyze-image 10/min.

### TR-2 Evidence ingestion (`routes/supervisor.ts`)
Order: idempotency on `device_evidence_id` → project membership → magic-byte MIME (JPEG/PNG/WebP) → max 20 MB → server SHA-256 vs `client_sha256` → geofence (`radius + min(accuracy, 50 m)`) → R2 `evidence/` → D1 row → `HASH_MISMATCH` (critical) / `GEOFENCE_VIOLATION` (high) alerts → audit log → join or open claim → queue anchor → `waitUntil` relayer + AI.

### TR-3 EXIF checks (`lib/exif.ts`)
exifr on the first 256 KB; checks GPS present, Haversine distance ≤ radius, capture time not future and ≤ max age (default 24 h). Used by `/api/analyze-image`, the EXIF GPS route and claim approval.

### TR-4 AI vision (`lib/gemini.ts`)
Upload bytes through the Files API, then `generateContent` with a construction-analysis prompt that treats text inside images as data. Structured result stored on the evidence row (`ai_status`, `ai_summary`, `ai_structured_result`). Retry via `/supervisor/evidence/{id}/retry-ai`. Advisory only.

### TR-5 Challan extraction (`services/store.ts`)
Upload → R2 `challans/` → status `processing` → `waitUntil` extraction (`OCR_MODE=fake` for dev) → fuzzy vendor/material match (rapidfuzz port) → `draft` with per-field confidence. Cron `recoverStuckChallans` retries rows stuck 2–15 min and fails older ones. Edits use optimistic `version`.

### TR-6 Reconciliation
On confirm: validate items → normalize units via `unit_conversions` → check duplicate file hash and vendor + challan number, date within project window, vendor approval, delivered vs BOQ (`boq_tolerance_pct`, default 5%). Each failure → alert.

### TR-7 Anomaly detection
`expected = planned × verified_progress`. Warn if no verified progress; alert if cumulative issue > `expected × (1 + expected_usage_tolerance)` (default 0.15), high when the excess is more than twice the tolerance. z-score on daily totals when ≥ 5 days exist, limit `zscore_limit` (2.5). `/store/issue-preview` runs the same function without writing.

### TR-8 Claims and clearance (`routes/claims.ts`)
Claims are JSON documents in D1. `submit` (auditor): self-approval guard → reject needs ≥5-char reason → blockers (stale fields, verdict consistency, open high/critical alerts, no photo, EXIF geofence fail, processing challans) → 422 with `blockers[]` or stage `CLEARED` + certificate (SHA-256 over canonical JSON) → anchor (`awaiting_signature` for wallet-linked auditors).

### TR-9 MST relayer (`services/chain.ts`, `routes/chain.ts`)
- Queue `chain_anchors` (`pending → sending → sent → anchored`, or `failed`; `awaiting_signature` for auditor-signed certificates), claim rows with `claimed_at` to avoid double send.
- `anchorMany` ≤ 50 per tx, legacy `gasPrice`, receipt wait, retries with `attempts` / `last_error`.
- Triggers: cron `* * * * *` and `waitUntil` after each upload.
- `syncRoles`: reads `AccessRegistry` `RoleSet` logs (≤ 5000 blocks/run, cursor in `chain_sync`), re-reads `roleOf`, updates D1 role / `is_active`.
- Certificate tx check: receipt success, sender = linked auditor wallet, `Anchored` log with the expected hash and kind 3.
- `CHAIN_MODE=fake` simulates anchors (local only; flagged `simulated = 1`).

### TR-10 Contracts (`contracts/`)
- `EvidenceRegistry`: `anchor(bytes32, uint8 kind)`, `anchorMany` (1–50, skips zero/invalid/duplicate), `verify → (time, kind, by)`, `setAnchorer`, `transferOwnership`. Kinds 1 photo, 2 challan, 3 certificate.
- `AccessRegistry`: `roleOf(address)` (0 none, 1 supervisor, 2 store in-charge, 3 auditor), `setRole` by owner or Auditor wallets, `RoleSet` event.

## API

Error body `{"detail": ...}`; 422 for validation, 403 for role, 404 for missing or non-member.

| Group | Routes |
| --- | --- |
| Health | `GET /health`, `/api/health` |
| Auth | `POST /auth/login`, `/auth/login-password`, `/auth/demo-login`, `/auth/password`, `/auth/wallet/challenge`, `/auth/wallet/login`, `/auth/wallet/pair`, `/auth/wallet/pair/{id}/approve`, `/auth/wallet/pair/{id}/claim`; `GET /auth/me` |
| Users (auditor) | `GET/POST /users`, `PATCH/DELETE /users/{id}` |
| Supervisor | `GET /supervisor/projects`, `/projects/{pid}/stages`, `/dashboard`, `/evidence`, `/evidence/{id}`, `/evidence/{id}/anchor`, `/evidence/{id}/file`; `POST /supervisor/evidence`, `/evidence/{id}/retry-ai`, `/evidence/{id}/retry-anchor` |
| Store | `GET /store/projects`, `/materials`, `/vendors`, `/projects/{pid}/{stages,materials,vendors,challans,material-issues,stock-summary,boq-status,alerts}`, `/challans/{id}`, `/deliveries/{id}`, `/files/{id}`; `POST /store/projects/{pid}/challans`, `/challans/manual`, `/challans/{id}/confirm`, `/issue-preview`, `/stages/{sid}/material-issues`; `PUT/PATCH /store/challans/{id}`; `PATCH /store/alerts/{id}`, `POST /store/alerts/{id}/action` |
| Claims (`/api/v1`) | `GET/POST /claims`, `GET /claims/{id}`, `POST /claims/{id}/commands`, `/decisions`, `/submit`, `GET /jobs/{id}`, `/claims/{id}/certificate`, `/stages/{id}/certificate` |
| Analysis | `POST /api/analyze-image`, `GET /api/analyses`, `/uploads/{name}`, `/api/v1/projects/{pid}/evidence/{file}/exif-gps` |
| Chain | `GET /chain/config`, `/verify/{sha256}`, `/anchors/{entity}/{id}`, `/status`, `/wallet/message`; `POST /chain/verify`, `/process`, `/roles/sync`, `/anchors/{id}/retry`, `/wallet`, `/certificates/{id}/onchain` |
| Pings | role-check endpoints per role |

## Configuration

`backend/wrangler.json` vars: `FIREBASE_PROJECT_ID`, `GEMINI_MODEL`, `FRONTEND_ORIGINS` (exact origins), `DEMO_MODE` (`false` in production), `OCR_MODE`, `MAX_UPLOAD_MB`, `CHAIN_MODE` (`mst`), `MST_NETWORK`, `MST_CHAIN_ID`, `MST_RPC_URL`, `MST_EXPLORER_URL`, `CONTRACT_ADDRESS`, `ACCESS_REGISTRY_ADDRESS`, `ACCESS_REGISTRY_FROM_BLOCK`. Bindings: `DB`, `FILES`, `LOGIN_LIMITER`, `VERIFY_LIMITER`; cron every minute.

Secrets (`wrangler secret put`, local `.dev.vars`): `SECRET_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` (optional), `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `ANCHOR_PRIVATE_KEY`.

Frontend (`frontend/.env`, public): `VITE_API_BASE_URL`, `VITE_FIREBASE_*`, `VITE_WALLET_LINK_TEST_SKIP`. Mobile `--dart-define`: `API_BASE_URL`, `WEB_APP_URL`, `WC_PROJECT_ID`.

Per-project thresholds (D1 `projects`, `project_settings`): `site_radius_m` 200, `boq_tolerance_pct` 5, `expected_usage_tolerance` 0.15, `zscore_limit` 2.5, `allow_new_vendors` 1.

## Deployment

| Target | Command |
| --- | --- |
| API + migrations | `npm run deploy:api` (root) |
| Web | `npm run deploy:web` (root; builds `frontend/dist`) |
| Both | `npm run deploy` |
| Contracts | `cd contracts && npm run deploy:testnet` / `deploy:access:testnet`; mainnet needs `CONFIRM_MAINNET="yes, deploy to mainnet"` |

Live: web `https://constra.pranavms09.workers.dev`, API `https://constra-api.pranavms09.workers.dev`. Run `wrangler login` yourself; secrets never go in config.

## Testing

| Suite | Scope | Result |
| --- | --- | --- |
| `backend` vitest | units, anomaly, reconcile, EXIF, route guards (auth, self-approval, claims, mobile photo join) | 32/32 |
| `contracts` Hardhat | access control, batching, duplicates, kinds, roles | 23/23 |
| `mobile` flutter test | geofence, stamp + hash, login UI | 5/5 |
| Manual E2E | local Hardhat chain + `wrangler dev`; MST testnet relayer tx | anchored + verified |

## Technical risks

| Risk | Mitigation |
| --- | --- |
| `waitUntil` cut-off (~30 s) | Fast model; cron recovery; Queues later |
| CPU limit on large images | Native hashing, no decoding, Files API |
| MST RPC outage | Anchors stay queued and retry |
| Bundle size (viem) | ~240 KiB gzip, within limits |
