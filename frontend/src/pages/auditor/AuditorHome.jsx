import React, { useState, useEffect } from "react";
import { useAuth } from "../../auth/AuthContext";
import { pingAuditor, fetchUsers, createUser } from "../../api/client";

export const AuditorHome = () => {
  const { user, logout } = useAuth();
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

  useEffect(() => {
    loadUsers();
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
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Welcome Card & Ping Test */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">⚖️</span>
            <h2 className="text-xl font-bold text-white">Welcome, {user?.full_name}!</h2>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
            You hold Auditor authority. You have access to user management, threshold tuning, alert triage, and stage certificate issuance.
          </p>

          <div className="mt-6 pt-6 border-t border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
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
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Full Name
                </label>
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
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Google Account Email
                </label>
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
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Assigned Role
                </label>
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
      </main>
    </div>
  );
};
