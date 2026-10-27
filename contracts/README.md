# CONSTRA EvidenceRegistry (MST Blockchain)

Tamper-evident registry of SHA-256 fingerprints for site photos (kind 1), delivery challans (2) and clearance certificates (3). Stores block time and the anchoring account. No personal data on-chain. Integration details: [../docs/CHAIN_INTEGRATION.md](../docs/CHAIN_INTEGRATION.md).

## Deployments

| Network | Chain ID | Address | Deploy tx |
|---|---|---|---|
| MST Testnet | 91562037 | [`0x9945391814a414c3cbcc0DDCBe98919Ab75c3F54`](https://testnet.mstscan.com/address/0x9945391814a414c3cbcc0DDCBe98919Ab75c3F54#code) (source verified) | [`0xb95b48bc3ee2756a…`](https://testnet.mstscan.com/tx/0xb95b48bc3ee2756ab8d9d95b0456f5e5459cd07dc571ba5be2b8fa4c1f485a0d) |
| MST Mainnet | 4646 | _pending — run `npm run deploy:mainnet`_ | |

`scripts/deploy.js` also writes these to `deployments.json`. Copy them here after deploying.

## Setup

```bash
cd contracts
npm install
cp .env.example .env        # PRIVATE_KEY of a dedicated deployer wallet (never commit)
npm test                    # 19 tests
npm run compile
```

Get testnet tMSTC from https://faucet.mstblockchain.com.

## Deploy

```bash
npm run deploy:testnet
CONFIRM_MAINNET="yes, deploy to mainnet" npm run deploy:mainnet
npm run verify:testnet -- <address>     # MSTScan (Blockscout)
```

From the repo root, `npm run deploy:testnet` / `npm run deploy:mainnet` forward to these scripts.

Hardhat networks `mstTestnet` / `mstMainnet` send legacy `gasPrice` transactions (MST has no EIP-1559 fees). Override RPCs with `MST_TESTNET_RPC_URL`, `MST_MAINNET_RPC_URL`, gas with `MST_GAS_PRICE_GWEI`.

The deployer becomes `owner`. Use the same key as the backend relayer (`ANCHOR_PRIVATE_KEY`) or call `transferOwnership(relayer)` afterwards: only the owner can `setAnchorer` for auditor wallets.

## Functions

| Function | Access | Notes |
|---|---|---|
| `anchor(bytes32 h, uint8 kind)` | owner / anchorer | Reverts on zero hash, invalid kind, duplicate |
| `anchorMany(bytes32[] hs, uint8[] kinds)` | owner / anchorer | 1–50 items; skips zero/invalid/duplicates |
| `verify(bytes32 h)` | view | `(time, kind, by)`; `time = 0` if unknown |
| `setAnchorer(address, bool)` | owner | Authorizes auditor wallets (BridgeKey) |
| `transferOwnership(address)` | owner | |

Events: `Anchored(hash, kind, time, by)`, `AnchorerUpdated(account, allowed)`, `OwnershipTransferred`.

`src/EvidenceRegistry.sol` is a symlink to `./EvidenceRegistry.sol`.
