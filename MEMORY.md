# MEMORY

## Purpose / state
CONSTRA: construction milestone verification (evidence photos, challan OCR, BOQ reconciliation, anomaly alerts, auditor clearance) for the MST Buildathon 2.0. Status: [progress.md](progress.md).

## Key decisions
- Cloudflare: Hono Worker `constra-api` (`backend/`), D1 `constra-db`, R2 `constra-files`; frontend via Worker static assets (root `wrangler.json`).
- Blockchain: **MST Blockchain** (not Sepolia). `EvidenceRegistry` anchors photo/challan/certificate SHA-256; relayer in the Worker (cron + waitUntil); auditors sign certificates with BridgeKey. Simulated txs are disqualifying, so production uses `CHAIN_MODE=mst`.
- Firebase only for Auth. OCR via Gemini.
- Free plan: no base64/image decoding; viem for chain I/O.

## Constraints / pitfalls
- MST: legacy `gasPrice` txs only; chain IDs 91562037 (testnet) / 4646 (mainnet). Details: [docs/MST-BLOCKCHAIN.md](docs/MST-BLOCKCHAIN.md).
- `mst-mcp` OAuth metadata is http/https-mismatched; use the bearer-token setup in docs/MST-BLOCKCHAIN.md. Its doc store is empty; read docs.mstblockchain.com (`/llms.txt`, `.md` pages).
- Wrangler finds-up `wrangler.json` before a local `.jsonc`; keep `backend/wrangler.json`.
- D1 rejects `undefined` binds; booleans are 0/1.
- `DEMO_MODE` tokens bypass auth; disable for real data.
- `contracts/src/EvidenceRegistry.sol` is a symlink to `contracts/EvidenceRegistry.sol`.

## Docs
[architecture.md](architecture.md), [docs/CHAIN_INTEGRATION.md](docs/CHAIN_INTEGRATION.md), [docs/README.md](docs/README.md), [README.md](README.md).
