import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useStoreProject } from "./StoreLayout";
import { fetchStoreAlerts } from "../../api/store";
import { SeverityTag } from "../../components/store/SeverityTag";
import { EmptyState } from "../../components/store/EmptyState";
import { SkeletonLoader } from "../../components/store/SkeletonLoader";

export const StoreAlerts = () => {
  const { selectedProjectId } = useStoreProject();

  const [alerts, setAlerts] = useState([]);
  const [severityFilter, setSeverityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const loadAlerts = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const data = await fetchStoreAlerts(selectedProjectId, {
        severity: severityFilter || undefined,
        type: typeFilter || undefined,
      });
      setAlerts(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [selectedProjectId, severityFilter, typeFilter]);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">Store Delivery & Drawdown Alerts</h2>
        <p className="text-xs text-slate-400">
          Audit alerts linked to your uploaded delivery challans and recorded material issues
        </p>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Severity:</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-500 cursor-pointer"
          >
            <option value="">All Severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Alert Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-500 cursor-pointer"
          >
            <option value="">All Types</option>
            <option value="boq_over_delivery">BOQ Over-Delivery</option>
            <option value="consumption_anomaly">Consumption Anomaly</option>
            <option value="duplicate_challan">Duplicate Challan</option>
            <option value="unapproved_vendor">Unapproved Vendor</option>
            <option value="challan_date_invalid">Invalid Challan Date</option>
          </select>
        </div>
      </div>

      {/* Alerts List */}
      {loading ? (
        <SkeletonLoader rows={4} type="table" />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon="🛡️"
          title="No open alerts found"
          description="All delivery challans and material drawdowns comply with BOQ tolerance and milestone consumption rules."
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => {
            const isExpanded = expandedId === a.id;
            return (
              <div
                key={a.id}
                className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <SeverityTag severity={a.severity} />
                    <span className="text-xs font-mono font-bold text-white uppercase">
                      {a.type.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {a.status.toUpperCase()}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-slate-500">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {a.explanation}
                </p>

                {/* Linked References */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 pt-2 border-t border-slate-800/80">
                  {a.challan_id && (
                    <Link
                      to={`/store/deliveries/${a.challan_id}`}
                      className="text-amber-400 hover:text-amber-300 flex items-center gap-1"
                    >
                      <span>📄</span>
                      <span>Challan #{a.challan_id} →</span>
                    </Link>
                  )}

                  {a.issue_id && (
                    <span className="text-slate-300">
                      Issue #{a.issue_id}
                    </span>
                  )}

                  {a.evidence && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(a.id)}
                      className="text-slate-400 hover:text-white underline cursor-pointer text-[11px]"
                    >
                      {isExpanded ? "Hide Evidence JSON" : "Inspect Evidence JSON"}
                    </button>
                  )}
                </div>

                {/* Evidence Drawer */}
                {isExpanded && a.evidence && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                    <pre>{JSON.stringify(a.evidence, null, 2)}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
