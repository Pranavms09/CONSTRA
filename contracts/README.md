# CONSTRA EvidenceRegistry (MST Blockchain)

Tamper-evident registry of SHA-256 fingerprints for site photos (kind 1), delivery challans (2) and clearance certificates (3). Stores block time and the anchoring account. No personal data on-chain. Integration details: [../docs/CHAIN_INTEGRATION.md](../docs/CHAIN_INTEGRATION.md).

## Deployments

| Network | Chain ID | Address | Deploy tx |
|---|---|---|---|
| MST Testnet | 91562037 | [`0x9945391814a414c3cbcc0DDCBe98919Ab75c3F54`](https://testnet.mstscan.com/address/0x9945391814a414c3cbcc0DDCBe98919Ab75c3F54#code) (source verified) | [`0xb95b48bc3ee2756a…`](https://testnet.mstscan.com/tx/0xb95b48bc3ee2756ab8d9d95b0456f5e5459cd07dc571ba5be2b8fa4c1f485a0d) |
| MST Mainnet | 4646 | [`0x9945391814a414c3cbcc0DDCBe98919Ab75c3F54`](https://mstscan.com/address/0x9945391814a414c3cbcc0DDCBe98919Ab75c3F54#code) (source verified) | [`0x924a22dd…3273`](https://mstscan.com/tx/0x924a22ddaa8bd76ebf302cea86469fe57635506e09b51f96d7e59ed9f8f33273) |
| `AccessRegistry` testnet | 91562037 | [`0xBCC31B88E689a077F41a5718C853267262ac3373`](https://testnet.mstscan.com/address/0xBCC31B88E689a077F41a5718C853267262ac3373) | [`0x0d6d1267…1c60`](https://testnet.mstscan.com/tx/0x0d6d1267349da389fa8fb9a136460de8484837e584c06f6fde1ffacd44641c60) |
| `AccessRegistry` mainnet | 4646 | [`0x9b8d7e21f44DeCB92415F3644C0A0Ce831d63BF5`](https://mstscan.com/address/0x9b8d7e21f44DeCB92415F3644C0A0Ce831d63BF5#code) (source verified) | [`0xde2d0ccb…803e`](https://mstscan.com/tx/0xde2d0ccb6779a9f4ed4dbae53c45e0b134c3e9fb2d4b1f05df6c7cde8cac803e) |

Roles: `WALLET=0x… ROLE=3 npx hardhat run scripts/set-role.js --network mstMainnet` (0 none, 1 supervisor, 2 store, 3 auditor). Mainnet Auditor grant to the deployer: [`0x4133a625…19fa6`](https://mstscan.com/tx/0x4133a625d66c8aac7fcdb1ecfab648e9455275e03349cf6f4e136741e2919fa6).

`scripts/deploy.js` also writes these to `deployments.json`. Copy them here after deploying.

First app transaction (testnet): [`0xea286225008721f6…`](https://testnet.mstscan.com/tx/0xea286225008721f688860b74d7f418fa126599accd6da5ecf70c798167bb0f51), evidence photo anchored by the backend relayer, block 6639012.

## Setup

```bash
cd contracts
npm install
cp .env.example .env        # PRIVATE_KEY of a dedicated deployer wallet (never commit)
npm test                    # 23 tests
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
