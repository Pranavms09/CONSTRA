// Deploys EvidenceRegistry and records the address + deploy tx hash in deployments.json.
// Usage: npx hardhat run scripts/deploy.js --network mstTestnet|mstMainnet
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
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Network ${network} (chainId ${chainId}), deployer ${deployer.address}, balance ${hre.ethers.formatEther(balance)}`);

  const registry = await hre.ethers.deployContract("EvidenceRegistry");
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  const txHash = registry.deploymentTransaction().hash;

  const file = "deployments.json";
  const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf-8")) : {};
  all[network] = { chainId, address, deployTxHash: txHash, deployer: deployer.address, deployedAt: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(all, null, 2) + "\n");

  const explorer = EXPLORERS[network];
  console.log(`EvidenceRegistry: ${address}`);
  console.log(`Deploy tx: ${txHash}`);
  if (explorer) console.log(`${explorer}/address/${address}\n${explorer}/tx/${txHash}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
