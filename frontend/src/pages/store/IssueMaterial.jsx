import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStoreProject } from "./StoreLayout";
import {
  fetchStages,
  fetchMaterials,
  previewIssue,
  logMaterialIssue,
} from "../../api/store";
import { AnomalyBanner } from "../../components/store/AnomalyBanner";
import { Toast } from "../../components/store/Toast";

export const IssueMaterial = () => {
  const { selectedProjectId, selectedProject } = useStoreProject();
  const navigate = useNavigate();

  const [stages, setStages] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Form Fields
  const [stageId, setStageId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("kg");
  const [issuedTo, setIssuedTo] = useState("");
  const [note, setNote] = useState("");

  // Live Anomaly Preview State
  const [previewResult, setPreviewResult] = useState(null);
  const [evaluatingPreview, setEvaluatingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  useEffect(() => {
    if (!selectedProjectId) return;
    let mounted = true;

    async function loadMeta() {
      try {
        setLoadingMeta(true);
        const [stgs, mats] = await Promise.all([
          fetchStages(selectedProjectId),
          fetchMaterials(selectedProjectId),
        ]);
        if (mounted) {
          setStages(stgs || []);
          setMaterials(mats || []);
          if (stgs && stgs.length > 0) setStageId(String(stgs[0].id));
          if (mats && mats.length > 0) setMaterialId(String(mats[0].id));
        }
      } catch (err) {
        if (mounted) setErrorMessage(err.message || "Failed to load project metadata");
      } finally {
        if (mounted) setLoadingMeta(false);
      }
    }

    loadMeta();
    return () => {
      mounted = false;
    };
  }, [selectedProjectId]);

  // Debounced Live Preview Evaluation
  useEffect(() => {
    if (!stageId || !materialId || !qty || Number(qty) <= 0) {
      setPreviewResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      setEvaluatingPreview(true);
      try {
        const res = await previewIssue({
          stage_id: Number(stageId),
          material_id: Number(materialId),
          qty: Number(qty),
          unit: unit,
        });
        setPreviewResult(res);
      } catch (e) {
        console.error("Preview error:", e);
      } finally {
        setEvaluatingPreview(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [stageId, materialId, qty, unit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stageId || !materialId || !qty || !issuedTo) {
      setErrorMessage("Please complete all required fields (*).");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        stage_id: Number(stageId),
        material_id: Number(materialId),
        qty: Number(qty),
        unit: unit,
        issued_to: issuedTo,
        note: note || null,
      };

      const result = await logMaterialIssue(stageId, payload);
      setToastMsg(
        result.anomaly_flag
          ? "Material issued successfully (Flagged for audit tracking)."
          : "Material issued to stage successfully."
      );

      // Reset qty and note, redirect after brief moment
      setTimeout(() => {
        navigate("/store/issues");
      }, 1000);
    } catch (err) {
      setErrorMessage(err.message || "Failed to log material issue.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedStageObj = stages.find((s) => s.id === Number(stageId));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Toast message={toastMsg} onClose={() => setToastMsg(null)} />

      <div>
        <h2 className="text-xl font-bold text-white">Issue Material from Store</h2>
        <p className="text-xs text-slate-400 mt-1">
          Dispense materials to active construction stages for{" "}
          <strong className="text-slate-200">{selectedProject?.name}</strong>.
          Consumption is checked against stage milestone progress.
        </p>
      </div>

      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Stage Selection */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              Target Milestone Stage *
            </label>
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500 cursor-pointer"
            >
              {stages.map((stg) => (
                <option key={stg.id} value={stg.id}>
                  Stage #{stg.order}: {stg.name} (Progress: {(stg.verified_progress * 100).toFixed(0)}%)
                </option>
              ))}
            </select>
            {selectedStageObj && (
              <p className="text-[11px] text-slate-400 font-mono">
                Verified Progress: {(selectedStageObj.verified_progress * 100).toFixed(1)}% • Status: {selectedStageObj.status}
              </p>
            )}
          </div>

          {/* Material Selection */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              Material *
            </label>
            <select
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500 cursor-pointer"
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (Base unit: {m.base_unit})
                </option>
              ))}
            </select>
          </div>

          {/* Quantity & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-300">
                Quantity to Issue *
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="e.g. 100"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-300">
                Unit *
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500 cursor-pointer"
              >
                <option value="kg">kg</option>
                <option value="bag">bag (50kg)</option>
                <option value="tonne">tonne (1000kg)</option>
                <option value="bundle">bundle (50kg)</option>
              </select>
            </div>
          </div>

          {/* Issued To Recipient */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              Issued To (Recipient / Subcontractor) *
            </label>
            <input
              type="text"
              placeholder="e.g. Foreman John / Apex Structural Works"
              value={issuedTo}
              onChange={(e) => setIssuedTo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500"
            />
          </div>

          {/* Note */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              Notes / Purpose (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Foundation pile concreting"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500 resize-none"
            />
          </div>

          {/* Live Anomaly Evaluation Banner */}
          {evaluatingPreview && (
            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 animate-pulse">
              <span>⏳</span>
              <span>Evaluating milestone consumption model...</span>
            </div>
          )}

          {previewResult && <AnomalyBanner anomalyResult={previewResult} />}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 transition disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {submitting ? "Logging Issue..." : "📤 Confirm & Record Material Issue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
