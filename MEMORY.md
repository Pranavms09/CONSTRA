# MEMORY

## Purpose / state
CONSTRA: construction milestone verification (evidence photos, challan OCR, BOQ reconciliation, anomaly alerts, auditor clearance). Ported 2026-10-27 from FastAPI/Render to Cloudflare. Status: [progress.md](progress.md).

## Key decisions
- Backend: Hono Worker `constra-api` (`backend/`), D1 `constra-db`, R2 `constra-files`. Frontend: Worker static assets (`wrangler.json` at root).
- Firestore removed entirely; Firebase used only for Auth.
- Blockchain anchoring is simulated (D1 `chain_anchors`, `0xFAKE…` tx).
- OCR = Gemini (optional Claude for images); Tesseract/OpenCV dropped.
- Target free plan: avoid CPU-heavy work (no base64, no image decode).

## Constraints / pitfalls
- Wrangler finds-up `wrangler.json` before a local `wrangler.jsonc`; backend config must be `backend/wrangler.json` or the root frontend config is used.
- D1 rejects `undefined` binds; use helpers in `backend/src/db.ts`.
- D1 booleans are 0/1; convert in response mappers.
- `DEMO_MODE` tokens bypass auth; disable for real data.

## Docs
[architecture.md](architecture.md), [README.md](README.md), numbered spec docs at repo root.
