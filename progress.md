# Progress

## Current objective
MST Buildathon 2.0 submission: CONSTRA on Cloudflare (Workers + D1 + R2) with MST Blockchain anchoring and on-chain roles.

## Completed
- Cloudflare stack live: web https://constra.pranavms09.workers.dev, API https://constra-api.pranavms09.workers.dev (`/health` 200, `/chain/config` mode `mst`, testnet).
- `EvidenceRegistry` relayer (D1 queue → `anchorMany`, cron + `waitUntil`), auditor-signed certificates, public `/verify`.
- `AccessRegistry` wallet sign-in, role sync, auditor `setRole` from BridgeKey; "GRANT ON MST" button for users who self-linked a wallet (no on-chain role yet).
- Flutter supervisor app: stamped + hashed capture, offline queue, QR/WalletConnect sign-in; photos auto-join claims.
- Docs rewritten to match shipped code (README, PRD, TRD, DESIGN, UI-UX, SECURITY, DB-SCHEMA); `scripts/check-docs.sh` checks word limits and links.

## Verified
- **Testnet** (chain 91562037): `EvidenceRegistry` `0x9945391814a414c3cbcc0DDCBe98919Ab75c3F54` (verified source); `AccessRegistry` `0xBCC31B88E689a077F41a5718C853267262ac3373`; app tx `0xea2862…0f51` (relayer `anchorMany`, block 6639012).
- **Mainnet** (chain 4646): `EvidenceRegistry` `0x9945391814a414c3cbcc0DDCBe98919Ab75c3F54` (tx `0x924a22dd…3273`, block 21731166, source verified); `AccessRegistry` `0x9b8d7e21f44DeCB92415F3644C0A0Ce831d63BF5` (tx `0xde2d0ccb…803e`, block 21731226, source verified); deployer `0xf185…8d60` granted Auditor (tx `0x4133a625…19fa6`, `roleOf` = 3).
- Tests: backend 32/32 + `tsc`; contracts 23/23; mobile 5/5 + `flutter analyze`; frontend build.
- Local E2E (Hardhat + `wrangler dev`): anchoring, verify, wallet link, `setAnchorer`, certificate tx.

## Not verified
- Real BridgeKey wallet sign-in end to end (web, QR pairing, WalletConnect); "GRANT ON MST" click-through in production (deployed, untested).
- Mobile app on a physical device. App running against mainnet.

## Blockers
None.

## Next actions
1. Auditor clicks GRANT ON MST for the friend's wallet; test BridgeKey sign-in.
2. Optional: switch the app to mainnet (`backend/wrangler.json` vars + `ACCESS_REGISTRY_FROM_BLOCK=21731226`, re-grant roles, `npm run deploy`).
3. Record the 2–3 min demo video; add its link to README.
4. Commit and push; submit links from README "Submission at a glance".
