# Progress

## Current objective
MST Buildathon Round 2: CONSTRA on Cloudflare (Workers + D1 + R2) with real MST Blockchain anchoring, testnet + mainnet deployment.

## Completed
- Cloudflare port (Hono Worker, D1, R2); Firestore/Render/Python removed.
- `mst-mcp` MCP server connected in Claude Code (bearer token workaround; server's doc store is empty). Docs read from docs.mstblockchain.com. Notes: `docs/MST-BLOCKCHAIN.md`.
- `EvidenceRegistry` v2: authorized anchorers, `anchoredBy`, kind validation; Hardhat networks `mstTestnet`/`mstMainnet` (legacy gasPrice), `scripts/deploy.js` → `deployments.json`.
- Worker relayer: D1 queue → `anchorMany` on MST, cron + `waitUntil`, receipts, retries, tamper detection, wallet link (`setAnchorer`), auditor-signed certificate verification.
- Frontend: BridgeKey (EIP-6963) wallet link + certificate signing in the certificate modal; public `/verify` page reading the contract directly.

## Verified
- **MST Testnet deploy:** `EvidenceRegistry` at `0x9945391814a414c3cbcc0DDCBe98919Ab75c3F54` (tx `0xb95b48bc3ee2756ab8d9d95b0456f5e5459cd07dc571ba5be2b8fa4c1f485a0d`, block 6617418, status 1, owner = deployer `0xf1854aE3…8d60`); source verified on testnet.mstscan.com. `backend/wrangler.json` `CONTRACT_ADDRESS` set.
- Contracts: 19/19 Hardhat tests.
- Backend: `tsc` clean, 16/16 vitest, dry-run bundle 238 KiB gzip.
- Local E2E (Hardhat chain + `wrangler dev`, CHAIN_MODE=mst): evidence anchored and confirmed; `/chain/verify` authentic; wallet link + `setAnchorer`; unauthorized wallet reverted; auditor certificate tx accepted.
- Live MST RPCs: chain IDs 91562037 / 4646, CORS `*`.
- Frontend `vite build` passes.

## Not verified
- MST mainnet deployment, first relayer anchor tx on testnet, real BridgeKey extension, Gemini, Firebase login, Cloudflare deploy.

## Blockers
- Mainnet MSTC from organizers.

## Next actions
1. Mainnet: `CONFIRM_MAINNET="yes, deploy to mainnet" npm run deploy:mainnet` once organizers fund MSTC.
2. `wrangler secret put ANCHOR_PRIVATE_KEY` (same deployer key); deploy API + frontend.
3. Submit one evidence photo, collect the testnet tx hash; fill README + `contracts/README.md` tables.
4. Test BridgeKey extension end-to-end; record 2–3 min demo video.
