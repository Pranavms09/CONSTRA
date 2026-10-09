import React, { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { pingStore } from "../../api/client";

export const StoreHome: React.FC = () => {
  const { user, logout } = useAuth();
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [loadingPing, setLoadingPing] = useState(false);
  const [errorPing, setErrorPing] = useState<string | null>(null);

  const handleTestPing = async () => {
    setLoadingPing(true);
    setErrorPing(null);
    setPingResult(null);
    try {
      const data = await pingStore();
      setPingResult(JSON.stringify(data, null, 2));
    } catch (err: unknown) {
      setErrorPing((err as Error).message || "Ping failed");
    } finally {
      setLoadingPing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">📦</span>
          <div>
            <h1 className="text-sm font-semibold text-white">SiteVerify Portal</h1>
            <p className="text-xs text-slate-400">Store & Inventory Operations</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-white">{user?.full_name}</p>
            <p className="text-xs text-slate-400 font-mono">{user?.email}</p>
          </div>
          <span className="px-2.5 py-1 text-xs font-mono font-medium rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            STORE IN-CHARGE
          </span>
          <button
            onClick={() => logout()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 space-y-6">
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🏬</span>
            <h2 className="text-xl font-bold text-white">Welcome, {user?.full_name}!</h2>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
            You are authenticated into the Store In-Charge workspace. In upcoming modules, you will scan vendor delivery challans, reconcile incoming materials against BOQ limits, and issue materials to stages.
          </p>

          <div className="mt-6 pt-6 border-t border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              API Authorization Test
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Sends an authenticated request with your Firebase Bearer token to <code className="text-amber-400 font-mono">GET /store/ping</code>.
            </p>
            <button
              onClick={handleTestPing}
              disabled={loadingPing}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold transition-colors disabled:opacity-50"
            >
              {loadingPing ? "Connecting..." : "Test API Connection (/store/ping)"}
            </button>

            {pingResult && (
              <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
                <div className="font-bold mb-1 text-emerald-400">✓ 200 OK — Authorized:</div>
                <pre>{pingResult}</pre>
              </div>
            )}

            {errorPing && (
              <div className="mt-4 p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs font-mono">
                <div className="font-bold mb-1 text-red-400">✗ Error:</div>
                <p>{errorPing}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
