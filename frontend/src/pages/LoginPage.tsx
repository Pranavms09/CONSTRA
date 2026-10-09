import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getRoleHomeRoute } from "../auth/ProtectedRoute";

type RoleOption = "supervisor" | "store_incharge" | "auditor";

interface RoleCardInfo {
  id: RoleOption;
  title: string;
  badge: string;
  description: string;
  icon: string;
}

const ROLES: RoleCardInfo[] = [
  {
    id: "supervisor",
    title: "Site Supervisor",
    badge: "Field Operations",
    description: "Upload on-site progress photos, inspect stage checklists, and resolve evidence flags.",
    icon: "🏗️",
  },
  {
    id: "store_incharge",
    title: "Store In-Charge",
    badge: "Inventory & Logistics",
    description: "Scan incoming delivery challans, reconcile BOQ items, and log material drawdowns.",
    icon: "📦",
  },
  {
    id: "auditor",
    title: "Project Auditor",
    badge: "Quality & Compliance",
    description: "Triage verification flags, review cross-checks, and sign off milestone payment certificates.",
    icon: "🛡️",
  },
];

export const LoginPage: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<RoleOption | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { user, login } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect to user's assigned dashboard
  useEffect(() => {
    if (user) {
      navigate(getRoleHomeRoute(user.role), { replace: true });
    }
  }, [user, navigate]);

  const handleRoleSelect = (role: RoleOption) => {
    setSelectedRole(role);
    setErrorMessage(null);
  };

  const handleGoogleSignIn = async () => {
    if (!selectedRole || loading) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const loggedInUser = await login(selectedRole);
      navigate(getRoleHomeRoute(loggedInUser.role), { replace: true });
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (
        error.code === "auth/popup-closed-by-user" ||
        error.message?.includes("popup-closed-by-user")
      ) {
        setErrorMessage("Sign-in cancelled. Please try again when ready.");
      } else {
        setErrorMessage(
          error.message ||
            "Authentication failed. Please ensure your Google account is registered with this role."
        );
      }
    } finally {
      setLoading(false);
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
              SiteVerify Node • Access Gate
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">v1.0-alpha</span>
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
            Role-segregated verification portal. Select your claimed operational role below before authenticating with Google.
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
              className="text-red-400 hover:text-red-200 text-xs uppercase tracking-wider font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Step 1: Role Selection */}
        <div className="space-y-3 mb-6">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            1. Select Your Authorized Role
          </label>
          <div className="grid grid-cols-1 gap-3">
            {ROLES.map((role) => {
              const isSelected = selectedRole === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleRoleSelect(role.id)}
                  aria-pressed={isSelected}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-150 flex items-start gap-4 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    isSelected
                      ? "bg-amber-950/20 border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.15)] ring-1 ring-amber-500"
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                  }`}
                >
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
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          isSelected
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        {role.badge}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                      {role.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Sign-in CTA */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            2. Authenticate Identity
          </label>
          <button
            type="button"
            disabled={!selectedRole || loading}
            onClick={handleGoogleSignIn}
            className={`w-full py-3.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-3 transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.99] ${
              !selectedRole || loading
                ? "bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed"
                : "bg-white text-slate-950 hover:bg-slate-100 font-semibold shadow-lg shadow-white/5 cursor-pointer"
            }`}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Signing in with Google...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>
                  {selectedRole
                    ? `Continue with Google as ${ROLES.find((r) => r.id === selectedRole)?.title}`
                    : "Select a Role Above to Continue"}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Security Note */}
        <p className="mt-6 text-center text-xs text-slate-400">
          🔒 Roles are strictly verified against the system authorization database. Unknown accounts and role mismatches will be rejected.
        </p>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-4 py-4 text-center text-xs text-slate-400 font-mono">
        SiteVerify &copy; {new Date().getFullYear()} • Zero Trust Construction Milestone Verification
      </footer>
    </div>
  );
};
