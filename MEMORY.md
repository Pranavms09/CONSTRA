# MEMORY

## Purpose / state
CONSTRA: construction milestone verification (evidence photos, challan OCR, BOQ reconciliation, anomaly alerts, auditor clearance) for the MST Buildathon 2.0. Status: [progress.md](progress.md).

## Key decisions
- Cloudflare: Hono Worker `constra-api` (`backend/`), D1 `constra-db`, R2 `constra-files`; frontend via Worker static assets (root `wrangler.json`).
- Blockchain: **MST Blockchain** (not Sepolia). `EvidenceRegistry` anchors photo/challan/certificate SHA-256; relayer in the Worker (cron + waitUntil); auditors sign certificates with BridgeKey. Portal roles: `AccessRegistry` on MST is the source of truth for wallet-linked users (BridgeKey sign-in); D1 only mirrors it. Simulated txs are disqualifying, so production uses `CHAIN_MODE=mst`.
- Firebase only for Auth. OCR via Gemini.
- Mobile: Flutter app in `mobile/` (supervisor-only). BridgeKey mobile has no known dApp API, so phone wallet sign-in = WalletConnect (`WC_PROJECT_ID`) or QR pairing approved by the desktop extension. GPS tag is burned into the photo before hashing, so the anchored hash covers it.
- Free plan: no base64/image decoding; viem for chain I/O.

## Constraints / pitfalls
- MST: legacy `gasPrice` txs only; chain IDs 91562037 (testnet) / 4646 (mainnet). Details: [docs/MST-BLOCKCHAIN.md](docs/MST-BLOCKCHAIN.md).
- Deployments (both chains, all verified): `contracts/deployments.json`. `EvidenceRegistry` has the same address on testnet and mainnet (same deployer nonce). Live app uses testnet. Grant roles: `contracts/scripts/set-role.js`.
- Run Hardhat commands inside `contracts/` (root `npx hardhat` pulls Hardhat 3, no config). Root `package.json` forwards `deploy:*`, `verify:mainnet`.
- A self-linked wallet has no `AccessRegistry` role → wallet login 403 until an auditor grants it.
- `mst-mcp` OAuth metadata is http/https-mismatched; use the bearer-token setup in docs/MST-BLOCKCHAIN.md. Its doc store is empty; read docs.mstblockchain.com (`/llms.txt`, `.md` pages).
- Wrangler finds-up `wrangler.json` before a local `.jsonc`; keep `backend/wrangler.json`.
- `GEMINI_MODEL=gemini-2.5-flash`: `gemini-flash-latest` (gemini-3.8-flash) took 187 s on a challan vs 4 s, beyond the ~30 s waitUntil budget.
- D1 caps compound SELECT terms: seed rows with `WITH u(...) AS (VALUES ...)`, not long `UNION ALL` chains.
- UI copy: say "text extractor" / "AI vision", never "OCR" or "Gemini" (user request).
- D1 rejects `undefined` binds; booleans are 0/1.
- `DEMO_MODE` tokens bypass auth: `false` in `wrangler.json`, `true` only in `.dev.vars`. Demo auditor could otherwise authorize an on-chain anchorer wallet.
- Never trust client-sent submitter, ids, AI or EXIF verdicts on claims; the server sets them.
- `contracts/src/*.sol` are symlinks to `contracts/*.sol`.
- Hackathon rule: only MST chain. Wallet sign-in uses a plain challenge, not SIWE/EIP-4361 naming.

## Docs
[architecture.md](architecture.md), [docs/README.md](docs/README.md) (index), [README.md](README.md). Check: `bash scripts/check-docs.sh`.
