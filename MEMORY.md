# MEMORY

## Purpose / state
CONSTRA: construction milestone verification (evidence photos, challan OCR, BOQ reconciliation, anomaly alerts, auditor clearance) for the MST Buildathon 2.0. Status: [progress.md](progress.md).

## Key decisions
- Cloudflare: Hono Worker `constra-api` (`backend/`), D1 `constra-db`, R2 `constra-files`; frontend via Worker static assets (root `wrangler.json`).
- Blockchain: **MST Blockchain** (not Sepolia). `EvidenceRegistry` anchors photo/challan/certificate SHA-256; relayer in the Worker (cron + waitUntil); auditors sign certificates with BridgeKey. Portal roles: `AccessRegistry` on MST is the source of truth for wallet-linked users (BridgeKey sign-in); D1 only mirrors it. Simulated txs are disqualifying, so production uses `CHAIN_MODE=mst`.
- Firebase only for Auth. OCR via Gemini.
- Free plan: no base64/image decoding; viem for chain I/O.

## Constraints / pitfalls
- MST: legacy `gasPrice` txs only; chain IDs 91562037 (testnet) / 4646 (mainnet). Details: [docs/MST-BLOCKCHAIN.md](docs/MST-BLOCKCHAIN.md).
- `mst-mcp` OAuth metadata is http/https-mismatched; use the bearer-token setup in docs/MST-BLOCKCHAIN.md. Its doc store is empty; read docs.mstblockchain.com (`/llms.txt`, `.md` pages).
- Wrangler finds-up `wrangler.json` before a local `.jsonc`; keep `backend/wrangler.json`.
- `GEMINI_MODEL=gemini-2.5-flash`: `gemini-flash-latest` (gemini-3.8-flash) took 187 s on a challan vs 4 s, beyond the ~30 s waitUntil budget.
- D1 rejects `undefined` binds; booleans are 0/1.
- `DEMO_MODE` tokens bypass auth: `false` in `wrangler.json`, `true` only in `.dev.vars`. Demo auditor could otherwise authorize an on-chain anchorer wallet.
- Never trust client-sent submitter, ids, AI or EXIF verdicts on claims; the server sets them.
- `contracts/src/*.sol` are symlinks to `contracts/*.sol`.
- Hackathon rule: only MST chain. Wallet sign-in uses a plain challenge, not SIWE/EIP-4361 naming.

## Docs
[architecture.md](architecture.md), [docs/CHAIN_INTEGRATION.md](docs/CHAIN_INTEGRATION.md), [docs/README.md](docs/README.md), [README.md](README.md).
