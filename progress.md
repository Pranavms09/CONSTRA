# Progress

## Current objective
MST Buildathon Round 2: CONSTRA on Cloudflare (Workers + D1 + R2) with real MST Blockchain anchoring, testnet + mainnet deployment.

## Completed
- Cloudflare port (Hono Worker, D1, R2); Firestore/Render/Python removed.
- `mst-mcp` MCP server connected in Claude Code (bearer token workaround; server's doc store is empty). Docs read from docs.mstblockchain.com. Notes: `docs/MST-BLOCKCHAIN.md`.
- `EvidenceRegistry` v2: authorized anchorers, `anchoredBy`, kind validation; Hardhat networks `mstTestnet`/`mstMainnet` (legacy gasPrice), `scripts/deploy.js` → `deployments.json`.
- Worker relayer: D1 queue → `anchorMany` on MST, cron + `waitUntil`, receipts, retries, tamper detection, wallet link (`setAnchorer`), auditor-signed certificate verification.
- Blockchain role auth: `AccessRegistry` contract (+ tests, `deploy:access:*`), `/auth/wallet/challenge|login`, cron/`/chain/roles/sync` RoleSet mirror, migration `0004_wallet_auth.sql`, "Sign in with BridgeKey" on login, auditor roster grants/revokes roles via BridgeKey `setRole`.
- Frontend: BridgeKey (EIP-6963) wallet link + certificate signing in the certificate modal; public `/verify` page reading the contract directly.
- Security audit fixes: verified email required for all Firebase providers; no self-registration except bootstrap auditor; claims API needs login (supervisor creates, auditor runs checks/decides), server-made claim ids, no project/stage fallback; approval re-checks photo EXIF geofence; claim VLM command calls Gemini (no fake values); only auditors resolve alerts; qty must be > 0; GPS accuracy allowance capped at 50 m, geofence alert `high`; image analysis needs login + 10/min limit; session tokens expire after 24 h; `DEMO_MODE=false` in `wrangler.json` (true only in `.dev.vars`); email login uses `/auth/login-password`, self sign-up disabled.

## Verified
- **First MST testnet app tx:** `0xea286225008721f688860b74d7f418fa126599accd6da5ecf70c798167bb0f51` (block 6639012, status 1): relayer `anchorMany` for evidence #1; on-chain `verify()` returns kind 1, anchored by deployer; `/chain/verify` authentic.
- **AccessRegistry testnet deploy:** `0xBCC31B88E689a077F41a5718C853267262ac3373` (tx `0x0d6d1267…1c60`, block 6640378); Auditor grant to deployer `0xf185…8d60` (tx `0xcf8275c0…fae`), `roleOf` = 3. Set in `backend/wrangler.json`.
- Local worker vs live MST: no-role wallet login 403 (real `roleOf`), nonce replay 401, role sync 200.
- **MST Testnet deploy:** `EvidenceRegistry` at `0x9945391814a414c3cbcc0DDCBe98919Ab75c3F54` (tx `0xb95b48bc3ee2756ab8d9d95b0456f5e5459cd07dc571ba5be2b8fa4c1f485a0d`, block 6617418, status 1, owner = deployer `0xf1854aE3…8d60`); source verified on testnet.mstscan.com. `backend/wrangler.json` `CONTRACT_ADDRESS` set.
- Contracts: 23/23 Hardhat tests (incl. AccessRegistry).
- Backend: `tsc` clean, 26/26 vitest (5 wallet sign-in: challenge, wrong signer, expired/missing nonce, no on-chain role, chain role beats claimed role) (`test/routes.test.ts` guards fail on pre-fix code).
- Local E2E (Hardhat chain + `wrangler dev`, CHAIN_MODE=mst): evidence anchored and confirmed; `/chain/verify` authentic; wallet link + `setAnchorer`; unauthorized wallet reverted; auditor certificate tx accepted.
- Frontend `vite build` passes. Migration 0004 applies locally; case-insensitive duplicate wallet rejected.

## Not verified
- Successful wallet sign-in with a real BridgeKey wallet; auditor `setRole` from the UI.
- MST mainnet deployment, real BridgeKey extension, Gemini, Firebase login, Cloudflare deploy.

## Blockers
- Mainnet MSTC from organizers.

## Next actions
0. `npm run db:migrate:remote` (0004); deploy; auditor links BridgeKey wallet; grant it Auditor on AccessRegistry if it is not the deployer.
1. Mainnet: `CONFIRM_MAINNET="yes, deploy to mainnet" npm run deploy:mainnet` once organizers fund MSTC.
2. `wrangler secret put ANCHOR_PRIVATE_KEY` (same deployer key); deploy API + frontend.
3. Test BridgeKey extension end-to-end; record 2–3 min demo video.
