import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getRoleHomeRoute } from "../auth/ProtectedRoute";

const ROLES = [
  {
    id: "supervisor",
    title: "Site Supervisor",
    level: "LEVEL-01",
    levelClass: "text-[#296a49] bg-[#93d5ad]/30 border-[#296a49]/30",
    description: "Captures ground truth and execution milestones on site.",
    icon: "photo_camera",
  },
  {
    id: "store_incharge",
    title: "Store In-Charge",
    level: "LEVEL-02",
    levelClass: "text-[#504533] bg-[#E6E2DD] border-[#827560]/30",
    description: "Reconciles delivery challans against dispatches and issues.",
    icon: "receipt_long",
  },
  {
    id: "auditor",
    title: "Project Auditor",
    level: "CLEARANCE-A",
    levelClass: "text-[#7a5900] bg-[#ffdea2] border-[#7a5900]/40",
    description: "Final milestone approval, evidence triage, and threshold authority.",
    icon: "verified_user",
  },
];

export const LoginPage = () => {
  const [selectedRole, setSelectedRole] = useState("supervisor");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authMode, setAuthMode] = useState("login"); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const { user, loginWithGoogle, loginWithEmail, registerWithEmail } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect to user's assigned dashboard
  useEffect(() => {
    if (user) {
      navigate(getRoleHomeRoute(user.role), { replace: true });
    }
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const loggedInUser = await loginWithGoogle(selectedRole);
      navigate(getRoleHomeRoute(loggedInUser.role), { replace: true });
    } catch (err) {
      console.error("Google sign-in error:", err);
      let msg = err?.message || "Failed to sign in with Google.";
      if (msg.includes("popup-closed-by-user")) {
        msg = "Sign-in popup was closed before completing.";
      }
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPasswordSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!emailInput.trim()) {
      setErrorMessage("Please enter your email address.");
      return;
    }
    if (!passwordInput || passwordInput.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      let loggedInUser;
      if (authMode === "register") {
        loggedInUser = await registerWithEmail(emailInput, passwordInput, selectedRole);
      } else {
        loggedInUser = await loginWithEmail(emailInput, passwordInput, selectedRole);
      }
      navigate(getRoleHomeRoute(loggedInUser.role), { replace: true });
    } catch (err) {
      console.error("Email auth error:", err);
      let msg = err?.message || "Failed to authenticate.";
      if (msg.includes("user-not-found") || msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        msg = "Invalid email or password. Please verify your credentials.";
      } else if (msg.includes("email-already-in-use")) {
        msg = "This email is already registered in Firebase. Switch to Sign In mode.";
      }
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const currentRoleObj = ROLES.find((r) => r.id === selectedRole) || ROLES[0];

  return (
    <div className="bg-[#E6E2DD] text-[#1b1b20] font-body-md text-body-md min-h-screen relative flex flex-col justify-center items-center p-4 sm:p-8 selection:bg-[#FCBC18] selection:text-[#101010]">
      {/* 12-Column Coordinate Hairline Grid */}
      <div className="pointer-events-none fixed inset-0 z-0 grid grid-cols-12 gap-4 px-6 opacity-[0.06]">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="h-full border-r border-[#101010]" />
        ))}
      </div>

      <main className="relative z-10 w-full max-w-5xl my-auto">
        <div className="w-full grid grid-cols-1 md:grid-cols-2 shadow-[4px_4px_0px_#101010] border border-[#101010] bg-[#101010]">
          {/* ========================================================================= */}
          {/* LEFT PANEL: Technical Ink Spec Layer                                      */}
          {/* ========================================================================= */}
          <div className="relative bg-[#101010] text-[#F2ECE6] flex flex-col justify-between p-6 sm:p-10 overflow-hidden border-b md:border-b-0 md:border-r border-[#101010]">
            {/* Background Image with Scrim */}
            <div
              className="absolute inset-0 bg-cover bg-center mix-blend-luminosity opacity-40 filter contrast-125 pointer-events-none"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBZHFuaHoCNx9Jm2RrOSgog654jIij_PzkFbFQxBoLF1Nln9rXDQgo16Zw5eDsGQPIts2qy21ylJTAkg_SQ2Ak3Z5wKiq8Cki4t68YcRv8zDThdm7h3e2BdMJqS5Mzdo16FO91sZePixPpFMT6yjI6s8pjMrJvgKnIiMVkNtJjxS-DlH2FHYX9b_596lZzA6quSqHXfEARgcuTx5U4QDLJ9rc3D59FG7NTR129Su8QvqinS9wZ6Wrk4')",
              }}
            />
            <div className="absolute inset-0 bg-[#101010]/60 pointer-events-none" />

            {/* Corner Drafting Crop Marks */}
            <div className="absolute top-3 left-3 text-[#FCBC18] font-label-code text-label-code pointer-events-none opacity-80">
              + 00.00
            </div>
            <div className="absolute top-3 right-3 text-[#FCBC18] font-label-code text-label-code pointer-events-none opacity-80">
              REF: CST-25
            </div>
            <div className="absolute bottom-3 left-3 text-[#FCBC18] font-label-code text-label-code pointer-events-none opacity-80">
              SEC // 08
            </div>

            {/* Top Technical Wordmark Header */}
            <div className="relative z-10 flex flex-col gap-y-2">
              <Link to="/" className="flex items-center gap-x-3 w-max group">
                <span className="font-display-lg text-headline-lg tracking-[0.2em] font-bold text-white uppercase select-none group-hover:text-[#FCBC18] transition-colors">
                  CONSTRA
                </span>
                <div className="w-[10px] h-[10px] bg-[#FCBC18] shrink-0" />
              </Link>
              <div className="h-[1px] w-16 bg-[#FCBC18]/80" />
              <span className="font-label-code text-label-code uppercase text-[#FCBC18] tracking-[0.25em]">
                TERMINAL OS // VERIFIED AUDIT MATRIX
              </span>
            </div>

            {/* Center Narrative Manifesto */}
            <div className="relative z-10 my-10 flex flex-col gap-y-4 max-w-md">
              <div className="inline-flex items-center gap-2 self-start px-2 py-0.5 bg-[#101010]/90 border border-[#A39B8F]/30 text-white font-label-code text-label-code tracking-widest uppercase">
                <span className="w-1.5 h-1.5 bg-[#2F6F4E]" />
                FIELD TELEMETRY DIRECTIVE
              </div>
              <h1 className="font-headline-lg text-headline-lg text-white leading-tight font-bold tracking-tight uppercase">
                “Every claim proves itself.”
              </h1>
              <p className="font-body-md text-body-md text-[#F2ECE6]/80 leading-relaxed font-normal">
                Site photos, delivery challans and material issues, checked against the plan before a milestone is cleared.
              </p>

              {/* Technical Telemetry Badge Strip */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#A39B8F]/20 text-[#A39B8F]">
                <div className="flex flex-col">
                  <span className="font-label-meta text-label-meta tracking-widest uppercase">
                    LATENCY GATE
                  </span>
                  <span className="font-label-code text-label-code text-[#F2ECE6] font-bold">
                    14MS GEO-LOCK
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-meta text-label-meta tracking-widest uppercase">
                    INTEGRITY SHA
                  </span>
                  <span className="font-label-code text-label-code text-[#FCBC18] font-bold">
                    0x4F92B...C01
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Spec Info Footer */}
            <div className="relative z-10 pt-4 border-t border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <span className="font-label-code text-label-code text-[#A39B8F] tracking-widest uppercase">
                CONSTRA KERNEL // ACCESS CONTROL NODE 01 // REV 2025
              </span>
              <span className="font-label-code text-label-code text-[#FCBC18] bg-white/5 px-2 py-0.5 border border-white/10 uppercase">
                PORT: 8084
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT PANEL: Paper Technical UI                                           */}
          {/* ========================================================================= */}
          <div className="relative bg-[#E6E2DD] text-[#101010] p-6 sm:p-10 flex flex-col justify-between">
            {/* Outer Registration Markers */}
            <div className="absolute top-2 right-2 text-[#101010]/30 font-label-code text-label-code select-none pointer-events-none">
              +
            </div>
            <div className="absolute bottom-2 right-2 text-[#101010]/30 font-label-code text-label-code select-none pointer-events-none">
              +
            </div>

            <div>
              {/* Portal Subheader & Title */}
              <div className="flex flex-col gap-1 pb-4 border-b border-[#101010]/15">
                <span className="font-label-code text-label-code text-[#504533] uppercase tracking-[0.2em] flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#101010]" />
                  SIGN IN // SELECT ROLE PORTAL
                </span>
                <h2 className="font-headline-lg text-headline-lg text-[#101010] uppercase font-bold tracking-tight">
                  Access Audit Terminal
                </h2>
              </div>

              {/* Error Alert Box */}
              {errorMessage && (
                <div
                  role="alert"
                  className="mt-4 p-3 bg-[#ffdad6] border border-[#ba1a1a] text-[#ba1a1a] font-label-code text-label-code flex items-start justify-between gap-2"
                >
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-base shrink-0 mt-0.5">warning</span>
                    <span className="text-xs leading-relaxed">{errorMessage}</span>
                  </div>
                  <button
                    onClick={() => setErrorMessage(null)}
                    className="font-bold underline cursor-pointer shrink-0 text-xs"
                    type="button"
                  >
                    DISMISS
                  </button>
                </div>
              )}

              {/* Role Selection Matrix */}
              <fieldset className="mt-5">
                <legend className="font-label-meta text-label-meta uppercase text-[#504533] tracking-widest mb-3 flex items-center justify-between w-full">
                  <span>OPERATIONAL SECTOR SPECIFICATION</span>
                  <span className="text-[#827560]">SELECT 01</span>
                </legend>
                <div className="flex flex-col gap-2.5">
                  {ROLES.map((r) => {
                    const isSelected = selectedRole === r.id;
                    return (
                      <label
                        key={r.id}
                        onClick={() => setSelectedRole(r.id)}
                        className={`cursor-pointer relative bg-[#F2ECE6] border p-3 flex items-start gap-3 transition-all select-none ${
                          isSelected
                            ? "border-[#101010] shadow-[2px_2px_0px_#101010]"
                            : "border-[#101010]/30 hover:border-[#101010]"
                        }`}
                      >
                        <div
                          className={`absolute top-0 left-0 right-0 h-[3px] transition-colors ${
                            isSelected ? "bg-[#FCBC18]" : "bg-transparent"
                          }`}
                        />
                        <input
                          type="radio"
                          name="access_role"
                          value={r.id}
                          checked={isSelected}
                          onChange={() => setSelectedRole(r.id)}
                          className="mt-1 accent-[#101010] w-4 h-4 rounded-none cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-[1.125rem] text-[#101010]">
                                {r.icon}
                              </span>
                              <span className="font-headline-md text-body-lg font-bold uppercase tracking-tight text-[#101010]">
                                {r.title}
                              </span>
                            </div>
                            <span
                              className={`font-label-code text-label-code px-1.5 py-0.5 border uppercase font-bold ${r.levelClass}`}
                            >
                              {r.level}
                            </span>
                          </div>
                          <p className="font-body-sm text-body-sm text-[#504533] mt-0.5 leading-snug">
                            {r.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {/* RBAC Governance Note */}
              <div className="mt-3 p-2.5 bg-[#F2ECE6] border border-[#A39B8F]/40 font-label-meta text-[11px] text-[#504533] flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-[#7a5900]">shield</span>
                <span>
                  Role assignment is governed exclusively by the Project Auditor. Unassigned users cannot access site dashboards.
                </span>
              </div>

              {/* Authentication Actions Section */}
              <div className="mt-5 space-y-4">
                {/* Active Portal Target Indicator */}
                <div className="flex items-center justify-between px-1 font-label-code text-xs text-[#504533]">
                  <span>PORTAL DESTINATION:</span>
                  <span className="font-bold text-[#101010] uppercase">
                    {currentRoleObj.title} // {currentRoleObj.level}
                  </span>
                </div>

                {/* 1. Primary Google Sign-In Button */}
                <button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full min-h-[50px] py-3 px-6 bg-[#FCBC18] hover:bg-[#101010] text-[#101010] hover:text-[#FCBC18] border border-[#101010] font-headline-md text-headline-md font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-colors shadow-[2px_2px_0px_#101010] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer disabled:opacity-50"
                  type="button"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span className="whitespace-nowrap">
                    {loading ? "AUTHENTICATING..." : "SIGN IN WITH GOOGLE"}
                  </span>
                </button>

                {/* Divider */}
                <div className="relative flex items-center justify-center my-3">
                  <div className="w-full h-[1px] bg-[#101010]/20" />
                  <span className="absolute bg-[#E6E2DD] px-3 font-label-code text-[11px] uppercase tracking-widest text-[#504533]">
                    OR GMAIL &amp; PASSWORD
                  </span>
                </div>

                {/* 2. Email & Password Form */}
                <form onSubmit={handleEmailPasswordSubmit} className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <span className="font-label-meta text-label-meta uppercase text-[#504533] tracking-wider">
                      {authMode === "login" ? "SIGN IN WITH CREDENTIALS" : "REGISTER CREDENTIALS"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                      className="font-label-code text-xs text-[#7a5900] underline font-bold cursor-pointer hover:text-[#101010]"
                    >
                      {authMode === "login" ? "CREATE ACCOUNT" : "HAVE AN ACCOUNT? SIGN IN"}
                    </button>
                  </div>

                  <div>
                    <label className="font-label-meta text-[10px] uppercase text-[#504533] block mb-1">
                      EMAIL ADDRESS
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="engineer@gmail.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full h-[44px] bg-[#F2ECE6] border border-[#101010]/40 text-[#101010] px-3 font-label-code text-body-md outline-none focus:border-[#101010] transition-colors rounded-none placeholder:text-[#827560]/50"
                    />
                  </div>

                  <div>
                    <label className="font-label-meta text-[10px] uppercase text-[#504533] block mb-1">
                      PASSWORD
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full h-[44px] bg-[#F2ECE6] border border-[#101010]/40 text-[#101010] px-3 font-label-code text-body-md outline-none focus:border-[#101010] transition-colors rounded-none placeholder:text-[#827560]/50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[46px] py-2.5 px-6 bg-[#101010] hover:bg-[#FCBC18] text-[#F2ECE6] hover:text-[#101010] border border-[#101010] font-headline-md text-headline-md uppercase tracking-wider font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 shadow-[2px_2px_0px_#101010] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {authMode === "login" ? "key" : "person_add"}
                    </span>
                    <span className="whitespace-nowrap">
                      {loading
                        ? "AUTHENTICATING..."
                        : authMode === "login"
                        ? "SIGN IN WITH EMAIL"
                        : "CREATE ACCOUNT"}
                    </span>
                  </button>
                </form>
              </div>
            </div>

            {/* Security & Compliance Footer */}
            <div className="mt-6 pt-4 border-t border-[#101010]/15 flex items-start gap-2 text-[#504533]">
              <span className="material-symbols-outlined text-[1rem] text-[#ba1a1a] shrink-0 mt-0.5">
                lock
              </span>
              <p className="font-label-meta text-label-meta tracking-wider uppercase leading-tight">
                Restricted system. All authentication attempts are logged and geo-verified. Unauthorized intrusion violates Civil Compliance Standard ISO-19650.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
