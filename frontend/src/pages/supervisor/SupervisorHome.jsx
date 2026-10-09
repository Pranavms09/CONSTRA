import React, { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { pingSupervisor } from "../../api/client";
import { ImageAnalysisSection } from "../../components/ImageAnalysisSection";

export const SupervisorHome = () => {
  const { user, logout } = useAuth();
  const [pingResult, setPingResult] = useState(null);
  const [loadingPing, setLoadingPing] = useState(false);
  const [errorPing, setErrorPing] = useState(null);

  const handleTestPing = async () => {
    setLoadingPing(true);
    setErrorPing(null);
    setPingResult(null);
    try {
      const data = await pingSupervisor();
      setPingResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setErrorPing(err?.message || "Ping failed");
    } finally {
      setLoadingPing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🏗️</span>
          <div>
            <h1 className="text-sm font-semibold text-white">SiteVerify Portal</h1>
            <p className="text-xs text-slate-400">Site Constructor & Supervisor Operations</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-white">{user?.full_name}</p>
            <p className="text-xs text-slate-400 font-mono">{user?.email}</p>
          </div>
          <span className="px-2.5 py-1 text-xs font-mono font-medium rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
            SUPERVISOR
          </span>
          <button
            onClick={() => logout()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Welcome Banner */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">👷‍♂️</span>
            <h2 className="text-xl font-bold text-white">Welcome, {user?.full_name}!</h2>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
            You are authenticated into the Site Supervisor workspace. Upload on-site milestone photos below to run AI vision analysis and generate tamper-proof milestone verification descriptions.
          </p>
        </div>

        {/* Primary Workflow: AI Image Analysis with Read-Only Description */}
        <ImageAnalysisSection />

        {/* Secondary Card: API Authorization Diagnostic */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            API Authorization Diagnostic
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Sends an authenticated request with your Firebase Bearer token to <code className="text-amber-400 font-mono">GET /supervisor/ping</code>.
          </p>
          <button
            onClick={handleTestPing}
            disabled={loadingPing}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loadingPing ? "Connecting..." : "Test API Connection (/supervisor/ping)"}
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
      </main>
    </div>
  );
};
