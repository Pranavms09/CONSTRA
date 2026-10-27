import "@nomicfoundation/hardhat-toolbox";
import fs from "fs";
import path from "path";

// Load contracts/.env without extra dependencies (never commit it).
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const line = rawLine.trim();
    const eq = line.indexOf("=");
    if (!line || line.startsWith("#") || eq < 1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile(path.resolve(".env"));

const pk = (process.env.PRIVATE_KEY || "").trim();
const accounts = pk ? [pk.startsWith("0x") ? pk : `0x${pk}`] : [];
// MST uses the legacy single gasPrice model; a numeric gasPrice makes Hardhat send legacy (type 0) txs.
const gasPrice = Math.round(Number(process.env.MST_GAS_PRICE_GWEI || "1") * 1e9);

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    hardhat: {},
    mstTestnet: {
      url: process.env.MST_TESTNET_RPC_URL || "https://testnetrpc.mstblockchain.com",
      chainId: 91562037,
      accounts,
      gasPrice,
    },
    mstMainnet: {
      url: process.env.MST_MAINNET_RPC_URL || "https://mariorpc.mstblockchain.com",
      chainId: 4646,
      accounts,
      gasPrice,
    },
  },
  // MSTScan is Blockscout-based; it does not need a real API key.
  etherscan: {
    apiKey: { mstTestnet: "blockscout", mstMainnet: "blockscout" },
    customChains: [
      { network: "mstTestnet", chainId: 91562037, urls: { apiURL: "https://testnet.mstscan.com/api", browserURL: "https://testnet.mstscan.com" } },
      { network: "mstMainnet", chainId: 4646, urls: { apiURL: "https://mstscan.com/api", browserURL: "https://mstscan.com" } },
    ],
  },
  sourcify: { enabled: false },
  paths: { sources: "./src", tests: "./test", cache: "./cache", artifacts: "./artifacts" },
};
