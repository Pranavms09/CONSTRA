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
    { to: "/store", label: "Dashboard", code: "SEC-01", icon: "dashboard", exact: true },
    { to: "/store/deliveries", label: "Deliveries", code: "SEC-02", icon: "local_shipping" },
    { to: "/store/issue", label: "Issue Material", code: "SEC-03", icon: "output" },
    { to: "/store/issues", label: "Issue Log", code: "SEC-04", icon: "history_toggle_off" },
    { to: "/store/stock", label: "Stock Summary", code: "SEC-05", icon: "inventory_2" },
    { to: "/store/alerts", label: "Alerts", code: "SEC-06", icon: "warning" },
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
      <div className="min-h-screen bg-[#E6E2DD] text-[#101010] flex flex-col font-body-md text-body-md selection:bg-[#FCBC18] selection:text-[#101010]">
        {/* Background Hairline Grid */}
        <div className="pointer-events-none fixed inset-0 z-0 grid grid-cols-12 gap-4 px-6 opacity-[0.06]">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-full border-r border-[#101010]" />
          ))}
        </div>

        {/* Top Header Bar */}
        <header className="border-b border-[#101010] bg-[#101010] text-[#F2ECE6] sticky top-0 z-40 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shadow-[0_2px_0px_#101010]">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <span className="font-headline-md text-headline-md tracking-wider uppercase font-bold text-[#F2ECE6] group-hover:text-[#FCBC18] transition-colors">
                CONSTRA
              </span>
              <div className="w-2.5 h-2.5 bg-[#FCBC18] shrink-0" />
            </Link>
            <div className="h-4 w-[1px] bg-[#A39B8F]/30 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2">
              <span className="font-label-code text-label-code uppercase tracking-widest text-[#A39B8F] border border-[#A39B8F]/30 px-2 py-[1px]">
                STORE IN-CHARGE
              </span>
              <span className="font-label-meta text-label-meta uppercase tracking-wider text-[#FCBC18]">
                LEVEL-02 // INVENTORY &amp; DISPATCH
              </span>
            </div>
          </div>

          {/* Project Selector & User Bar */}
          <div className="flex items-center gap-3 sm:gap-4">
            {projects.length > 0 && (
              <div className="flex items-center gap-2 bg-[#1b1b20] px-3 py-1 border border-[#A39B8F]/40">
                <span className="font-label-meta text-label-meta uppercase text-[#A39B8F] hidden sm:inline">
                  PROJECT:
                </span>
                <select
                  value={selectedProjectId || ""}
                  onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                  className="bg-transparent font-label-code text-label-code text-[#F2ECE6] focus:outline-none cursor-pointer uppercase"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#101010] text-[#F2ECE6]">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="text-right hidden md:block">
              <p className="font-label-code text-label-code text-[#F2ECE6] uppercase font-bold">
                {user?.full_name || "Operator"}
              </p>
              <p className="font-label-meta text-label-meta text-[#A39B8F] uppercase">
                {user?.email}
              </p>
            </div>

            <button
              onClick={() => logout()}
              className="px-3 py-1 font-label-code text-label-code uppercase border border-[#F2ECE6] text-[#F2ECE6] hover:bg-[#F2ECE6] hover:text-[#101010] transition-colors cursor-pointer"
            >
              LOGOUT
            </button>
          </div>
        </header>

        {/* Navigation Tabs Bar */}
        <nav className="border-b border-[#101010] bg-[#101010] px-4 sm:px-6 flex items-center justify-between overflow-x-auto">
          <div className="flex items-center gap-1 sm:gap-2 py-2">
            {navLinks.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 px-3 py-1.5 font-label-code text-label-code uppercase tracking-wider transition-all whitespace-nowrap border ${
                    active
                      ? "bg-[#FCBC18] text-[#101010] font-bold border-[#101010] shadow-[2px_2px_0px_#101010]"
                      : "text-[#A39B8F] border-transparent hover:text-[#F2ECE6] hover:bg-[#1b1b20]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="hidden sm:block py-2 pl-4">
            <Link
              to="/store/deliveries/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FCBC18] hover:bg-[#F2ECE6] text-[#101010] font-label-code text-label-code uppercase font-bold border border-[#101010] transition-colors shadow-[2px_2px_0px_#101010]"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>NEW DELIVERY</span>
            </Link>
          </div>
        </nav>

        {/* Content Area */}
        <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {errorProjects && (
            <div className="mb-6 p-4 bg-[#ffdad6] border border-[#ba1a1a] text-[#ba1a1a] font-label-code text-label-code uppercase flex items-center gap-2">
              <span className="material-symbols-outlined text-base">warning</span>
              <span>{errorProjects}</span>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </StoreProjectContext.Provider>
  );
};

export default StoreLayout;
