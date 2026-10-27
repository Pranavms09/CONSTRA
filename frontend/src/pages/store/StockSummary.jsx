import React, { useState, useEffect } from "react";
import { useStoreProject } from "./StoreLayout";
import { fetchStockSummary } from "../../api/store";
import { SkeletonLoader } from "../../components/store/SkeletonLoader";

export const StockSummary = () => {
  const { selectedProjectId, selectedProject } = useStoreProject();

  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedProjectId) return;
    async function loadStock() {
      setLoading(true);
      try {
        const data = await fetchStockSummary(selectedProjectId);
        setStock(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadStock();
  }, [selectedProjectId]);

  const hasNegativeStock = stock.some((s) => s.negative);

  return (
    <div className="space-y-6">
      {/* Top Architectural Header */}
      <div className="p-6 bg-[#F2ECE6] border border-[#101010] shadow-[3px_3px_0px_#101010] relative">
        <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#101010]" />
        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#101010]" />
        <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#101010]" />
        <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#101010]" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 bg-[#FCBC18]" />
              <span className="font-label-code text-label-code uppercase tracking-widest text-[#504533]">
                SPEC REF: CS-INV-SCHEDULE-01
              </span>
            </div>
            <h2 className="font-headline-lg text-headline-lg font-bold text-[#101010] uppercase tracking-tight">
              Project Stock &amp; Inventory Ledger
            </h2>
            <p className="font-label-meta text-label-meta text-[#5F5E5E] uppercase mt-1">
              LIVE PHYSICAL STORE INVENTORY COMPUTED FROM CONFIRMED CHALLANS VS RECORDED DRAWDOWNS FOR{" "}
              <strong className="text-[#101010]">{selectedProject?.name || "PROJECT SKELETON"}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-label-code text-label-code px-3 py-1 bg-[#101010] text-[#FCBC18] font-bold border border-[#101010]">
              {stock.length} ACTIVE MATERIALS
            </span>
          </div>
        </div>
      </div>

      {/* Negative Stock Alert */}
      {hasNegativeStock && (
        <div className="p-4 bg-[#ffdad6] border border-[#ba1a1a] text-[#ba1a1a] font-label-code text-label-code uppercase flex items-center gap-3">
          <span className="material-symbols-outlined text-xl">warning</span>
          <div>
            <strong>NEGATIVE STOCK TOLERANCE BREACH:</strong> One or more materials have more issued quantity than confirmed delivery paperwork. Ensure all vendor challans are uploaded and confirmed.
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonLoader rows={5} type="table" />
      ) : stock.length === 0 ? (
        <div className="p-12 text-center bg-[#F2ECE6] border border-[#101010]">
          <span className="material-symbols-outlined text-4xl text-[#A39B8F] mb-2">
            inventory_2
          </span>
          <h3 className="font-headline-md text-headline-md uppercase font-bold text-[#101010]">
            NO MATERIAL STOCK RECORDED
          </h3>
          <p className="font-body-md text-body-md text-[#5F5E5E] mt-1">
            Stock balances will appear as delivery challans are uploaded and confirmed.
          </p>
        </div>
      ) : (
        <div className="bg-[#F2ECE6] border border-[#101010] shadow-[2px_2px_0px_#101010] overflow-x-auto">
          <table className="w-full text-left border-collapse font-body-md">
            <thead>
              <tr className="bg-[#101010] text-[#F2ECE6] font-label-meta text-label-meta uppercase tracking-widest">
                <th className="py-3.5 px-4 border-r border-[#A39B8F]/30">MATERIAL SPECIFICATION</th>
                <th className="py-3.5 px-4 text-right border-r border-[#A39B8F]/30">DELIVERED (RECEIVED)</th>
                <th className="py-3.5 px-4 text-right border-r border-[#A39B8F]/30">ISSUED TO STAGES</th>
                <th className="py-3.5 px-4 text-right border-r border-[#A39B8F]/30">CURRENT IN STORE</th>
                <th className="py-3.5 px-4 text-right border-r border-[#A39B8F]/30">PLANNED IN BOQ</th>
                <th className="py-3.5 px-4 w-60">BOQ PROGRESS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#A39B8F]/30 font-label-code text-label-code text-[#101010]">
              {stock.map((item, idx) => {
                const received = Number(item.received_base || 0);
                const boq = Number(item.boq_planned_base || 0);
                const percent = boq > 0 ? Math.min(100, Math.round((received / boq) * 100)) : 0;

                return (
                  <tr
                    key={item.material_id || idx}
                    className={`hover:bg-[#E6E2DD] transition-colors ${
                      idx % 2 === 0 ? "bg-[#F2ECE6]" : "bg-[#F2ECE6]/60"
                    }`}
                  >
                    <td className="py-4 px-4 border-r border-[#A39B8F]/30 font-bold">
                      <div className="font-headline-md text-body-lg text-[#101010] uppercase">
                        {item.material_name}
                      </div>
                      <div className="font-label-meta text-label-meta text-[#5F5E5E] uppercase mt-0.5">
                        BASE UNIT: {item.base_unit}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right border-r border-[#A39B8F]/30 tabular-nums">
                      {received.toLocaleString()} {item.base_unit}
                    </td>
                    <td className="py-4 px-4 text-right border-r border-[#A39B8F]/30 text-[#5F5E5E] tabular-nums">
                      {Number(item.issued_base || 0).toLocaleString()} {item.base_unit}
                    </td>
                    <td className="py-4 px-4 text-right border-r border-[#A39B8F]/30">
                      <span
                        className={`font-bold tabular-nums px-2 py-0.5 border ${
                          item.negative
                            ? "bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]"
                            : "bg-[#93d5ad]/30 text-[#296a49] border-[#296a49]/30"
                        }`}
                      >
                        {Number(item.in_stock_base || 0).toLocaleString()} {item.base_unit}
                      </span>
                      {item.negative && (
                        <span className="block font-label-meta text-label-meta text-[#ba1a1a] font-bold mt-1 uppercase">
                          DEFICIT ⚠
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right border-r border-[#A39B8F]/30 tabular-nums text-[#5F5E5E]">
                      {boq > 0 ? `${boq.toLocaleString()} ${item.base_unit}` : "N/A"}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-between text-xs mb-1 font-label-code">
                        <span>{percent}%</span>
                        <span className="text-[#5F5E5E]">SCHEDULE</span>
                      </div>
                      <div className="w-full h-2 bg-[#E6E2DD] border border-[#101010] overflow-hidden">
                        <div
                          className="h-full bg-[#FCBC18]"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="p-3 bg-[#E6E2DD] border-t border-[#A39B8F]/30 flex items-center justify-between font-label-meta text-label-meta text-[#5F5E5E] uppercase">
            <span>SHOWING {stock.length} SCHEDULE ENTRIES</span>
            <span>SPEC COMPLIANT // ASTM-E2018</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockSummary;
