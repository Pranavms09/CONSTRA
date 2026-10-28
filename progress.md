# Progress

## Current objective
MST Buildathon Round 2: CONSTRA on Cloudflare (Workers + D1 + R2) with real MST Blockchain anchoring, testnet + mainnet deployment.

## Completed
- Cloudflare port (Hono Worker, D1, R2); Firestore/Render/Python removed.
- `EvidenceRegistry` v2: authorized anchorers, `anchoredBy`, kind validation; Hardhat networks `mstTestnet`/`mstMainnet` (legacy gasPrice), `scripts/deploy.js` → `deployments.json`.
- Worker relayer: D1 queue → `anchorMany` on MST (cron + `waitUntil`), receipts, retries, `setAnchorer`, auditor-signed certificates.
- Blockchain role auth: `AccessRegistry` contract (+ tests, `deploy:access:*`), `/auth/wallet/challenge|login`, cron/`/chain/roles/sync` RoleSet mirror, migration `0004_wallet_auth.sql`, "Sign in with BridgeKey" on login, auditor roster grants/revokes roles via BridgeKey `setRole`.
- Flutter supervisor app (`mobile/`, replaced the Kotlin app): live-GPS camera, tag burned into JPEG + on-device SHA-256, offline queue, evidence/anchor status, BridgeKey sign-in via WalletConnect or QR pairing (`/auth/wallet/pair*`, web `/wallet-pair`).
- Mobile photos auto-join a per-stage claim on the Claim Audit Desk.
- Supervisor web "Account & App Login" tab: `POST /auth/password` sets/changes the D1 password the mobile app signs in with.
- Frontend: BridgeKey (EIP-6963) wallet link + certificate signing in the certificate modal; public `/verify` page reading the contract directly.
- Security audit fixes: verified email for Firebase, auditor-created accounts only, login on claims API with server-set ids/verdicts, approval re-checks EXIF geofence, auditor-only alert resolution, GPS allowance ≤50 m, image analysis login + 10/min, 24 h sessions, `DEMO_MODE=false` in production.

## Verified
- **First MST testnet app tx:** `0xea286225008721f688860b74d7f418fa126599accd6da5ecf70c798167bb0f51` (block 6639012): relayer `anchorMany` for evidence #1; `verify()` and `/chain/verify` authentic.
- **AccessRegistry testnet deploy:** `0xBCC31B88E689a077F41a5718C853267262ac3373` (tx `0x0d6d1267…1c60`, block 6640378); Auditor grant to deployer `0xf185…8d60` (tx `0xcf8275c0…fae`), `roleOf` = 3. Set in `backend/wrangler.json`.
- Local worker vs live MST: no-role wallet login 403 (real `roleOf`), nonce replay 401, role sync 200.
- **MST Testnet deploy:** `EvidenceRegistry` at `0x9945391814a414c3cbcc0DDCBe98919Ab75c3F54` (tx `0xb95b48bc…5a0d`, block 6617418, owner = deployer); source verified on testnet.mstscan.com; set in `backend/wrangler.json`.
- Contracts: 23/23 Hardhat tests (incl. AccessRegistry).
- Mobile: `flutter analyze` clean, 5/5 `flutter test` (geofence, stamp + hash, login UI).
- Backend: `tsc` clean, 32/32 vitest; local E2E: app password login; 2 mobile uploads → one claim with 2 photos, auditor photo 200 (no login 401) (`test/routes.test.ts` guards fail on pre-fix code).
- Local E2E (Hardhat chain + `wrangler dev`, CHAIN_MODE=mst): evidence anchored and confirmed; `/chain/verify` authentic; wallet link + `setAnchorer`; unauthorized wallet reverted; auditor certificate tx accepted.
- Frontend `vite build` passes. Migrations 0001–0007 apply locally.

## Not verified
- Successful wallet sign-in with a real BridgeKey wallet (web, phone pairing, WalletConnect); auditor `setRole` from the UI; mobile app on a real device.
- MST mainnet deployment, real BridgeKey extension, Gemini, Firebase login, Cloudflare deploy.

## Blockers
- Mainnet MSTC from organizers.

## Next actions
0. `npm run deploy` (migration 0008 backfills mobile photos into claims); auditor links BridgeKey wallet; grant it Auditor on AccessRegistry unless it is the deployer.
1. Mainnet: `CONFIRM_MAINNET="yes, deploy to mainnet" npm run deploy:mainnet` once organizers fund MSTC.
2. `wrangler secret put ANCHOR_PRIVATE_KEY` (same deployer key); deploy API + frontend.
3. Test BridgeKey extension end-to-end; record 2–3 min demo video.
