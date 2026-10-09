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
import { saveIssueToFirestore, saveAlertToFirestore } from "../../services/firebaseDataService";

export const IssueMaterial = () => {
  const { selectedProjectId, selectedProject } = useStoreProject();
  const navigate = useNavigate();

  const [stages, setStages] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [, setLoadingMeta] = useState(true);

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
    setErrorMessage(null);

    if (!stageId || !materialId || !qty || Number(qty) <= 0 || !issuedTo.trim()) {
      setErrorMessage("Please fill all required fields with valid values.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await logMaterialIssue(selectedProjectId, {
        stage_id: Number(stageId),
        material_id: Number(materialId),
        qty: Number(qty),
        unit: unit,
        issued_to: issuedTo.trim(),
        note: note.trim() || undefined,
      });

      // Sync issue to Firebase Firestore
      await saveIssueToFirestore({
        ...res,
        project_id: selectedProjectId,
        stage_name: selectedStageObj?.name,
        issued_to: issuedTo.trim(),
      });

      // If anomaly detected, sync alert to Firebase Firestore
      if (previewResult?.anomaly) {
        await saveAlertToFirestore({
          project_id: selectedProjectId,
          type: "MATERIAL_OVER_ISSUANCE",
          severity: "HIGH",
          message: previewResult.message || `Anomalous drawdown of ${qty} ${unit} issued to ${issuedTo}.`,
          status: "open",
        });
      }

      setToastMsg(`Material issue recorded & synced to Firebase. Ref: ISS-${res.id}`);
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
    <div className="max-w-3xl mx-auto space-y-6">
      <Toast message={toastMsg} onClose={() => setToastMsg(null)} />

      {/* Top Architectural Header */}
      <div className="p-6 bg-[#F2ECE6] border border-[#101010] shadow-[3px_3px_0px_#101010] relative">
        <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#101010]" />
        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#101010]" />
        <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#101010]" />
        <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#101010]" />

        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 bg-[#FCBC18]" />
          <span className="font-label-code text-label-code uppercase tracking-widest text-[#504533]">
            SPEC // MATERIAL-DRAWDOWN-DISPATCH
          </span>
        </div>
        <h2 className="font-headline-lg text-headline-lg font-bold text-[#101010] uppercase tracking-tight">
          Issue Material from Store
        </h2>
        <p className="font-label-meta text-label-meta text-[#5F5E5E] uppercase mt-1">
          DISPENSE RAW MATERIALS TO ACTIVE STAGES FOR{" "}
          <strong className="text-[#101010]">{selectedProject?.name || "ACTIVE SITE"}</strong>.
          CONSUMPTION IS AUDITED AGAINST VERIFIED STRUCTURAL PROGRESS.
        </p>
      </div>

      {/* Form Card */}
      <div className="p-6 md:p-8 bg-[#F2ECE6] border border-[#101010] shadow-[3px_3px_0px_#101010] space-y-6">
        {errorMessage && (
          <div className="p-3 bg-[#ffdad6] border border-[#ba1a1a] text-[#ba1a1a] font-label-code text-label-code uppercase flex items-center gap-2">
            <span className="material-symbols-outlined text-base">warning</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Stage Selection */}
          <div className="space-y-1">
            <label className="font-label-meta text-label-meta uppercase text-[#504533] block">
              TARGET MILESTONE STAGE *
            </label>
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className="w-full bg-[#E6E2DD] border border-[#101010] px-3 py-2.5 font-label-code text-label-code text-[#101010] uppercase outline-none focus:border-[#FCBC18] cursor-pointer"
            >
              {stages.map((stg) => (
                <option key={stg.id} value={stg.id}>
                  STAGE #{stg.order}: {stg.name} (PROGRESS: {(stg.verified_progress * 100).toFixed(0)}%)
                </option>
              ))}
            </select>
            {selectedStageObj && (
              <p className="font-label-meta text-label-meta text-[#5F5E5E] uppercase mt-1">
                VERIFIED PROGRESS: {(selectedStageObj.verified_progress * 100).toFixed(1)}% • CLEARANCE STATUS: {selectedStageObj.status?.toUpperCase()}
              </p>
            )}
          </div>

          {/* Material Selection */}
          <div className="space-y-1">
            <label className="font-label-meta text-label-meta uppercase text-[#504533] block">
              MATERIAL SPECIFICATION *
            </label>
            <select
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              className="w-full bg-[#E6E2DD] border border-[#101010] px-3 py-2.5 font-label-code text-label-code text-[#101010] uppercase outline-none focus:border-[#FCBC18] cursor-pointer"
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (BASE UNIT: {m.base_unit})
                </option>
              ))}
            </select>
          </div>

          {/* Quantity & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-label-meta text-label-meta uppercase text-[#504533] block">
                QUANTITY TO ISSUE *
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="e.g. 100"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full bg-[#E6E2DD] border border-[#101010] px-3 py-2 text-[#101010] font-label-code text-label-code uppercase outline-none focus:border-[#FCBC18]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-label-meta text-label-meta uppercase text-[#504533] block">
                DISPENSE UNIT *
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-[#E6E2DD] border border-[#101010] px-3 py-2.5 font-label-code text-label-code text-[#101010] uppercase outline-none focus:border-[#FCBC18] cursor-pointer"
              >
                <option value="kg">kg (Kilograms)</option>
                <option value="bag">bag (50kg cement bag)</option>
                <option value="tonne">tonne (1,000kg metric tonne)</option>
                <option value="bundle">bundle (50kg rebar bundle)</option>
              </select>
            </div>
          </div>

          {/* Issued To Recipient */}
          <div className="space-y-1">
            <label className="font-label-meta text-label-meta uppercase text-[#504533] block">
              ISSUED TO (RECIPIENT / SUBCONTRACTOR) *
            </label>
            <input
              type="text"
              placeholder="e.g. Foreman John / Apex Structural Works"
              value={issuedTo}
              onChange={(e) => setIssuedTo(e.target.value)}
              className="w-full bg-[#E6E2DD] border border-[#101010] px-3 py-2 text-[#101010] font-label-code text-label-code uppercase outline-none focus:border-[#FCBC18]"
            />
          </div>

          {/* Note */}
          <div className="space-y-1">
            <label className="font-label-meta text-label-meta uppercase text-[#504533] block">
              PURPOSE / TECHNICAL REMARKS (OPTIONAL)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Foundation pile concreting // Grid C-4"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-[#E6E2DD] border border-[#101010] px-3 py-2 text-[#101010] font-label-code text-label-code uppercase outline-none focus:border-[#FCBC18] resize-none"
            />
          </div>

          {/* Live Anomaly Evaluation Strip */}
          {evaluatingPreview && (
            <div className="p-3 bg-[#E6E2DD] border border-[#101010] text-[#5F5E5E] font-label-code text-label-code uppercase animate-pulse flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">sync</span>
              <span>CHECKING CONSUMPTION AGAINST STAGE BOQ ENVELOPE...</span>
            </div>
          )}

          {previewResult && !evaluatingPreview && (
            <div className="space-y-2">
              <AnomalyBanner anomalyResult={previewResult} />
              {!previewResult.is_anomalous && (
                <div className="p-3 bg-[#93d5ad]/30 border border-[#296a49] text-[#296a49] font-label-code text-label-code uppercase font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  <span>WITHIN NOMINAL BOQ PROGRESS TOLERANCE ENVELOPE</span>
                </div>
              )}
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-4 border-t border-[#A39B8F]/30 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => navigate("/store")}
              className="px-4 py-2 bg-[#E6E2DD] hover:bg-[#101010] text-[#101010] hover:text-[#F2ECE6] font-label-code text-label-code uppercase font-bold border border-[#101010] transition-colors cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 bg-[#FCBC18] hover:bg-[#101010] text-[#101010] hover:text-[#FCBC18] font-label-code text-label-code uppercase font-bold border border-[#101010] shadow-[2px_2px_0px_#101010] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">check</span>
              <span>{submitting ? "RECORDING..." : "DISPATCH & LOG DRAWDOWN"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IssueMaterial;
