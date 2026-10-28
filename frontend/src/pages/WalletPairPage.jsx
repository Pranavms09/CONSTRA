import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { approvePhonePairing, pairingCode } from "../lib/mst";

// Opened from the QR code on the CONSTRA mobile app: BridgeKey on this computer signs the phone in.
export const WalletPairPage = () => {
  const [params] = useSearchParams();
  const pairId = params.get("id") ?? "";
  const [state, setState] = useState({ busy: false, error: null, done: null });

  const approve = async () => {
    setState({ busy: true, error: null, done: null });
    try {
      setState({ busy: false, error: null, done: await approvePhonePairing(pairId) });
    } catch (err) {
      // EIP-1193 code 4001: the user rejected the request in BridgeKey.
      setState({ busy: false, error: err?.code === 4001 ? "Signature request was rejected in BridgeKey." : err?.message || "Could not approve the phone sign-in.", done: null });
    }
  };

  return (
    <div className="min-h-screen bg-[#F2ECE6] text-[#101010] px-4 py-10">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-2xl uppercase">Phone sign-in</h1>
          <Link to="/" className="underline text-sm">Home</Link>
        </div>
        {!pairId ? (
          <p className="text-[#ba1a1a] font-bold text-sm">Missing pairing id. Scan the QR code shown in the CONSTRA mobile app.</p>
        ) : state.done ? (
          <div className="border-2 border-[#296a49] bg-white p-4 space-y-1">
            <p className="font-bold">✔ Phone approved</p>
            <p className="text-sm">Signed in as {state.done.full_name} ({state.done.role}). Return to your phone.</p>
          </div>
        ) : (
          <div className="border-2 border-[#101010] bg-white p-4 space-y-4">
            <p className="text-sm">Your phone must show this code:</p>
            <p className="font-mono text-3xl font-bold tracking-widest text-center">{pairingCode(pairId)}</p>
            <p className="text-xs text-[#ba1a1a]">
              Only approve if you started this sign-in on your own phone just now. Approving signs that phone in with your wallet's role.
            </p>
            <button type="button" onClick={approve} disabled={state.busy} className="w-full py-3 bg-[#101010] text-[#F2ECE6] text-sm font-bold uppercase cursor-pointer disabled:opacity-50">
              {state.busy ? "Waiting for BridgeKey…" : "Approve with BridgeKey"}
            </button>
            {state.error && <p className="text-[#ba1a1a] font-bold text-sm">{state.error}</p>}
          </div>
        )}
      </div>
    </div>
  );
};
