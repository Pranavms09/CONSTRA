# MST Blockchain Reference (for CONSTRA)

Sources: MST Buildathon 2.0 guide, docs.mstblockchain.com (read 2026-10-27), live RPC probes.

## Networks

| | Testnet | Mainnet |
|---|---|---|
| RPC | `https://testnetrpc.mstblockchain.com` | `https://mariorpc.mstblockchain.com` |
| Chain ID | `91562037` (`0x5752035`) | `4646` (`0x1226`) |
| Symbol | tMSTC | MSTC |
| Explorer | https://testnet.mstscan.com | https://mstscan.com |
| Faucet | https://faucet.mstblockchain.com | — (organizers provide funds) |

Verified facts (live probes):
- EVM-compatible, Parlia Proof-of-Stake (BSC-style), ~3 s blocks.
- `eth_gasPrice` = 1 gwei; `baseFeePerGas` = 0. Docs: **legacy single `gasPrice` transactions only (type 0)**. Always send `gasPrice` (Hardhat: numeric `gasPrice`; viem: `type: "legacy"`; wallets: pass `gasPrice` in `eth_sendTransaction`).
- Both RPCs return `Access-Control-Allow-Origin: *` → browsers can call them directly.
- MSTScan is Blockscout (`/api`, `/api/v2/...`); contract verification uses Blockscout flow (no real API key). `npx hardhat verify --network mstTestnet <addr>` works (ignore the Etherscan v2 deprecation warning).
- Compile target `paris` (Hardhat default for solc 0.8.24 here) works; avoid exotic opcodes.

## Developer tools

| Tool | Use in CONSTRA |
|---|---|
| `@mstblockchain/mst-sdk` (JS) | Not used: thin ethers wrapper (Client/Provider/Signer). Worker uses **viem** (smaller, Workers-safe); frontend uses raw EIP-1193 + JSON-RPC. |
| `mst-sdk-python` | Not used (no Python left). |
| Vibe Kit `npx create-mst-app` | Not used as scaffold (existing app). Adopted its conventions: `PRIVATE_KEY` env, `deploy:testnet` / `deploy:mainnet` scripts, typed mainnet confirmation, `deployments.json`. Templates (`certificate`, `supplychain`, …) are useful references. |
| MCP `https://mcp.mstblockchain.com/sse` | Connected in Claude Code as `mst-mcp` (see below). |
| BridgeKey wallet | Integrated in the auditor UI (EIP-6963 discovery → EIP-1193). |

## MCP connection (Claude Code)

The server's OAuth metadata advertises `http://` URLs while serving `https://`, so Claude Code's built-in OAuth (`--client-id/--client-secret`) fails with *"Protected resource http://mcp.mstblockchain.com does not match expected https://…"*. Working setup:

1. Auth-code + PKCE against `https://mcp.mstblockchain.com/authorize` (auto-approves, redirects with `code`), client `mst-mcp-client` / secret from the Buildathon guide.
2. Exchange at `https://mcp.mstblockchain.com/token` → `access_token` (no refresh token, no expiry reported).
3. `claude mcp add --transport sse --scope local mst-mcp https://mcp.mstblockchain.com/sse -H "Authorization: Bearer <token>"` → `✔ Connected`.

Tools: `list_documents`, `read_document(filename)`, `search_documents(query)`. As of 2026-10-27 the document store is **empty** (`list_documents` → `[]`), so docs.mstblockchain.com (`/llms.txt`, append `.md` to any page) is the usable source. If the token stops working, repeat steps 1–3. SSE frames use CRLF line endings.

## BridgeKey

Official non-custodial MST wallet (Chrome extension `bfjojdcfenehemjgjlepdjomkpginlkg`, Android `com.bridgekey`). No public dApp API docs; it behaves as a standard injected EVM wallet. CONSTRA discovers it via EIP-6963 (`info.name`/`rdns` containing "bridgekey"), falls back to `window.ethereum`, then uses `eth_requestAccounts`, `wallet_switchEthereumChain` / `wallet_addEthereumChain` (4902), `personal_sign`, `eth_sendTransaction`. Code: `frontend/src/lib/mst.js`.

## Wallet sign-in (AccessRegistry)

MST-only: no Ethereum network or SIWE library. The Worker issues a plain-text challenge (site, wallet, MST chain ID, nonce, expiry); BridgeKey signs it with `personal_sign`; the Worker checks the signature with viem and reads `AccessRegistry.roleOf` from the MST RPC. Deploy: `cd contracts && BOOTSTRAP_AUDITOR_WALLET=0x… npm run deploy:access:testnet`, then set `ACCESS_REGISTRY_ADDRESS` and `ACCESS_REGISTRY_FROM_BLOCK` (deploy block) in `backend/wrangler.json`. `eth_getLogs` over 5000 blocks works on the testnet RPC (probed 2026-10-28).

## Buildathon requirements → where satisfied

| Requirement | CONSTRA |
|---|---|
| Meaningful MST usage | Portal roles live in `AccessRegistry` on MST and gate wallet sign-in. Every evidence photo, confirmed challan and clearance certificate hash is anchored in `EvidenceRegistry`; verification reads the chain; auditors sign certificates with their own wallet. |
| Testnet + mainnet deploy | `contracts/` `npm run deploy:testnet` / `deploy:mainnet`; addresses recorded in `contracts/deployments.json` and README. |
| Testnet tx hash | Any relayer `anchorMany` tx or auditor certificate tx (MSTScan link shown in UI/API). |
| Public repo + README | README "MST Blockchain Integration" section. |
| BridgeKey | Wallet sign-in for all roles, auditor role grants (`AccessRegistry.setRole`), wallet link + certificate signing. |
| No simulated txs | `CHAIN_MODE=mst` in production; `fake` only for keyless local dev. |
