// MST Blockchain client helpers: BridgeKey (EIP-1193) wallet + direct EvidenceRegistry reads.
// No web3 library needed: the two calls we make are encoded by hand.
import { apiFetch } from "../api/client";

// keccak256 selectors of EvidenceRegistry functions (see contracts/EvidenceRegistry.sol).
const SELECTOR_ANCHOR = "0xa25e29d7"; // anchor(bytes32,uint8)
const SELECTOR_VERIFY = "0x75e36616"; // verify(bytes32)
export const KIND_LABELS = { 1: "Photo evidence", 2: "Delivery challan", 3: "Clearance certificate" };

let configPromise = null;
export function getChainConfig() {
  configPromise ??= apiFetch("/chain/config").catch((err) => {
    configPromise = null;
    throw err;
  });
  return configPromise;
}

const toHexChainId = (id) => `0x${Number(id).toString(16)}`;
const hex32 = (sha) => sha.replace(/^0x/, "").toLowerCase().padStart(64, "0");

async function rpc(url, method, params) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "MST RPC error");
  return data.result;
}

export async function sha256OfFile(file) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Reads EvidenceRegistry.verify(hash) straight from the MST RPC, without trusting the CONSTRA backend. */
export async function readRegistry(sha) {
  const cfg = await getChainConfig();
  if (!cfg.contract_address) throw new Error("EvidenceRegistry address is not configured on the server.");
  const out = (await rpc(cfg.rpc_url, "eth_call", [{ to: cfg.contract_address, data: SELECTOR_VERIFY + hex32(sha) }, "latest"])).slice(2);
  const time = parseInt(out.slice(0, 64), 16);
  return {
    anchored: time > 0,
    time: time ? new Date(time * 1000).toISOString() : null,
    kind: parseInt(out.slice(64, 128), 16),
    by: time ? `0x${out.slice(152, 192)}` : null,
    contract: cfg.contract_address,
    explorer: cfg.explorer_url,
  };
}

/**
 * Finds the wallet via EIP-6963 announcements, preferring BridgeKey (official MST wallet),
 * and falls back to the legacy injected window.ethereum provider.
 */
export async function discoverWallet() {
  const found = [];
  const onAnnounce = (e) => found.push(e.detail);
  window.addEventListener("eip6963:announceProvider", onAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  await new Promise((r) => setTimeout(r, 300));
  window.removeEventListener("eip6963:announceProvider", onAnnounce);

  const bridgekey = found.find((p) => /bridgekey/i.test(`${p.info?.name} ${p.info?.rdns}`));
  const pick = bridgekey ?? found[0];
  if (pick) return { provider: pick.provider, name: pick.info?.name ?? "Wallet" };
  if (window.ethereum) return { provider: window.ethereum, name: window.ethereum.isBridgeKey ? "BridgeKey" : "Injected wallet" };
  throw new Error("No wallet found. Install the BridgeKey extension (bridgekey.io) and reload.");
}

/** Connects the wallet and switches it to the configured MST network (adding it if missing). */
export async function connectWallet() {
  const cfg = await getChainConfig();
  const { provider, name } = await discoverWallet();
  const [address] = await provider.request({ method: "eth_requestAccounts" });
  const chainId = toHexChainId(cfg.chain_id);
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (err) {
    if (err?.code !== 4902) throw err;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId,
        chainName: `MST ${cfg.network === "mainnet" ? "Mainnet" : "Testnet"}`,
        nativeCurrency: { name: "MSTC", symbol: cfg.currency_symbol, decimals: 18 },
        rpcUrls: [cfg.rpc_url],
        blockExplorerUrls: [cfg.explorer_url],
      }],
    });
  }
  return { provider, name, address, cfg };
}

/** Proves wallet ownership to the backend (personal_sign); the relayer then authorizes it on-chain. */
export async function linkWallet() {
  const { provider, address } = await connectWallet();
  const { message } = await apiFetch(`/chain/wallet/message?address=${address}`);
  const signature = await provider.request({ method: "personal_sign", params: [message, address] });
  return apiFetch("/chain/wallet", { method: "POST", body: JSON.stringify({ address, signature }) });
}

async function waitForReceipt(rpcUrl, txHash, timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const receipt = await rpc(rpcUrl, "eth_getTransactionReceipt", [txHash]);
    if (receipt) return receipt;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Timed out waiting for the MST transaction to be mined.");
}

/** Auditor signs anchor(certificateHash, 3) from BridgeKey, then the backend checks the receipt on MST. */
export async function signCertificateOnChain(certificateId, certificateHash) {
  const { provider, address, cfg } = await connectWallet();
  // MST uses legacy single gasPrice transactions; passing gasPrice keeps wallets from sending EIP-1559 txs.
  const gasPrice = await rpc(cfg.rpc_url, "eth_gasPrice", []);
  const txHash = await provider.request({
    method: "eth_sendTransaction",
    params: [{ from: address, to: cfg.contract_address, data: SELECTOR_ANCHOR + hex32(certificateHash) + "3".padStart(64, "0"), gasPrice }],
  });
  const receipt = await waitForReceipt(cfg.rpc_url, txHash);
  if (receipt.status !== "0x1") throw new Error("Transaction reverted on MST (is this wallet authorized?)");
  return apiFetch(`/chain/certificates/${certificateId}/onchain`, { method: "POST", body: JSON.stringify({ tx_hash: txHash }) });
}
