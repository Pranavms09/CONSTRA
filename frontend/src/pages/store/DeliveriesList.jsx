import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useStoreProject } from "./StoreLayout";
import { fetchChallans } from "../../api/store";
import { StatusBadge } from "../../components/store/StatusBadge";
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
      <div className="p-6 bg-[#F2ECE6] border border-[#101010] shadow-[3px_3px_0px_#101010] relative">
        <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#101010]" />
        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#101010]" />
        <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#101010]" />
        <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#101010]" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 bg-[#FCBC18]" />
              <span className="font-label-code text-label-code uppercase tracking-widest text-[#504533]">
                SPEC // VENDOR-CHALLAN-INTAKE
              </span>
            </div>
            <h2 className="font-headline-lg text-headline-lg font-bold text-[#101010] uppercase tracking-tight">
              Vendor Delivery Challans
            </h2>
            <p className="font-label-meta text-label-meta text-[#5F5E5E] uppercase mt-1">
              SCANNED DELIVERY PAPERWORK, TEXT EXTRACTION REVIEW, AND BOQ RECONCILIATION
            </p>
          </div>

          <Link
            to="/store/deliveries/new"
            className="px-5 py-2.5 bg-[#FCBC18] hover:bg-[#101010] text-[#101010] hover:text-[#FCBC18] font-label-code text-label-code font-bold uppercase tracking-wider border border-[#101010] transition-colors shadow-[2px_2px_0px_#101010] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">upload_file</span>
            <span>UPLOAD NEW CHALLAN</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-[#F2ECE6] border border-[#101010] flex flex-col md:flex-row gap-4 items-center justify-between font-label-code text-label-code">
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="SEARCH CHALLAN # OR VENDOR..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-[#E6E2DD] border border-[#101010] px-3 py-2 text-[#101010] uppercase outline-none focus:border-[#FCBC18]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {[
            { label: "ALL STATUSES", val: "" },
            { label: "NEEDS REVIEW", val: "draft" },
            { label: "CONFIRMED", val: "confirmed" },
            { label: "PROCESSING", val: "processing" },
            { label: "FAILED", val: "failed" },
          ].map((f) => (
            <button
              key={f.val}
              onClick={() => setStatusFilter(f.val)}
              className={`px-3 py-1.5 border uppercase font-bold text-xs whitespace-nowrap cursor-pointer transition-colors ${
                statusFilter === f.val
                  ? "bg-[#101010] text-[#FCBC18] border-[#101010]"
                  : "bg-[#E6E2DD] text-[#5F5E5E] border-[#A39B8F]/50 hover:border-[#101010] hover:text-[#101010]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Deliveries Table */}
      {loading ? (
        <SkeletonLoader rows={5} type="table" />
      ) : challans.length === 0 ? (
        <div className="p-12 text-center bg-[#F2ECE6] border border-[#101010]">
          <span className="material-symbols-outlined text-4xl text-[#A39B8F] mb-2">
            receipt_long
          </span>
          <h3 className="font-headline-md text-headline-md uppercase font-bold text-[#101010]">
            NO DELIVERY CHALLANS FOUND
          </h3>
          <p className="font-body-md text-body-md text-[#5F5E5E] mt-1">
            Upload physical slip photos or scanned PDF dispatches to start text extraction.
          </p>
        </div>
      ) : (
        <div className="bg-[#F2ECE6] border border-[#101010] shadow-[2px_2px_0px_#101010] overflow-x-auto">
          <table className="w-full text-left border-collapse font-body-md">
            <thead>
              <tr className="bg-[#101010] text-[#F2ECE6] font-label-meta text-label-meta uppercase tracking-widest">
                <th className="py-3.5 px-4 border-r border-[#A39B8F]/30">CHALLAN REFERENCE</th>
                <th className="py-3.5 px-4 border-r border-[#A39B8F]/30">DISPATCH VENDOR</th>
                <th className="py-3.5 px-4 border-r border-[#A39B8F]/30">CHALLAN DATE</th>
                <th className="py-3.5 px-4 text-center border-r border-[#A39B8F]/30">ITEMS</th>
                <th className="py-3.5 px-4 border-r border-[#A39B8F]/30">STATUS</th>
                <th className="py-3.5 px-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#A39B8F]/30 font-label-code text-label-code text-[#101010]">
              {challans.map((ch, idx) => (
                <tr
                  key={ch.id}
                  className={`hover:bg-[#E6E2DD] transition-colors ${
                    idx % 2 === 0 ? "bg-[#F2ECE6]" : "bg-[#F2ECE6]/60"
                  }`}
                >
                  <td className="py-4 px-4 border-r border-[#A39B8F]/30 font-bold">
                    <span className="text-body-lg text-[#101010]">
                      {ch.challan_no || `CH-TEMP-${ch.id}`}
                    </span>
                  </td>
                  <td className="py-4 px-4 border-r border-[#A39B8F]/30 uppercase">
                    {ch.vendor_name_raw || "UNKNOWN VENDOR"}
                  </td>
                  <td className="py-4 px-4 border-r border-[#A39B8F]/30 text-[#5F5E5E]">
                    {ch.challan_date || "N/A"}
                  </td>
                  <td className="py-4 px-4 text-center border-r border-[#A39B8F]/30">
                    <span className="bg-[#E6E2DD] border border-[#101010] px-2 py-0.5 font-bold">
                      {ch.items?.length || 0}
                    </span>
                  </td>
                  <td className="py-4 px-4 border-r border-[#A39B8F]/30">
                    <StatusBadge status={ch.status} />
                  </td>
                  <td className="py-4 px-4 text-right">
                    <Link
                      to={`/store/deliveries/${ch.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#101010] text-[#F2ECE6] hover:bg-[#FCBC18] hover:text-[#101010] font-bold uppercase transition-colors"
                    >
                      <span>REVIEW</span>
                      <span className="material-symbols-outlined text-xs">
                        arrow_forward
                      </span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="p-3 bg-[#E6E2DD] border-t border-[#A39B8F]/30 flex items-center justify-between font-label-meta text-label-meta text-[#5F5E5E] uppercase">
            <span>SHOWING {challans.length} OF {total} RECORDED CHALLANS</span>
            <span>VERIFIED ON SITE // CONSTRA LEDGER</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveriesList;
