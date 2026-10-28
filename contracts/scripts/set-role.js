// Grants a portal role on the deployed AccessRegistry (0 none, 1 supervisor, 2 store in-charge, 3 auditor).
// Usage: WALLET=0x... ROLE=3 npx hardhat run scripts/set-role.js --network mstTestnet|mstMainnet
import fs from "fs";
import hre from "hardhat";

const deployments = JSON.parse(fs.readFileSync(new URL("../deployments.json", import.meta.url)));

async function main() {
  const network = hre.network.name;
  const entry = deployments[`${network}AccessRegistry`];
  if (!entry) throw new Error(`No AccessRegistry recorded for ${network} in deployments.json`);
  const wallet = hre.ethers.getAddress(process.env.WALLET ?? "");
  const role = Number(process.env.ROLE);
  if (![0, 1, 2, 3].includes(role)) throw new Error("ROLE must be 0, 1, 2 or 3");

  const registry = await hre.ethers.getContractAt("AccessRegistry", entry.address);
  const tx = await registry.setRole(wallet, role);
  await tx.wait();
  console.log(`roleOf(${wallet}) = ${await registry.roleOf(wallet)}\ntx: ${tx.hash}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
