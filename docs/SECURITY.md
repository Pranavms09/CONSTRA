# Security

**Product:** CONSTRA · **Version:** 2.0 (shipped build, 2026-10-28)
**Related:** [architecture.md](../architecture.md#trust-boundaries) · [TRD](TRD.md)

## Assets

Evidence photos and challans (R2), claim decisions and certificates (D1), user accounts and roles, the relayer private key, auditor wallets, audit logs.

## Threat actors

Dishonest subcontractor or supervisor (fake progress), store staff (inflated deliveries, diversion), colluding insider (self-approval, editing records after payment), external attacker (account takeover, API abuse).

## Threat model (STRIDE)

| Threat | Example | Control |
| --- | --- | --- |
| Spoofing | Forged token or wallet | Firebase JWKS verification; HMAC `sv-` sessions (24 h); single-use wallet challenge bound to site, address, chain ID, expiry |
| Tampering | Swap a photo after approval | SHA-256 on device and server; hash anchored on MST; D1 vs chain mismatch logged |
| Repudiation | "I never approved that" | Auditor signs the certificate anchor from BridgeKey; `audit_logs` for every action |
| Information disclosure | Read another project's files | Private R2; files only via authorized routes; non-members get 404 |
| Denial of service | Login or verify flooding | Workers rate limits 10/min per IP; analyze-image 10/min; 10–20 MB upload caps |
| Elevation of privilege | Self-assigned auditor role | Roles from D1 only; wallet users from `AccessRegistry`; role edits of wallet users refused in D1 |

## Fraud controls

| Fraud | Control |
| --- | --- |
| Off-site photo | Server geofence; GPS accuracy allowance capped at 50 m; mock locations blocked in app; approval re-checks EXIF GPS |
| Recycled photo | Fresh fix required; EXIF age ≤ 24 h; tag burned in before hashing |
| Altered upload | Server hash ≠ client hash → `HASH_MISMATCH` (critical) |
| Duplicate challan | File hash and vendor + number uniqueness |
| Inflated delivery | BOQ tolerance check after human confirm |
| Material diversion | Consumption vs verified progress; z-score |
| Self-approval | Approver ≠ submitter by id, email, name |
| Store hides alerts | Only auditors resolve/escalate; justification ≥ 5 chars, logged |
| Forged claim fields | Server sets ids, submitter, AI and EXIF verdicts; client values ignored |
| Prompt injection in images | AI prompt treats image text as data; AI output is advisory |

## Authentication

- Google sign-in requires a verified email; only accounts an auditor created can sign in.
- Passwords: PBKDF2, minimum 8 chars, current password required to change; set via `POST /auth/password`.
- Wallet sign-in: nonce deleted on read, 5 min expiry, signature recovered with viem, role read from MST.
- QR pairing: only the SHA-256 of the phone secret is stored; 5 min TTL; single claim; both screens show the same 8-char code to stop approve-a-stranger phishing; no token reaches the browser.
- `DEMO_MODE` is on for judging. Demo tokens are public, so `denyDemo` blocks them from user management, password changes, wallet links (which would authorize an MST anchorer) and certificate txs. Turn it off (`"false"`) after judging; demo uploads still spend relayer gas.
- Mobile stores the session in `flutter_secure_storage`.

## Authorization

- `requireRole` on every route; `ensureProjectAccess` for project-scoped data.
- Mutating routes all require login; public routes are health, login/challenge/pairing, chain config and verify (rate limited).
- Auditor-only: users, claim commands/submit, alert resolution, relayer control, role sync, certificate tx.
- CORS: exact origins from `FRONTEND_ORIGINS`; no wildcard.

## Uploads

- Magic-byte MIME checks (JPEG/PNG/WebP; challans also PDF); extensions ignored.
- Size limits: evidence 20 MB, challans `MAX_UPLOAD_MB` (10).
- Random or hash-based R2 keys; private buckets; challan `?token=` only for `<img>` with the same auth checks.

## Blockchain

- `EvidenceRegistry`: only owner and authorized anchorers write; zero hash, bad kind and duplicates revert.
- Auditor wallets are linked by signature before `setAnchorer`.
- Submitted certificate txs are checked: receipt success, sender, `Anchored` log hash and kind.
- `AccessRegistry`: only owner or Auditor wallets call `setRole`; revocation reaches sessions within one cron tick (`is_active = 0`).
- No personal data on-chain: hashes, kinds, times and addresses only.
- Simulated anchors (`CHAIN_MODE=fake`) are local-only and marked `simulated`.

## Secrets

`SECRET_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `BOOTSTRAP_ADMIN_*`, `ANCHOR_PRIVATE_KEY` live only in Worker secrets or git-ignored `.dev.vars`. Contract deploy key in git-ignored `contracts/.env`. Frontend vars are public by design (Firebase web config, API URL).

## Logging

`audit_logs` records logins, denials, uploads, alert actions, approvals and chain events with actor and IP. Cloudflare observability is enabled for the API.

## Security tests

Backend route tests (`backend/test/routes.test.ts`) cover: unverified or unregistered Firebase accounts, login required for the claims API, store staff cannot resolve alerts, project assignment validation, app password change, invalid quantities, wallet link by signature, challenge binding, wrong wallet / expired / missing challenge, no on-chain role, on-chain role beats the client's claim, QR pairing approval and single-use claim. Contract tests cover anchorer gating, duplicates, kinds and role management.

## Residual risks

- A compromised relayer key can anchor junk hashes (cannot change existing ones); rotate with `transferOwnership`.
- A rooted phone could fake GPS beyond mock-location detection; server geofence and auditor review remain.
- `waitUntil` tasks can be cut off; cron retries.
- Wallet sign-in with a real BridgeKey wallet is not yet verified end to end.
