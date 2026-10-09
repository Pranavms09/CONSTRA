import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useStoreProject } from "./StoreLayout";
import { fetchChallans } from "../../api/store";
import { StatusBadge } from "../../components/store/StatusBadge";
import { EmptyState } from "../../components/store/EmptyState";
import { SkeletonLoader } from "../../components/store/SkeletonLoader";

export const DeliveriesList = () => {
  const { selectedProjectId } = useStoreProject();

  const [challans, setChallans] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  const loadDeliveries = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const data = await fetchChallans(selectedProjectId, {
        status: statusFilter || undefined,
        search: searchFilter || undefined,
        limit: 50,
      });
      setChallans(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Error loading deliveries:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeliveries();
  }, [selectedProjectId, statusFilter, searchFilter]);

  return (
    <div className="space-y-6">
      {/* Header and Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Vendor Delivery Challans</h2>
          <p className="text-xs text-slate-400">
            Scanned delivery paperwork, OCR extraction review, and BOQ reconciliation
          </p>
        </div>

        <Link
          to="/store/deliveries/new"
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 self-start sm:self-auto shadow-sm"
        >
          <span>📄</span>
          <span>Upload New Challan</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 w-full">
          <input
            type="text"
            placeholder="Search challan number, vendor name, or text..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 whitespace-nowrap">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-500 cursor-pointer w-full sm:w-auto"
          >
            <option value="">All Statuses</option>
            <option value="draft">Needs Review (Draft)</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonLoader rows={6} type="table" />
      ) : challans.length === 0 ? (
        <EmptyState
          icon="🚚"
          title="No delivery challans found"
          description={
            statusFilter || searchFilter
              ? "No challans match the selected filter criteria."
              : "Upload a vendor delivery slip to begin OCR extraction and reconciliation."
          }
          actionLabel="Upload First Challan"
          onAction={() => window.location.assign("/store/deliveries/new")}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Challan No</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Line Items</th>
                <th className="py-3 px-4">OCR Conf.</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {challans.map((ch) => (
                <tr key={ch.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3 px-4">
                    <StatusBadge status={ch.status} />
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-white">
                    {ch.challan_no || "PENDING"}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {ch.vendor_name || ch.vendor_name_raw || "—"}
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono">
                    {ch.challan_date || "—"}
                  </td>
                  <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                    {ch.items && ch.items.length > 0
                      ? ch.items
                          .map((it) => `${it.qty} ${it.unit} ${it.material_name || ""}`)
                          .join(", ")
                      : "No line items"}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400">
                    {ch.ocr_confidence ? `${Math.round(ch.ocr_confidence)}%` : "—"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      to={`/store/deliveries/${ch.id}`}
                      className={`px-3 py-1 rounded text-xs font-semibold transition ${
                        ch.status === "draft"
                          ? "bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                      }`}
                    >
                      {ch.status === "draft" ? "Review Draft →" : "View Details"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
