# Architecture

CONSTRA runs on Cloudflare's free plan. Two Workers, one D1 database, one R2 bucket.

```
Browser (React SPA) ──┐                       ┌── Firebase Auth JWKS (token verify)
Android app ──────────┼──> constra-api Worker ─┼── Gemini API (Files API + generateContent)
                      │      (Hono)            ├── D1 constra-db (all relational + JSON docs)
constra Worker ───────┘                       └── R2 constra-files (evidence, challans, uploads)
(static assets, frontend/dist)
```

## Components

| Component | Location | Responsibility |
|---|---|---|
| Frontend Worker | `wrangler.json` (root), `frontend/` | Serves `frontend/dist` with SPA fallback. No server code. |
| API Worker | `backend/src/index.ts` | CORS (exact origins from `FRONTEND_ORIGINS`), route mounting, `{detail}` error format. |
| Auth | `backend/src/auth.ts` | Resolves Bearer token: `sv-` HMAC session, `demo-<role>` (only when `DEMO_MODE` ≠ `"false"`), or Firebase ID token (verified with `jose` against Google JWKS). Role always read from D1. `ensureProjectAccess` returns 404 for non-members. |
| Routes | `backend/src/routes/` | `auth`, `users` (auditor), `pings`, `supervisor`, `store`, `claims` (`/api/v1`), `analysis` (health, analyze-image, uploads, EXIF demo), `chain`. |
| Store domain | `backend/src/services/store.ts` | Unit conversion, stock/BOQ SQL aggregates, anomaly detection (progress ratio + z-score), challan reconciliation + alerts, OCR pipeline. |
| Chain | `backend/src/services/chain.ts` | Simulated anchoring: `INSERT OR IGNORE` into `chain_anchors` with `0xFAKE…` tx hash. No wallet, no worker. |
| Libraries | `backend/src/lib/` | `exif.ts` (exifr-based GPS/time/software checks), `gemini.ts`, `fuzzy.ts` (rapidfuzz port), `util.ts` (hashing, MIME sniffing). |
| Schema | `backend/migrations/` | `0001_init.sql` schema, `0002_demo_seed.sql` demo users/project/BOQ. |

## Key flows

**Evidence upload** (`POST /supervisor/evidence`): idempotent on `device_evidence_id` → membership check → magic-byte MIME check → server SHA-256 vs client hash → geofence (radius + GPS accuracy) → R2 `evidence/` (private) → D1 row → HASH_MISMATCH / GEOFENCE_VIOLATION alerts → audit log → simulated anchor → `ctx.waitUntil` Gemini construction analysis updates `ai_*` columns.

**Challan** (`POST /store/projects/{pid}/challans`): validate size/magic bytes → R2 `challans/` → row `processing` → `waitUntil` OCR (Gemini, optional Claude for images; `OCR_MODE=fake` for dev) → fuzzy vendor/material match → `draft`. Edit uses optimistic `version`. Confirm validates items, may create unapproved vendor, anchors hash, runs reconciliation (duplicate file/number, date window, vendor approval, BOQ variance) creating alerts.

**Claim approval** (`POST /api/v1/claims/{id}/submit`, auditor): self-approval guard → rejection needs ≥5-char reason → blockers (stale fields, verdict consistency, open critical/high alerts, missing photo, processing challans) → stage `CLEARED`, certificate row with SHA-256 seal over canonical JSON.

## Storage

- **D1**: all tables from the former SQLAlchemy models, plus `claims` and `jobs` (JSON documents, formerly a JSON file and in-memory dict) and `chain_anchors` (formerly Firestore). Firestore is no longer used anywhere.
- **R2** keys: `evidence/{sha}_{deviceId}.jpg` (auth: owner supervisor or auditor), `challans/challan_{rand}.{ext}` (auth: store/auditor with project access; `?token=` allowed for `<img>`), `uploads/evd_{hash16}.{ext}` (public, analysis images). Objects carry R2 SHA-256 checksums so EXIF checks read only the first 256 KB.

## Trust boundaries

- All mutating routes require auth except: claims create/commands/decisions, analyze-image, chain verify (rate limited) — same as the previous backend.
- Login and chain-verify use Workers Rate Limiting bindings (10/min per IP).
- Secrets only via `wrangler secret put` / `.dev.vars`: `SECRET_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`.

## Platform constraints

- Free plan: ~10 ms CPU/request, 50 D1 queries/request, no shared memory. Heavy work avoided: no image decoding/resizing; Gemini receives raw bytes via Files API (no base64); aggregates are single SQL queries.
- Background work uses `ctx.waitUntil` (~30 s). Upgrade path: Cloudflare Queues.
- Tesseract/OpenCV OCR and real blockchain anchoring were removed in the port.
