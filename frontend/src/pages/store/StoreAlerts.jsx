import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useStoreProject } from "./StoreLayout";
import { fetchStoreAlerts } from "../../api/store";
import { SeverityTag } from "../../components/store/SeverityTag";
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
      {/* Top Architectural Header */}
      <div className="p-6 bg-[#F2ECE6] border border-[#101010] shadow-[3px_3px_0px_#101010] relative">
        <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#101010]" />
        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#101010]" />
        <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#101010]" />
        <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#101010]" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 bg-[#B3261E]" />
              <span className="font-label-code text-label-code uppercase tracking-widest text-[#504533]">
                SPEC // ANOMALY-TELEMETRY-STREAM
              </span>
            </div>
            <h2 className="font-headline-lg text-headline-lg font-bold text-[#101010] uppercase tracking-tight">
              Store Delivery &amp; Drawdown Alerts
            </h2>
            <p className="font-label-meta text-label-meta text-[#5F5E5E] uppercase mt-1">
              AUDIT ALERTS LINKED TO UPLOADED DELIVERY CHALLANS, INVENTORY DEFICITS, AND RECORDED MATERIAL ISSUES
            </p>
          </div>

          <span className="font-label-code text-label-code px-3 py-1 bg-[#101010] text-[#FCBC18] font-bold border border-[#101010]">
            {alerts.length} ALERTS ACTIVE
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-[#F2ECE6] border border-[#101010] flex flex-wrap items-center gap-4 font-label-code text-label-code">
        <div className="flex items-center gap-2">
          <span className="text-[#5F5E5E] uppercase">SEVERITY:</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-[#E6E2DD] border border-[#101010] px-3 py-1.5 uppercase font-bold text-[#101010] outline-none"
          >
            <option value="">ALL SEVERITIES</option>
            <option value="critical">CRITICAL</option>
            <option value="warning">WARNING</option>
            <option value="info">INFO</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#5F5E5E] uppercase">TYPE:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-[#E6E2DD] border border-[#101010] px-3 py-1.5 uppercase font-bold text-[#101010] outline-none"
          >
            <option value="">ALL ALERT TYPES</option>
            <option value="drawdown_anomaly">DRAWDOWN ANOMALY</option>
            <option value="ocr_flag">OCR MISMATCH</option>
            <option value="negative_stock">NEGATIVE STOCK</option>
            <option value="boq_exceeded">BOQ EXCEEDED</option>
          </select>
        </div>
      </div>

      {/* Alerts Feed */}
      {loading ? (
        <SkeletonLoader rows={4} type="card" />
      ) : alerts.length === 0 ? (
        <div className="p-12 text-center bg-[#F2ECE6] border border-[#101010]">
          <span className="material-symbols-outlined text-4xl text-[#2F6F4E] mb-2">
            check_circle
          </span>
          <h3 className="font-headline-md text-headline-md uppercase font-bold text-[#101010]">
            ZERO ACTIVE DISCREPANCY ALERTS
          </h3>
          <p className="font-body-md text-body-md text-[#5F5E5E] mt-1">
            All recent deliveries and material drawdowns conform strictly to BOQ milestone envelopes.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((al) => {
            const isExpanded = expandedId === al.id;
            return (
              <div
                key={al.id}
                className="p-5 bg-[#F2ECE6] border border-[#101010] shadow-[2px_2px_0px_#101010] space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <SeverityTag severity={al.severity} />
                    <span className="font-headline-md text-headline-md font-bold uppercase text-[#101010]">
                      {al.alert_type?.replace(/_/g, " ")}
                    </span>
                    <span className="font-label-meta text-label-meta text-[#8C8B91] uppercase">
                      ID: ALT-{al.id}
                    </span>
                  </div>

                  <span className="font-label-meta text-label-meta text-[#5F5E5E] uppercase">
                    {new Date(al.created_at).toLocaleString()}
                  </span>
                </div>

                <p className="font-body-md text-body-md text-[#101010]">
                  {al.message}
                </p>

                {/* Action Link & Expand Toggle */}
                <div className="pt-3 border-t border-[#A39B8F]/30 flex flex-wrap items-center justify-between gap-3 font-label-code text-label-code">
                  <div className="flex items-center gap-3">
                    {al.challan_id && (
                      <Link
                        to={`/store/deliveries/${al.challan_id}`}
                        className="text-[#7a5900] font-bold hover:underline uppercase flex items-center gap-1"
                      >
                        <span>VIEW CHALLAN #{al.challan_id}</span>
                        <span className="material-symbols-outlined text-xs">arrow_forward</span>
                      </Link>
                    )}
                    {al.stage_id && (
                      <span className="text-[#5F5E5E] uppercase">
                        STAGE REF: #{al.stage_id}
                      </span>
                    )}
                  </div>

                  {al.metadata && Object.keys(al.metadata).length > 0 && (
                    <button
                      onClick={() => toggleExpand(al.id)}
                      className="px-2.5 py-1 bg-[#E6E2DD] hover:bg-[#101010] hover:text-[#FCBC18] text-[#101010] border border-[#101010] uppercase font-bold text-xs cursor-pointer transition-colors"
                      type="button"
                    >
                      {isExpanded ? "HIDE AUDIT METADATA ▲" : "INSPECT METADATA ▼"}
                    </button>
                  )}
                </div>

                {/* Expanded Metadata Block */}
                {isExpanded && al.metadata && (
                  <div className="p-3 bg-[#E6E2DD] border border-[#101010] font-label-code text-label-code overflow-x-auto">
                    <pre className="text-xs text-[#101010]">
                      {JSON.stringify(al.metadata, null, 2)}
                    </pre>
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

export default StoreAlerts;
