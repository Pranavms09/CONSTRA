// Deploys AccessRegistry, optionally grants BOOTSTRAP_AUDITOR_WALLET the Auditor role, and records it in deployments.json.
// Usage: npx hardhat run scripts/deploy-access.js --network mstTestnet|mstMainnet
// Mainnet additionally requires CONFIRM_MAINNET="yes, deploy to mainnet".
import fs from "fs";
import hre from "hardhat";

const EXPLORERS = { mstTestnet: "https://testnet.mstscan.com", mstMainnet: "https://mstscan.com" };

async function main() {
  const network = hre.network.name;
  if (network === "mstMainnet" && process.env.CONFIRM_MAINNET !== "yes, deploy to mainnet") {
    throw new Error('Refusing mainnet deploy: set CONFIRM_MAINNET="yes, deploy to mainnet"');
  }
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error("PRIVATE_KEY is not set in contracts/.env");
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  console.log(`Network ${network} (chainId ${chainId}), deployer ${deployer.address}`);

  const registry = await hre.ethers.deployContract("AccessRegistry");
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  const deployTx = registry.deploymentTransaction();
  const deployBlock = (await deployTx.wait()).blockNumber;

  let grantTxHash = null;
  const bootstrap = process.env.BOOTSTRAP_AUDITOR_WALLET?.trim();
  if (bootstrap) {
    const tx = await registry.setRole(hre.ethers.getAddress(bootstrap), 3);
    await tx.wait();
    grantTxHash = tx.hash;
  }

  const file = "deployments.json";
  const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf-8")) : {};
  all[`${network}AccessRegistry`] = {
    chainId, address, deployTxHash: deployTx.hash, deployBlock, deployer: deployer.address,
    bootstrapAuditor: bootstrap || null, grantTxHash, deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(all, null, 2) + "\n");

  const explorer = EXPLORERS[network];
  console.log(`AccessRegistry: ${address} (block ${deployBlock})`);
  console.log(`Set backend/wrangler.json ACCESS_REGISTRY_ADDRESS=${address} ACCESS_REGISTRY_FROM_BLOCK=${deployBlock}`);
  if (explorer) console.log(`${explorer}/address/${address}\n${explorer}/tx/${deployTx.hash}${grantTxHash ? `\n${explorer}/tx/${grantTxHash}` : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
