import React from "react";
import { Link } from "react-router-dom";

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-3xl flex items-center justify-center mb-4">
        🚧
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-white mb-2">404 — Page Not Found</h1>
      <p className="text-sm text-slate-400 max-w-md mb-6">
        The requested resource or page does not exist or has been restricted under project access controls.
      </p>
      <Link
        to="/"
        className="px-5 py-2.5 rounded-xl bg-white text-slate-950 font-semibold text-sm hover:bg-slate-100 transition-colors"
      >
        Return to Portal
      </Link>
    </div>
  );
};
