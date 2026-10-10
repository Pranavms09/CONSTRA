import "@nomicfoundation/hardhat-toolbox";
import fs from "fs";
import path from "path";

// Helper to safely load environment variables from .env files without external dependencies
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  try {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx > 0) {
        const key = line.slice(0, eqIdx).trim();
        let val = line.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
  } catch {
    // Ignore read errors
  }
}

// Load env from contracts/.env, backend/.env, or root .env if present
loadEnvFile(path.resolve(".env"));
loadEnvFile(path.resolve("../backend/.env"));
loadEnvFile(path.resolve("../.env"));

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL || "";
const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || process.env.ANCHOR_PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

const accounts = [];
if (SEPOLIA_PRIVATE_KEY && SEPOLIA_PRIVATE_KEY.trim()) {
  const pk = SEPOLIA_PRIVATE_KEY.trim();
  accounts.push(pk.startsWith("0x") ? pk : `0x${pk}`);
}

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: "0.8.24",
  networks: {
    hardhat: {},
    sepolia: {
      url: SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      chainId: 11155111,
      accounts: accounts.length > 0 ? accounts : []
    }
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
