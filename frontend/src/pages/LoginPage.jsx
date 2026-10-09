import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getRoleHomeRoute } from "../auth/ProtectedRoute";

const ROLES = [
  {
    id: "supervisor",
    title: "Site Supervisor",
    badge: "Field Operations",
    email: "supervisor@siteverify.com",
    description: "Upload on-site progress photos, inspect stage checklists, and resolve evidence flags.",
    icon: "🏗️",
    accent: "blue",
  },
  {
    id: "store_incharge",
    title: "Store In-Charge",
    badge: "Inventory & Logistics",
    email: "store@siteverify.com",
    description: "Scan incoming delivery challans, reconcile BOQ items, and log material drawdowns.",
    icon: "📦",
    accent: "amber",
  },
  {
    id: "auditor",
    title: "Project Auditor",
    badge: "Quality & Compliance",
    email: "auditor@siteverify.com",
    description: "Triage verification flags, review cross-checks, and sign off milestone payment certificates.",
    icon: "🛡️",
    accent: "purple",
  },
];

export const LoginPage = () => {
  const [selectedRole, setSelectedRole] = useState("supervisor");
  const [loadingRole, setLoadingRole] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const { user, loginDemo } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect to user's assigned dashboard
  useEffect(() => {
    if (user) {
      navigate(getRoleHomeRoute(user.role), { replace: true });
    }
  }, [user, navigate]);

  const handleDemoLogin = async (roleId) => {
    if (loadingRole) return;

    setLoadingRole(roleId);
    setErrorMessage(null);

    try {
      const loggedInUser = await loginDemo(roleId);
      navigate(getRoleHomeRoute(loggedInUser.role), { replace: true });
    } catch (err) {
      setErrorMessage(
        err?.message ||
          "Failed to connect to backend server. Make sure FastAPI server is running on port 8000."
      );
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      {/* Top Banner / System Tag */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              SiteVerify Node • Demo Access Mode
            </span>
          </div>
          <span className="text-xs text-amber-400/90 font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
            TEST MODE ACTIVE
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 md:py-12 flex flex-col justify-center">
        {/* Branding & App Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-2xl mb-4">
            🏢
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Construction Milestone Verifier
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
            Role-segregated verification portal. Select an authorized operational role below for instant demo access.
          </p>
        </div>

        {/* Error Notification Box */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-lg bg-red-950/60 border border-red-500/40 text-red-200 text-sm flex items-start gap-3 transition-all animate-in fade-in"
          >
            <span className="text-lg leading-none text-red-400">⚠️</span>
            <div className="flex-1 font-medium">{errorMessage}</div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-200 text-xs uppercase tracking-wider font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Authorized Roles Section */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Select Authorized Role To Enter
            </label>
            <span className="text-[11px] text-slate-500 font-mono">1-Click Sign In</span>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {ROLES.map((role) => {
              const isSelected = selectedRole === role.id;
              const isLoadingThis = loadingRole === role.id;

              return (
                <div
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`p-4 rounded-xl border transition-all duration-150 flex flex-col gap-3 cursor-pointer ${
                    isSelected
                      ? "bg-slate-900/90 border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.12)] ring-1 ring-amber-500/50"
                      : "bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 transition-colors ${
                        isSelected
                          ? "bg-amber-500 text-slate-950"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {role.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-100 text-base">
                          {role.title}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-slate-800 text-slate-400 border-slate-700">
                          {role.badge}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                        {role.description}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500 font-mono">
                        Demo Account: <span className="text-slate-400">{role.email}</span>
                      </p>
                    </div>
                  </div>

                  {/* Direct Launch Button on Card */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end">
                    <button
                      type="button"
                      disabled={loadingRole !== null}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDemoLogin(role.id);
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                      } disabled:opacity-50`}
                    >
                      {isLoadingThis ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          <span>Entering...</span>
                        </>
                      ) : (
                        <>
                          <span>Enter as {role.title}</span>
                          <span>→</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Primary Bottom Action */}
        <div className="space-y-3">
          <button
            type="button"
            disabled={loadingRole !== null}
            onClick={() => handleDemoLogin(selectedRole)}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-white text-slate-950 hover:bg-slate-100 transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.99] cursor-pointer shadow-lg shadow-white/5 disabled:opacity-50"
          >
            {loadingRole ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Authorizing Portal Entry...</span>
              </>
            ) : (
              <>
                <span>
                  Launch Portal as{" "}
                  {ROLES.find((r) => r.id === selectedRole)?.title}
                </span>
                <span>⚡</span>
              </>
            )}
          </button>
        </div>

        {/* Security & Isolation Note */}
        <p className="mt-6 text-center text-xs text-slate-500">
          🔒 Roles are segregated and strictly enforced on the server. Cross-role URL tampering redirects automatically.
        </p>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-4 py-4 text-center text-xs text-slate-600 font-mono">
        SiteVerify &copy; {new Date().getFullYear()} • Role-Segregated Construction Verification
      </footer>
    </div>
  );
};
