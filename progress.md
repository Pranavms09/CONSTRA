# Progress

## Current objective
Run CONSTRA fully on Cloudflare (Workers + D1 + R2), free plan.

## Completed
- Python FastAPI backend replaced by Hono Worker in `backend/` (all routes ported, same JSON shapes and `{detail}` errors).
- SQLAlchemy/Alembic + Firestore replaced by D1 migrations; local `uploads/` + Cloudinary replaced by R2.
- Blockchain anchoring simulated in D1; anchor worker removed.
- Frontend: Firestore removed (Firebase Auth kept); API base URL centralized in `frontend/src/api/client.js`.
- Render config, Vercel config, Python code, Firestore rules removed. Mobile app local port 8000 → 8787.

## Verified
- `npm test` (backend): 16/16 unit tests pass (EXIF, fuzzy parity, anomaly, utils, PBKDF2).
- `tsc --noEmit` clean; `wrangler deploy --dry-run` bundles (~311 KiB).
- Local `wrangler dev` smoke tests: auth (demo, password, session), users, supervisor evidence (idempotency, hash mismatch, geofence alerts, private file access), store (upload, manual draft, optimistic lock, confirm + reconcile, issues + anomaly, stock/BOQ, alerts), claims (create, EXIF, commands, blockers, reject, approve, certificate), chain verify, CORS.
- Frontend `vite build` passes.

## Not verified
- Real Gemini calls (no API key locally), Firebase ID-token login, production deploy, Android app build.

## Next actions
1. Run `wrangler login`, create D1 + R2, set secrets, `npm run deploy` (see README).
2. Set `DEMO_MODE` to `"false"` before real use.
3. Test Gemini analysis/OCR with a real key; watch CPU-limit errors in Workers logs.
4. If `waitUntil` jobs time out, move AI/OCR to Cloudflare Queues.
