import React, { useState, useEffect } from "react";
import { useAuth } from "../../auth/AuthContext";
import { pingAuditor, fetchUsers, createUser, fetchExifGpsReport } from "../../api/client";
import { ClaimAuditDesk } from "./ClaimAuditDesk";

export const AuditorHome = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("desk"); // 'desk' | 'exif' | 'users'

  const [pingResult, setPingResult] = useState(null);
  const [loadingPing, setLoadingPing] = useState(false);
  const [errorPing, setErrorPing] = useState(null);

  // User management state
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState(null);

  // Add user form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("supervisor");
  const [submittingUser, setSubmittingUser] = useState(false);
  const [formSuccess, setFormSuccess] = useState(null);
  const [formError, setFormError] = useState(null);

  // EXIF & GPS Analyzer state
  const [projectId, setProjectId] = useState("project-001");
  const [fileName, setFileName] = useState("column_casting.jpg");
  const [exifReport, setExifReport] = useState(null);
  const [loadingExif, setLoadingExif] = useState(false);
  const [exifError, setExifError] = useState(null);

  const loadUsers = async () => {
    setLoadingUsers(true);
    setUsersError(null);
    try {
      const data = await fetchUsers();
      setUsersList(data);
    } catch (err) {
      setUsersError(err?.message || "Failed to load registered users");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleFetchExifReport = async (pId = projectId, fName = fileName) => {
    if (!pId || !fName) return;
    setLoadingExif(true);
    setExifError(null);
    setExifReport(null);
    try {
      const report = await fetchExifGpsReport(pId, fName);
      setExifReport(report);
    } catch (err) {
      setExifError(err?.message || "Failed to fetch EXIF & GPS verification report");
    } finally {
      setLoadingExif(false);
    }
  };

  useEffect(() => {
    loadUsers();
    handleFetchExifReport("project-001", "column_casting.jpg");
  }, []);

  const handleTestPing = async () => {
    setLoadingPing(true);
    setErrorPing(null);
    setPingResult(null);
    try {
      const data = await pingAuditor();
      setPingResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setErrorPing(err?.message || "Ping failed");
    } finally {
      setLoadingPing(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!fullName.trim() || !email.trim()) {
      setFormError("Full name and email are required.");
      return;
    }

    setSubmittingUser(true);
    try {
      const newUser = await createUser({
        full_name: fullName.trim(),
        email: email.trim(),
        role,
      });
      setFormSuccess(`User ${newUser.email} added successfully with role ${newUser.role}!`);
      setFullName("");
      setEmail("");
      setRole("supervisor");
      await loadUsers();
    } catch (err) {
      setFormError(err?.message || "Failed to create user");
    } finally {
      setSubmittingUser(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "PASS":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "FAIL":
      case "FLAGGED":
        return "bg-red-500/10 text-red-400 border-red-500/30";
      case "WARNING":
      case "REVIEW_REQUIRED":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/30";
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🛡️</span>
          <div>
            <h1 className="text-sm font-semibold text-white">SiteVerify Portal</h1>
            <p className="text-xs text-slate-400">Auditor Command Center</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-white">{user?.full_name}</p>
            <p className="text-xs text-slate-400 font-mono">{user?.email}</p>
          </div>
          <span className="px-2.5 py-1 text-xs font-mono font-medium rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
            AUDITOR
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
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab("desk")}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "desk"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
            }`}
          >
            <span>📋</span>
            <span>Claim Audit Desk</span>
          </button>
          <button
            onClick={() => setActiveTab("exif")}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "exif"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
            }`}
          >
            <span>📍</span>
            <span>EXIF & GPS Inspector</span>
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "users"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
            }`}
          >
            <span>👥</span>
            <span>User Allowlist & Auth</span>
          </button>
        </div>

        {/* TAB 1: CLAIM AUDIT DESK */}
        {activeTab === "desk" && (
          <div className="space-y-6">
            <ClaimAuditDesk />
          </div>
        )}

        {/* TAB 2: EXIF & GPS INSPECTOR */}
        {activeTab === "exif" && (
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">📍</span>
                  <h3 className="text-lg font-bold text-white">Construction Photo EXIF & GPS Audit</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Inspect photo capture timestamps, geofence radius, software editing signatures, and SHA-256 hash duplication.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-[11px] font-mono bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-amber-400">
                  GET /api/v1/projects/{projectId}/evidence/{fileName}/exif-gps
                </code>
              </div>
            </div>

            {/* Form & Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Project ID</label>
                <input
                  type="text"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="project-001"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Evidence Photo Filename</label>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="column_casting.jpg"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => handleFetchExifReport(projectId, fileName)}
                  disabled={loadingExif}
                  className="w-full py-1.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loadingExif ? "Analyzing Photo..." : "🔍 Run EXIF & GPS Audit"}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {exifError && (
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs">
                <div className="font-semibold text-red-400 mb-1">Audit Failed</div>
                <p>{exifError}</p>
              </div>
            )}

            {/* Loading Indicator */}
            {loadingExif && (
              <div className="p-8 text-center text-slate-400 text-xs animate-pulse font-mono">
                Extracting EXIF tags, checking geofence coordinates, verifying SHA-256 hash...
              </div>
            )}

            {/* Report Visualization */}
            {exifReport && !loadingExif && (
              <div className="space-y-6">
                {/* Report Header Card */}
                <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Report Type:</span>
                      <span className="text-xs font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                        {exifReport.report_type}
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-white mt-1 flex items-center gap-2 font-mono">
                      📄 {exifReport.file_name}
                    </h4>
                    <p className="text-[11px] font-mono text-slate-400 mt-1">
                      SHA256: <span className="text-slate-300">{exifReport.file_sha256}</span>
                    </p>
                  </div>

                  <div className="flex flex-col items-start md:items-end gap-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Overall Status</span>
                    <span
                      className={`px-4 py-1.5 rounded-full font-mono text-xs font-bold uppercase border tracking-wider ${getStatusBadge(
                        exifReport.overall_status
                      )}`}
                    >
                      {exifReport.overall_status === "FLAGGED" && "⚠️ "}
                      {exifReport.overall_status === "REVIEW_REQUIRED" && "🔍 "}
                      {exifReport.overall_status === "PASS" && "✓ "}
                      {exifReport.overall_status}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono mt-1">
                      Generated: {new Date(exifReport.generated_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                    <p className="text-[10px] text-slate-400 uppercase font-mono">Total Checks</p>
                    <p className="text-xl font-bold text-white mt-1 font-mono">{exifReport.summary.total_checks}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/20 text-center">
                    <p className="text-[10px] text-emerald-400 uppercase font-mono">Passed</p>
                    <p className="text-xl font-bold text-emerald-400 mt-1 font-mono">{exifReport.summary.passed}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-red-500/20 text-center">
                    <p className="text-[10px] text-red-400 uppercase font-mono">Failed</p>
                    <p className="text-xl font-bold text-red-400 mt-1 font-mono">{exifReport.summary.failed}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/20 text-center">
                    <p className="text-[10px] text-amber-400 uppercase font-mono">Warnings</p>
                    <p className="text-xl font-bold text-amber-400 mt-1 font-mono">{exifReport.summary.warnings}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                    <p className="text-[10px] text-slate-400 uppercase font-mono">Not Checked</p>
                    <p className="text-xl font-bold text-slate-400 mt-1 font-mono">{exifReport.summary.not_checked}</p>
                  </div>
                </div>

                {/* Checks Breakdown */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Automated Check Pipeline Results
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    {exifReport.checks.map((check, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-white">{check.name}</span>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase border self-start sm:self-auto ${getStatusBadge(
                              check.status
                            )}`}
                          >
                            {check.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">{check.message}</p>

                        {/* Details */}
                        {check.details && Object.keys(check.details).length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-900 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px] font-mono">
                            {Object.entries(check.details).map(([k, v]) => (
                              <div key={k} className="bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800/80">
                                <span className="text-slate-400 uppercase text-[9px] block">{k}</span>
                                <span className="text-slate-200 break-all">{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Disclaimer */}
                {exifReport.disclaimer && (
                  <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200/90 text-xs leading-relaxed flex items-start gap-3">
                    <span className="text-lg">ℹ️</span>
                    <div>
                      <span className="font-semibold text-amber-400 block mb-0.5">Auditor Verification Disclaimer</span>
                      {exifReport.disclaimer}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: USER ALLOWLIST & AUTH */}
        {activeTab === "users" && (
          <div className="space-y-6">
            {/* API Authorization Test */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                API Authorization Test
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Sends an authenticated request with your Firebase Bearer token to <code className="text-amber-400 font-mono">GET /auditor/ping</code>.
              </p>
              <button
                onClick={handleTestPing}
                disabled={loadingPing}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loadingPing ? "Connecting..." : "Test API Connection (/auditor/ping)"}
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

            {/* User Management Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Add User Form */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 lg:col-span-1">
                <h3 className="text-base font-bold text-white mb-1">Add Registered User</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Allowlist a Google account email and assign their role.
                </p>

                {formSuccess && (
                  <div className="mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs">
                    {formSuccess}
                  </div>
                )}

                {formError && (
                  <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs">
                    {formError}
                  </div>
                )}

                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Google Account Email</label>
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Assigned Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-400"
                    >
                      <option value="supervisor">Site Supervisor</option>
                      <option value="store_incharge">Store In-Charge</option>
                      <option value="auditor">Project Auditor</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingUser}
                    className="w-full py-2.5 px-4 rounded-lg bg-white text-slate-950 font-semibold text-sm hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {submittingUser ? "Registering..." : "Add to Allowlist"}
                  </button>
                </form>
              </div>

              {/* Registered Users Table */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 lg:col-span-2 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white">Registered Users (Allowlist)</h3>
                    <p className="text-xs text-slate-400">
                      Only accounts listed here can log in through Google.
                    </p>
                  </div>
                  <button
                    onClick={loadUsers}
                    disabled={loadingUsers}
                    className="px-3 py-1 rounded text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
                  >
                    Refresh
                  </button>
                </div>

                {usersError && (
                  <div className="p-3 mb-4 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs">
                    {usersError}
                  </div>
                )}

                <div className="flex-1 overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-mono border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-2.5">ID</th>
                        <th className="px-4 py-2.5">Full Name</th>
                        <th className="px-4 py-2.5">Email</th>
                        <th className="px-4 py-2.5">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {usersList.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                            {loadingUsers ? "Loading user allowlist..." : "No users found."}
                          </td>
                        </tr>
                      ) : (
                        usersList.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-800/30">
                            <td className="px-4 py-3 font-mono text-slate-400">#{u.id}</td>
                            <td className="px-4 py-3 font-medium text-white">{u.full_name}</td>
                            <td className="px-4 py-3 font-mono text-slate-300">{u.email}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase border ${
                                  u.role === "auditor"
                                    ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                    : u.role === "store_incharge"
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                    : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                }`}
                              >
                                {u.role}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
