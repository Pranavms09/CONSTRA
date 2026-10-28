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
      {/* Top Architectural Banner */}
      <div className="p-6 bg-[#F2ECE6] border border-[#101010] shadow-[3px_3px_0px_#101010] relative">
        {/* Corner Crop Marks */}
        <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#101010]" />
        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#101010]" />
        <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#101010]" />
        <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#101010]" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 bg-[#FCBC18]" />
              <span className="font-label-code text-label-code uppercase tracking-widest text-[#504533]">
                STORE-OPS // SECTOR-02-INV
              </span>
            </div>
            <h2 className="font-headline-lg text-headline-lg font-bold text-[#101010] uppercase tracking-tight">
              {selectedProject?.name || "Shree Construction, Nashik"}
            </h2>
            <p className="font-label-meta text-label-meta text-[#5F5E5E] uppercase mt-1">
              SITE LOCATION: {selectedProject?.site_address || "206, Dindori Road, Mhasrul, Nashik, Maharashtra 422004"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/store/deliveries/new"
              className="px-5 py-2.5 bg-[#FCBC18] hover:bg-[#101010] text-[#101010] hover:text-[#FCBC18] font-label-code text-label-code font-bold uppercase tracking-wider border border-[#101010] transition-colors shadow-[2px_2px_0px_#101010] flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">upload_file</span>
              <span>UPLOAD CHALLAN</span>
            </Link>
            <Link
              to="/store/issue"
              className="px-5 py-2.5 bg-[#E6E2DD] hover:bg-[#101010] text-[#101010] hover:text-[#F2ECE6] font-label-code text-label-code font-bold uppercase tracking-wider border border-[#101010] transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">output</span>
              <span>ISSUE MATERIAL</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 4 Technical Metric Spec Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tile 1 */}
        <div className="p-4 bg-[#F2ECE6] border border-[#101010] flex flex-col justify-between">
          <span className="font-label-meta text-label-meta text-[#5F5E5E] uppercase tracking-wider block mb-1">
            RECORDED CHALLANS
          </span>
          <p className="font-headline-lg text-display-lg-mobile font-bold text-[#101010] tabular-nums">
            {challans.length}
          </p>
          <span className="font-label-code text-label-code text-[#8C8B91] uppercase mt-2 pt-2 border-t border-[#A39B8F]/30">
            TOTAL IN REGISTER
          </span>
        </div>

        {/* Tile 2 */}
        <div className="p-4 bg-[#F2ECE6] border border-[#101010] border-t-4 border-t-[#FCBC18] flex flex-col justify-between">
          <span className="font-label-meta text-label-meta text-[#5F5E5E] uppercase tracking-wider block mb-1">
            PENDING VERIFICATION
          </span>
          <p className="font-headline-lg text-display-lg-mobile font-bold text-[#7a5900] tabular-nums">
            {draftsCount}
          </p>
          <span className="font-label-code text-label-code text-[#7a5900] uppercase mt-2 pt-2 border-t border-[#A39B8F]/30 font-bold">
            NEEDS FIELD AUDIT
          </span>
        </div>

        {/* Tile 3 */}
        <div className="p-4 bg-[#F2ECE6] border border-[#101010] border-t-4 border-t-[#2F6F4E] flex flex-col justify-between">
          <span className="font-label-meta text-label-meta text-[#5F5E5E] uppercase tracking-wider block mb-1">
            CONFIRMED DELIVERIES
          </span>
          <p className="font-headline-lg text-display-lg-mobile font-bold text-[#2F6F4E] tabular-nums">
            {confirmedCount}
          </p>
          <span className="font-label-code text-label-code text-[#2F6F4E] uppercase mt-2 pt-2 border-t border-[#A39B8F]/30 font-bold">
            MATCHED TO BOQ
          </span>
        </div>

        {/* Tile 4 */}
        <div className="p-4 bg-[#F2ECE6] border border-[#101010] border-t-4 border-t-[#B3261E] flex flex-col justify-between">
          <span className="font-label-meta text-label-meta text-[#5F5E5E] uppercase tracking-wider block mb-1">
            ACTIVE TOLERANCE ALERTS
          </span>
          <p className="font-headline-lg text-display-lg-mobile font-bold text-[#B3261E] tabular-nums">
            {openAlertsCount}
          </p>
          <span className="font-label-code text-label-code text-[#B3261E] uppercase mt-2 pt-2 border-t border-[#A39B8F]/30 font-bold">
            REQUIRES RESOLUTION
          </span>
        </div>
      </div>

      {/* Main Split Grid (7 Cols Left, 5 Cols Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Recent Delivery Challans */}
        <div className="lg:col-span-7 bg-[#F2ECE6] border border-[#101010] shadow-[2px_2px_0px_#101010] flex flex-col">
          {/* Header */}
          <div className="p-4 bg-[#101010] text-[#F2ECE6] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#FCBC18]" />
              <span className="font-headline-md text-headline-md uppercase font-bold tracking-wider">
                RECENT DELIVERY CHALLANS
              </span>
            </div>
            <Link
              to="/store/deliveries"
              className="font-label-code text-label-code uppercase text-[#FCBC18] hover:underline"
            >
              VIEW ALL ({challans.length}) →
            </Link>
          </div>

          {/* List Rows */}
          {challans.length === 0 ? (
            <div className="p-8 text-center font-label-code text-label-code text-[#5F5E5E] uppercase">
              NO CHALLANS LOGGED YET. CLICK "UPLOAD CHALLAN" TO BEGIN.
            </div>
          ) : (
            <div className="divide-y divide-[#A39B8F]/30">
              {challans.map((ch) => (
                <Link
                  key={ch.id}
                  to={`/store/deliveries/${ch.id}`}
                  className="p-4 hover:bg-[#E6E2DD] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-headline-md text-headline-md font-bold text-[#101010] uppercase tracking-wide group-hover:text-[#7a5900]">
                        {ch.challan_no || `CH-TEMP-${ch.id}`}
                      </span>
                      <StatusBadge status={ch.status} />
                    </div>
                    <div className="flex items-center gap-2 font-label-meta text-label-meta text-[#5F5E5E] uppercase">
                      <span>{ch.vendor_name_raw || "UNKNOWN VENDOR"}</span>
                      <span>•</span>
                      <span>{ch.challan_date || "NO DATE REGISTERED"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    <span className="font-label-code text-label-code bg-[#E6E2DD] border border-[#101010] px-2 py-1 text-[#101010] font-bold">
                      {ch.items?.length || 0} ITEMS
                    </span>
                    <div className="w-8 h-8 bg-[#101010] text-[#F2ECE6] group-hover:bg-[#FCBC18] group-hover:text-[#101010] transition-colors flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm">
                        arrow_forward
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Footer Bar */}
          <div className="p-3 bg-[#E6E2DD] border-t border-[#A39B8F]/30 flex items-center justify-between font-label-meta text-label-meta text-[#5F5E5E] uppercase">
            <span>SHOWING {Math.min(5, challans.length)} OF {challans.length} RECORDS</span>
            <span>INTEGRITY VERIFIED // CONSTRA-CORE</span>
          </div>
        </div>

        {/* RIGHT COLUMN: Stock Snapshot & Alerts */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Stock Snapshot Card */}
          <div className="bg-[#F2ECE6] border border-[#101010] shadow-[2px_2px_0px_#101010]">
            <div className="p-4 bg-[#101010] text-[#F2ECE6] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#FCBC18]" />
                <span className="font-headline-md text-headline-md uppercase font-bold tracking-wider">
                  STOCK SNAPSHOT
                </span>
              </div>
              <Link
                to="/store/stock"
                className="font-label-code text-label-code uppercase text-[#FCBC18] hover:underline"
              >
                DETAILED TABLE →
              </Link>
            </div>

            <div className="p-4 flex flex-col gap-4">
              {stock.length === 0 ? (
                <div className="py-6 text-center font-label-code text-label-code text-[#5F5E5E] uppercase">
                  NO MATERIAL INVENTORY RECORDED
                </div>
              ) : (
                stock.slice(0, 4).map((item) => {
                  const percent =
                    item.min_threshold && item.min_threshold > 0
                      ? Math.min(100, Math.round((item.current_qty / item.min_threshold) * 100))
                      : 80;
                  const isLow = item.min_threshold && item.current_qty < item.min_threshold;

                  return (
                    <div
                      key={item.id || item.material_name}
                      className="p-3 bg-[#E6E2DD] border border-[#A39B8F]/40 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-headline-md text-body-lg font-bold text-[#101010] uppercase">
                          {item.material_name}
                        </span>
                        <span
                          className={`font-label-code text-label-code px-1.5 py-0.5 border font-bold uppercase ${
                            isLow
                              ? "bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]"
                              : "bg-[#93d5ad]/30 text-[#296a49] border-[#296a49]/30"
                          }`}
                        >
                          {isLow ? "DEFICIT" : "NOMINAL"}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between font-label-code text-label-code">
                        <span className="text-[#5F5E5E]">
                          CURRENT: <span className="font-bold text-[#101010] text-body-lg">{item.current_qty}</span> {item.unit}
                        </span>
                        {item.min_threshold && (
                          <span className="text-[#8C8B91]">
                            MIN: {item.min_threshold} {item.unit}
                          </span>
                        )}
                      </div>

                      {/* Hard Offset Meter Bar */}
                      <div className="w-full h-2 bg-[#F2ECE6] border border-[#101010] overflow-hidden">
                        <div
                          className={`h-full ${isLow ? "bg-[#B3261E]" : "bg-[#FCBC18]"}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Store Alerts Card */}
          <div className="bg-[#F2ECE6] border border-[#101010] shadow-[2px_2px_0px_#101010]">
            <div className="p-4 bg-[#101010] text-[#F2ECE6] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#B3261E]" />
                <span className="font-headline-md text-headline-md uppercase font-bold tracking-wider">
                  DISCREPANCY ALERTS
                </span>
              </div>
              <Link
                to="/store/alerts"
                className="font-label-code text-label-code uppercase text-[#FCBC18] hover:underline"
              >
                ALL ALERTS ({alerts.length}) →
              </Link>
            </div>

            <div className="p-4 divide-y divide-[#A39B8F]/30">
              {alerts.length === 0 ? (
                <div className="py-4 text-center font-label-code text-label-code text-[#2F6F4E] uppercase">
                  ✓ ZERO ACTIVE DISCREPANCIES DETECTED
                </div>
              ) : (
                alerts.slice(0, 3).map((al) => (
                  <div key={al.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <SeverityTag severity={al.severity} />
                        <span className="font-label-code text-label-code font-bold text-[#101010] uppercase">
                          {al.alert_type}
                        </span>
                      </div>
                      <p className="font-body-sm text-body-sm text-[#5F5E5E]">
                        {al.message}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreDashboard;
