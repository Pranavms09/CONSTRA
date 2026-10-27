# CONSTRA EvidenceRegistry Smart Contract

`EvidenceRegistry` is a minimal, tamper-evident smart contract for CONSTRA that anchors cryptographic SHA-256 fingerprints of confirmed photos, delivery challans, and issued audit certificates alongside immutable block timestamps.

**Guarantees & Non-Goals:**
- **Zero Personal / Sensitive Data**: No photos, filenames, amounts, user IDs, or challan contents are ever submitted on-chain.
- **Proof of Existence**: Anchoring proves that an exact file existed in that exact bitwise state at a specific time and has not changed since. It does not claim that a physical photo is genuine—only that the record is immutable and tamper-evident.
- **No Tokenomics**: No tokens, cryptocurrencies, NFTs, or user transaction fees.

---

## 1. Contract Specifications
- **Solidity Version**: `^0.8.24`
- **Source File**: `contracts/EvidenceRegistry.sol`
- **ABI Artifact**: `backend/app/abi/EvidenceRegistry.json`

### Key Functions
- `anchor(bytes32 h, uint8 kind)`: Anchors a single SHA-256 hash. Reverts if zero or already anchored.
- `anchorMany(bytes32[] calldata hs, uint8[] calldata kinds)`: Batches up to 50 hashes. Idempotent: skips duplicates and zero hashes so individual collisions do not revert the batch.
- `verify(bytes32 h)`: Public view returning `(uint256 time, uint8 kind)`. Returns `time = 0` if not anchored.
- `transferOwnership(address newOwner)`: Safely rotates contract owner to a non-zero address.

Kind mapping:
- `1`: Photo evidence
- `2`: Delivery challan
- `3`: Audit certificate

---

## 2. Deploying via Remix (Step-by-Step)

### Step 1: Open Remix Ethereum IDE
1. Open [https://remix.ethereum.org](https://remix.ethereum.org) in a Web3-enabled browser.
2. In the File Explorer workspace, create a new file named `EvidenceRegistry.sol` under `contracts/`.
3. Paste the contents of `contracts/EvidenceRegistry.sol`.

### Step 2: Compile the Contract
1. Switch to the **Solidity Compiler** tab (left sidebar).
2. Set the **Compiler Version** to `0.8.24` (or any compatible `0.8.24+`).
3. Under **Advanced Configurations**, ensure EVM Version is `default` or `cancun`/`shanghai`.
4. Click **Compile EvidenceRegistry.sol**.
5. Once compilation succeeds, click **ABI** at the bottom of the compilation panel to copy the ABI JSON. Verify that it matches `backend/app/abi/EvidenceRegistry.json`.

### Step 3: Deploy to Testnet (e.g. Sepolia, Polygon Amoy, Arbitrum Sepolia)
1. In MetaMask, switch your network to your desired testnet (e.g., Sepolia or Polygon Amoy).
2. Ensure your deploying wallet has testnet faucet tokens.
3. Switch to the **Deploy & Run Transactions** tab in Remix.
4. Set **Environment** to `Injected Provider - MetaMask`.
5. Verify your account address matches your throwaway testnet wallet.
6. Select contract `EvidenceRegistry - contracts/EvidenceRegistry.sol`.
7. Click **Deploy** and confirm the transaction in MetaMask.

### Step 4: Save Deployment Details
1. Once confirmed, copy the newly deployed contract address from Remix's "Deployed Contracts" section.
2. Update your backend configuration:
   ```env
   CHAIN_MODE=real
   RPC_URL=https://sepolia.infura.io/v3/<YOUR_INFURA_KEY>
   CHAIN_ID=11155111
   CONTRACT_ADDRESS=0x<DEPLOYED_CONTRACT_ADDRESS>
   ANCHOR_PRIVATE_KEY=<THROWAWAY_WALLET_PRIVATE_KEY>
   EXPLORER_TX_URL=https://sepolia.etherscan.io/tx/
   EXPLORER_ADDRESS_URL=https://sepolia.etherscan.io/address/
   ```

---

## 3. Reading the Contract on the Block Explorer

1. Navigate to your testnet block explorer (e.g. `https://sepolia.etherscan.io/address/<CONTRACT_ADDRESS>`).
2. Go to the **Contract** tab (verify the contract code if desired using Remix standard JSON or Hardhat verify).
3. Under **Read Contract**:
   - Query `verify(bytes32 h)` by entering the `0x`-prefixed 64-character hex SHA-256 string.
   - If anchored, it returns the Unix epoch timestamp in `time` and the entity kind in `kind`.
   - Query `owner()` to confirm the active authorized anchoring address.
4. Under **Events**:
   - Inspect `Anchored(bytes32 indexed hash, uint8 kind, uint256 time)` events emitted for each anchored evidence file.

---

## 4. Key Management & Production Security

> [!WARNING]
> For hackathon, testing, and staging environments, use a **throwaway testnet wallet** funded solely with faucet tokens. Never use a wallet holding mainnet assets.

### Transitioning to Production:
1. **Multi-Signature Ownership (Safe / Gnosis Safe)**:
   - For mainnet deployment, call `transferOwnership(safeAddress)` to transfer contract ownership to a multi-signature Safe requiring multiple signers (e.g., Lead Auditor + Head of Engineering).
2. **KMS / Hardware Security Module (HSM)**:
   - The automated anchoring worker wallet should be managed by AWS KMS, Google Cloud KMS, or HashiCorp Vault with strict least-privilege IAM policies, automated transaction rate limiting, and balance monitors.
3. **Emergency Key Rotation**:
   - If the anchoring worker private key is ever suspected of compromise, the multi-sig owner immediately calls `transferOwnership(newOperatorAddress)` to sever the compromised key's permissions without having to redeploy or migrate anchored state.
