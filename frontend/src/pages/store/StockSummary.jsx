import React, { useState, useEffect } from "react";
import { useStoreProject } from "./StoreLayout";
import { fetchStockSummary } from "../../api/store";
import { BoqProgressBar } from "../../components/store/BoqProgressBar";
import { EmptyState } from "../../components/store/EmptyState";
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
      <div>
        <h2 className="text-lg font-bold text-white">Project Stock & Inventory Ledger</h2>
        <p className="text-xs text-slate-400">
          Live physical store inventory computed from confirmed challans vs recorded drawdowns for{" "}
          <strong className="text-slate-200">{selectedProject?.name}</strong>
        </p>
      </div>

      {hasNegativeStock && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <strong>Negative Stock Warning:</strong> One or more materials have more issued quantity than confirmed delivery paperwork. Ensure all vendor challans are uploaded and confirmed.
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonLoader rows={4} type="table" />
      ) : stock.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No material stock recorded"
          description="Stock balances will appear as delivery challans are confirmed."
        />
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Material Name</th>
                  <th className="py-3 px-4 text-right">Delivered (Received)</th>
                  <th className="py-3 px-4 text-right">Issued to Stages</th>
                  <th className="py-3 px-4 text-right">Current In Store</th>
                  <th className="py-3 px-4 text-right">Planned in BOQ</th>
                  <th className="py-3 px-4 w-64">BOQ Delivery Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {stock.map((item) => (
                  <tr key={item.material_id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-4 px-4 font-sans font-medium text-white">
                      <div>{item.material_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Base unit: {item.base_unit}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right text-slate-200">
                      {Number(item.received_base).toLocaleString()} {item.base_unit}
                    </td>
                    <td className="py-4 px-4 text-right text-slate-400">
                      {Number(item.issued_base).toLocaleString()} {item.base_unit}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span
                        className={`font-bold text-sm ${
                          item.negative
                            ? "text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30"
                            : "text-emerald-400"
                        }`}
                      >
                        {Number(item.in_stock_base).toLocaleString()} {item.base_unit}
                      </span>
                      {item.negative && (
                        <span className="block text-[10px] text-rose-400 font-semibold mt-0.5">
                          DEFICIT ⚠️
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right text-slate-400">
                      {Number(item.planned_base).toLocaleString()} {item.base_unit}
                    </td>
                    <td className="py-4 px-4 font-sans">
                      <BoqProgressBar
                        delivered={item.received_base}
                        planned={item.planned_base}
                        tolerancePct={5}
                        unit={item.base_unit}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
