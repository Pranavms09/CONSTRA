import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import { linkWallet } from "../lib/mst";

const SKIP_KEY = "constra_wallet_link_skipped";
// shortcut: test-mode skip exists because one BridgeKey wallet cannot hold three roles; set VITE_WALLET_LINK_TEST_SKIP=false to make linking strictly mandatory.
const TEST_SKIP_ALLOWED = import.meta.env.VITE_WALLET_LINK_TEST_SKIP !== "false";

const readSkip = () => {
  try {
    return sessionStorage.getItem(SKIP_KEY) === "1";
  } catch {
    return false;
  }
};

/** Blocks role dashboards until an email/Google account links a BridgeKey wallet (demo sessions are exempt). */
export const WalletLinkGate = ({ children }) => {
  const { user, updateUser, logout } = useAuth();
  const [skipped, setSkipped] = useState(readSkip);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  let isDemo = false;
  try {
    isDemo = localStorage.getItem("siteverify_token")?.startsWith("demo-") ?? false;
  } catch {
    // storage blocked: treat as a real session
  }
  if (!user || user.wallet_address || isDemo || skipped) return children;

  const handleLink = async () => {
    setBusy(true);
    setError(null);
    try {
      const { wallet_address } = await linkWallet();
      updateUser({ wallet_address });
    } catch (err) {
      setError(err?.code === 4001 ? "Signature request was rejected in BridgeKey." : err?.message || "Failed to link wallet.");
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = () => {
    try {
      sessionStorage.setItem(SKIP_KEY, "1");
    } catch {
      // skip lasts for this page view only
    }
    setSkipped(true);
  };

  return (
    <div className="min-h-screen bg-[#E6E2DD] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="wallet-gate-title">
      <div className="w-full max-w-md bg-[#F2ECE6] border-2 border-[#101010] shadow-[6px_6px_0px_#101010] p-6 space-y-4 text-[#101010]">
        <p className="font-label-code text-[11px] uppercase tracking-widest text-[#5F5E5E]">ACCESS AUDIT // WALLET REQUIRED</p>
        <h2 id="wallet-gate-title" className="font-headline-md text-headline-md font-bold uppercase">Link your BridgeKey wallet</h2>
        <p className="font-body-sm text-body-sm">
          Signed in as <strong>{user.email}</strong>. CONSTRA access is verified on MST Blockchain, so every account must link a
          BridgeKey wallet before continuing. You will sign one message; no transaction or fee.
        </p>

        {error && (
          <div className="p-3 bg-[#ffdad6] border border-[#ba1a1a] text-[#ba1a1a] font-label-code text-xs uppercase">{error}</div>
        )}

        <button
          type="button"
          onClick={handleLink}
          disabled={busy}
          className="w-full py-3 px-6 bg-[#101010] hover:bg-[#FCBC18] text-[#FCBC18] hover:text-[#101010] border border-[#101010] font-headline-md font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-colors cursor-pointer disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
          {busy ? "WAITING FOR BRIDGEKEY..." : "LINK BRIDGEKEY WALLET"}
        </button>

        {TEST_SKIP_ALLOWED && (
          <button
            type="button"
            onClick={handleSkip}
            disabled={busy}
            className="w-full py-2 px-4 border border-dashed border-[#101010] font-label-code text-xs uppercase font-bold cursor-pointer hover:bg-[#E6E2DD] disabled:opacity-50"
          >
            ⚡ DEV TEST MODE: CONTINUE WITHOUT WALLET
          </button>
        )}

        <button type="button" onClick={logout} className="w-full font-label-code text-xs uppercase underline cursor-pointer">
          Sign out
        </button>
      </div>
    </div>
  );
};
