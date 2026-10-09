import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ImageAnalysisSection } from "../components/ImageAnalysisSection";

export const ImageAnalysisPage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 text-white hover:text-amber-400 transition-colors">
            <span className="text-xl">🏗️</span>
            <div>
              <h1 className="text-sm font-semibold">SiteVerify</h1>
              <p className="text-xs text-slate-400">AI Image Analysis Portal</p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <Link
              to={user.role === "supervisor" ? "/supervisor" : user.role === "store_incharge" ? "/store" : "/auditor"}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              ← Back to {user.role.toUpperCase()} Workspace
            </Link>
          ) : (
            <Link
              to="/login"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            AI Vision Milestone Verifier
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Automated image analysis using Google Gemini vision model. Verified descriptions are immutable and tamper-proof.
          </p>
        </div>

        <ImageAnalysisSection />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-4 text-center text-xs text-slate-600 font-mono">
        SiteVerify &copy; 2026 • AI Vision Analysis Module • Powered by Google Gemini
      </footer>
    </div>
  );
};
