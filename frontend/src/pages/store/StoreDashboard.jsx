import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useStoreProject } from "./StoreLayout";
import { fetchChallans, fetchStockSummary, fetchStoreAlerts } from "../../api/store";
import { StatusBadge } from "../../components/store/StatusBadge";
import { SeverityTag } from "../../components/store/SeverityTag";
import { SkeletonLoader } from "../../components/store/SkeletonLoader";

export const StoreDashboard = () => {
  const { selectedProjectId, selectedProject, loadingProjects } = useStoreProject();

  const [challans, setChallans] = useState([]);
  const [stock, setStock] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedProjectId) return;
    let mounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const [chData, stData, alData] = await Promise.all([
          fetchChallans(selectedProjectId, { limit: 5 }),
          fetchStockSummary(selectedProjectId),
          fetchStoreAlerts(selectedProjectId, { limit: 5 }),
        ]);
        if (mounted) {
          setChallans(chData.items || []);
          setStock(stData || []);
          setAlerts(alData || []);
        }
      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [selectedProjectId]);

  if (loadingProjects || (loading && !stock.length)) {
    return <SkeletonLoader rows={4} type="card" />;
  }

  const draftsCount = challans.filter((c) => c.status === "draft").length;
  const confirmedCount = challans.filter((c) => c.status === "confirmed").length;
  const openAlertsCount = alerts.length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-amber-950/20 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono text-amber-400 font-semibold tracking-wider uppercase">
            Store & Inventory Workspace
          </span>
          <h2 className="text-xl font-bold text-white mt-1">
            {selectedProject?.name || "Apex Tower — Commercial Block A"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {selectedProject?.site_address || "Sector 62, Noida, Uttar Pradesh"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/store/deliveries/new"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-1.5"
          >
            <span>📄</span>
            <span>Upload Challan</span>
          </Link>
          <Link
            to="/store/issue"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
          >
            <span>📤</span>
            <span>Issue Material</span>
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400">Total Challans</span>
          <p className="text-2xl font-bold font-mono text-white">{challans.length}</p>
          <span className="text-[11px] text-slate-500 font-mono">Recorded in project</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400">Pending Review</span>
          <p className="text-2xl font-bold font-mono text-amber-400">{draftsCount}</p>
          <span className="text-[11px] text-amber-500/80 font-mono">Needs field confirmation</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400">Materials In Stock</span>
          <p className="text-2xl font-bold font-mono text-emerald-400">{stock.length}</p>
          <span className="text-[11px] text-slate-500 font-mono">Active catalog items</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
          <span className="text-xs text-slate-400">Open Store Alerts</span>
          <p className="text-2xl font-bold font-mono text-rose-400">{openAlertsCount}</p>
          <span className="text-[11px] text-rose-500/80 font-mono">Flagged items</span>
        </div>
      </div>

      {/* 2-Column Section: Recent Challans & Current Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Challans Card */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>🚚</span>
              <span>Recent Delivery Challans</span>
            </h3>
            <Link
              to="/store/deliveries"
              className="text-xs text-amber-400 hover:text-amber-300 font-medium"
            >
              View all ↗
            </Link>
          </div>

          {challans.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
              No delivery challans uploaded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {challans.map((ch) => (
                <Link
                  key={ch.id}
                  to={`/store/deliveries/${ch.id}`}
                  className="p-3 rounded-xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between gap-3 block"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-white truncate">
                        {ch.challan_no || "Challan #" + ch.id}
                      </span>
                      <StatusBadge status={ch.status} />
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      {ch.vendor_name || ch.vendor_name_raw || "Unknown Vendor"} • {ch.challan_date || "No date"}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {ch.items?.length || 0} items →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Current Stock Preview */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📦</span>
              <span>Stock Snapshot</span>
            </h3>
            <Link
              to="/store/stock"
              className="text-xs text-amber-400 hover:text-amber-300 font-medium"
            >
              Detailed table ↗
            </Link>
          </div>

          {stock.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
              No material stock recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {stock.map((item) => (
                <div
                  key={item.material_id}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-semibold text-white">{item.material_name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Received: {item.received_base} {item.base_unit} • Issued: {item.issued_base} {item.base_unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-sm font-bold font-mono ${
                        item.negative ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {item.in_stock_base} {item.base_unit}
                    </span>
                    <span className="block text-[10px] text-slate-500 font-mono">In Store</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Alerts Section */}
      {alerts.length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>🚨</span>
              <span>Recent Delivery & Drawdown Alerts</span>
            </h3>
            <Link to="/store/alerts" className="text-xs text-amber-400 hover:text-amber-300 font-medium">
              View all {alerts.length} alerts ↗
            </Link>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 3).map((a) => (
              <div
                key={a.id}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <SeverityTag severity={a.severity} />
                    <span className="text-xs font-mono font-medium text-slate-300">
                      {a.type.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{a.explanation}</p>
                </div>
                <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                  {new Date(a.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
