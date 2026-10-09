import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useStoreProject } from "./StoreLayout";
import { fetchMaterialIssues, fetchStages, fetchMaterials } from "../../api/store";
import { EmptyState } from "../../components/store/EmptyState";
import { SkeletonLoader } from "../../components/store/SkeletonLoader";

export const IssueHistory = () => {
  const { selectedProjectId } = useStoreProject();

  const [issues, setIssues] = useState([]);
  const [stages, setStages] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [stageFilter, setStageFilter] = useState("");
  const [materialFilter, setMaterialFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedProjectId) return;
    async function loadMeta() {
      try {
        const [stgs, mats] = await Promise.all([
          fetchStages(selectedProjectId),
          fetchMaterials(selectedProjectId),
        ]);
        setStages(stgs || []);
        setMaterials(mats || []);
      } catch (e) {
        console.error(e);
      }
    }
    loadMeta();
  }, [selectedProjectId]);

  const loadIssues = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const data = await fetchMaterialIssues(selectedProjectId, {
        stage_id: stageFilter || undefined,
        material_id: materialFilter || undefined,
      });
      setIssues(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, [selectedProjectId, stageFilter, materialFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Material Issue Log</h2>
          <p className="text-xs text-slate-400">
            Append-only historical ledger of materials issued from store to project stages
          </p>
        </div>

        <Link
          to="/store/issue"
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 self-start sm:self-auto shadow-sm"
        >
          <span>📤</span>
          <span>New Material Issue</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Stage:</span>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-500 cursor-pointer"
          >
            <option value="">All Stages</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Material:</span>
          <select
            value={materialFilter}
            onChange={(e) => setMaterialFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-500 cursor-pointer"
          >
            <option value="">All Materials</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonLoader rows={6} type="table" />
      ) : issues.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No material issues recorded"
          description="Log material drawdowns to track stage consumption against verified milestones."
          actionLabel="Issue Material"
          onAction={() => window.location.assign("/store/issue")}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Date / Time</th>
                <th className="py-3 px-4">Target Stage</th>
                <th className="py-3 px-4">Material</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4 text-right">Base Eq. (kg)</th>
                <th className="py-3 px-4">Issued To</th>
                <th className="py-3 px-4 text-center">Anomaly Flag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {issues.map((row) => (
                <tr key={row.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3 px-4 text-slate-400">
                    {new Date(row.issued_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-sans font-medium text-slate-200">
                    {row.stage_name}
                  </td>
                  <td className="py-3 px-4 font-sans font-medium text-white">
                    {row.material_name}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-200 font-semibold">
                    {Number(row.qty).toLocaleString()} {row.unit}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400">
                    {Number(row.qty_base).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-sans text-slate-300">
                    {row.issued_to}
                    {row.note && (
                      <span className="block text-[11px] text-slate-500 font-sans italic">
                        "{row.note}"
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {row.anomaly_flag ? (
                      <span
                        className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        title={row.anomaly_reasons?.join("; ") || "Statistically abnormal drawdown"}
                      >
                        ⚠️ ANOMALY
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        NORMAL
                      </span>
                    )}
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
