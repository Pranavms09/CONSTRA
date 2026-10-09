import React, { useState, useEffect, createContext, useContext } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { fetchProjects } from "../../api/store";

export const StoreProjectContext = createContext(null);

export const useStoreProject = () => useContext(StoreProjectContext);

export const StoreLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [errorProjects, setErrorProjects] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadProjects() {
      try {
        setLoadingProjects(true);
        const data = await fetchProjects();
        if (mounted) {
          setProjects(data || []);
          if (data && data.length > 0) {
            setSelectedProjectId(data[0].id);
          }
        }
      } catch (err) {
        if (mounted) setErrorProjects(err.message || "Failed to load projects");
      } finally {
        if (mounted) setLoadingProjects(false);
      }
    }
    loadProjects();
    return () => {
      mounted = false;
    };
  }, []);

  const navLinks = [
    { to: "/store", label: "Dashboard", icon: "📊", exact: true },
    { to: "/store/deliveries", label: "Deliveries", icon: "🚚" },
    { to: "/store/issue", label: "Issue Material", icon: "📤" },
    { to: "/store/issues", label: "Issue Log", icon: "📋" },
    { to: "/store/stock", label: "Stock Summary", icon: "📦" },
    { to: "/store/alerts", label: "Alerts", icon: "🚨" },
  ];

  const isActive = (item) => {
    if (item.exact) {
      return location.pathname === item.to;
    }
    return location.pathname.startsWith(item.to);
  };

  const selectedProject = projects.find((p) => p.id === Number(selectedProjectId));

  return (
    <StoreProjectContext.Provider
      value={{
        projects,
        selectedProjectId: Number(selectedProjectId),
        setSelectedProjectId: (id) => setSelectedProjectId(Number(id)),
        selectedProject,
        loadingProjects,
      }}
    >
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        {/* Top Header Bar */}
        <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-lg text-amber-400">
              🏬
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-white">
                  SiteVerify Portal
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  STORE IN-CHARGE
                </span>
              </div>
              <p className="text-xs text-slate-400">Inventory & Delivery Reconciliation</p>
            </div>
          </div>

          {/* Project Selector & User Bar */}
          <div className="flex items-center gap-3 sm:gap-4">
            {projects.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80">
                <span className="text-xs text-slate-400 hidden sm:inline">Project:</span>
                <select
                  value={selectedProjectId || ""}
                  onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                  className="bg-transparent text-xs font-semibold text-white focus:outline-hidden cursor-pointer"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="text-right hidden md:block">
              <p className="text-xs font-semibold text-white">{user?.full_name}</p>
              <p className="text-[11px] text-slate-400 font-mono">{user?.email}</p>
            </div>

            <button
              onClick={() => logout()}
              className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Navigation Tabs Bar */}
        <nav className="border-b border-slate-800/80 bg-slate-900/40 px-4 sm:px-6 flex items-center justify-between overflow-x-auto">
          <div className="flex items-center gap-1 sm:gap-2 py-2">
            {navLinks.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                    active
                      ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="hidden sm:block py-2 pl-4">
            <Link
              to="/store/deliveries/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition shadow-sm"
            >
              <span>+</span>
              <span>New Delivery</span>
            </Link>
          </div>
        </nav>

        {/* Content Area */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {errorProjects && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorProjects}</span>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </StoreProjectContext.Provider>
  );
};
