# Documentation Checklist

Run `bash scripts/check-docs.sh` before each submission or release (word limits + broken relative links).

| Item | Status |
| --- | --- |
| README: live links, contract addresses (testnet + mainnet), tx hashes | ✅ |
| PRD, TRD, DESIGN, UI-UX, SECURITY, DB-SCHEMA match shipped code | ✅ 2026-10-29 |
| architecture.md: components, flows, trust boundaries | ✅ |
| CHAIN_INTEGRATION + MST-BLOCKCHAIN: relayer, wallet flows, networks | ✅ |
| contracts/README: deployments, functions, test count | ✅ |
| mobile/README: run, sign-in, dart-defines | ✅ |
| progress.md: status, verified results, next actions | ✅ |
| MEMORY.md: decisions, pitfalls | ✅ |
| No secrets in docs (keys, passwords, tokens) | ✅ |
| Word limits (CLAUDE.md section B) | `scripts/check-docs.sh` |
| Demo video link in README | ⏳ add after recording |

Update rule: any change to code, config, contracts or deployments updates the affected docs in the same commit.
