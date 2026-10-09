import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchChallanDetail,
  updateChallanDraft,
  confirmChallan,
  fetchMaterials,
  fetchVendors,
  getChallanFileUrl,
} from "../../api/store";
import { useStoreProject } from "./StoreLayout";
import { ImageViewer } from "../../components/store/ImageViewer";
import { StatusBadge } from "../../components/store/StatusBadge";
import { ConfidenceField } from "../../components/store/ConfidenceField";
import { ReconcileTable } from "../../components/store/ReconcileTable";
import { ConfirmDialog } from "../../components/store/ConfirmDialog";
import { Toast } from "../../components/store/Toast";
import { SkeletonLoader } from "../../components/store/SkeletonLoader";

export const ChallanReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedProjectId } = useStoreProject();

  const [challan, setChallan] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [toastType, setToastType] = useState("success");
  const [errorMessage, setErrorMessage] = useState(null);

  // Form State
  const [challanNo, setChallanNo] = useState("");
  const [challanDate, setChallanDate] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [vendorNameRaw, setVendorNameRaw] = useState("");
  const [items, setItems] = useState([]);

  // Confirm Modal / Reconcile Results
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await fetchChallanDetail(id);
      setChallan(data);
      setChallanNo(data.challan_no || "");
      setChallanDate(data.challan_date || "");
      setVendorId(data.vendor_id ? String(data.vendor_id) : "");
      setVendorNameRaw(data.vendor_name_raw || "");
      setItems(
        (data.items || []).map((it) => ({
          id: it.id,
          material_id: it.material_id ? String(it.material_id) : "",
          material_name_raw: it.material_name_raw || "",
          qty: it.qty || 0,
          unit: it.unit || "kg",
          field_confidence: it.field_confidence,
        }))
      );

      const targetProjectId = data.project_id || selectedProjectId;
      try {
        const [mats, vends] = await Promise.all([
          fetchMaterials(targetProjectId),
          fetchVendors(targetProjectId),
        ]);
        setMaterials(mats || []);
        setVendors(vends || []);
      } catch (metaErr) {
        console.warn("Could not load materials or vendors catalog:", metaErr);
      }
    } catch (err) {
      setErrorMessage(err.message || "Failed to load challan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, selectedProjectId]);

  // Polling if still processing OCR
  useEffect(() => {
    if (!challan || challan.status !== "processing") return;

    const interval = setInterval(async () => {
      try {
        const fresh = await fetchChallanDetail(id);
        if (fresh.status !== "processing") {
          setChallan(fresh);
          setChallanNo(fresh.challan_no || "");
          setChallanDate(fresh.challan_date || "");
          setVendorId(fresh.vendor_id ? String(fresh.vendor_id) : "");
          setVendorNameRaw(fresh.vendor_name_raw || "");
          setItems(
            (fresh.items || []).map((it) => ({
              id: it.id,
              material_id: it.material_id ? String(it.material_id) : "",
              material_name_raw: it.material_name_raw || "",
              qty: it.qty || 0,
              unit: it.unit || "kg",
              field_confidence: it.field_confidence,
            }))
          );
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [challan?.status, id]);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        material_id: materials.length > 0 ? String(materials[0].id) : "",
        material_name_raw: "",
        qty: 1,
        unit: "kg",
        field_confidence: 100,
      },
    ]);
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    );
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setErrorMessage(null);
    try {
      const payload = {
        version: challan.version,
        challan_no: challanNo,
        challan_date: challanDate || null,
        vendor_id: vendorId ? Number(vendorId) : null,
        vendor_name_raw: vendorNameRaw || null,
        items: items.map((it) => ({
          material_id: it.material_id ? Number(it.material_id) : null,
          material_name_raw: it.material_name_raw || null,
          qty: Number(it.qty),
          unit: it.unit,
          field_confidence: it.field_confidence,
        })),
      };

      const updated = await updateChallanDraft(challan.id, payload);
      setChallan(updated);
      setToastType("success");
      setToastMsg("CHALLAN DRAFT MUTATION COMMITTED.");
    } catch (err) {
      if (err.status === 409) {
        setErrorMessage("CONFLICT: Concurrently updated by another session. Please reload to sync.");
      } else {
        setErrorMessage(err.message || "Failed to save draft.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelivery = async () => {
    setConfirming(true);
    setErrorMessage(null);
    try {
      await handleSaveDraft();

      const confirmData = await confirmChallan(challan.id, {
        version: challan.version + 1,
      });

      setChallan(confirmData.challan);
      setReconcileResult(confirmData);
      setConfirmModalOpen(true);
      setToastType("success");
      setToastMsg("CHALLAN RECONCILED AGAINST BOQ BASELINE.");
    } catch (err) {
      setErrorMessage(err.message || "Confirmation failed.");
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return <SkeletonLoader rows={6} type="table" />;
  }

  if (!challan) {
    return (
      <div className="p-8 text-center font-mono text-xs text-[#6E675F] border-2 border-[#101010] bg-[#E6E2DD]">
        CHALLAN RECORD NOT LOCATED
      </div>
    );
  }

  const isConfirmed = challan.status === "confirmed";
  const isProcessing = challan.status === "processing";
  const isFailed = challan.status === "failed";
  const isReadOnly = isConfirmed || isProcessing;

  const isPdf = challan.file_path && challan.file_path.toLowerCase().endsWith(".pdf");
  const fileUrl = challan.file_path ? getChallanFileUrl(challan.id) : null;

  const selectedVendorObj = vendors.find((v) => v.id === Number(vendorId));

  return (
    <div className="space-y-6">
      <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg(null)} />

      {/* Top Brutalist Command Bar */}
      <div className="border-2 border-[#101010] bg-[#F2ECE6] shadow-[3px_3px_0px_#101010] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/store/deliveries")}
              className="text-xs font-mono uppercase tracking-wider font-bold text-[#101010] hover:text-[#FCBC18] bg-[#E6E2DD] border border-[#101010] px-2 py-0.5"
            >
              ← DELIVERIES
            </button>
            <StatusBadge status={challan.status} />
            {challan.version && (
              <span className="text-[11px] font-mono text-[#6E675F] bg-white border border-[#A39B8F] px-1.5 py-0.5">
                REV. {challan.version}
              </span>
            )}
          </div>
          <h2 className="font-['Space_Grotesk'] text-xl font-bold uppercase tracking-wider text-[#101010] mt-1">
            {challan.challan_no ? `CHALLAN // #${challan.challan_no}` : "DRAFT CHALLAN REVIEW"}
          </h2>
          <p className="font-['Archivo_Narrow'] text-xs text-[#6E675F] font-mono">
            INTAKE BY: {challan.uploader_name || "STORE_IN_CHARGE"} // TIMESTAMP:{" "}
            {new Date(challan.uploaded_at).toLocaleString()}
          </p>
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-2 self-start sm:self-auto font-mono">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || confirming}
              className="px-4 py-2 bg-[#E6E2DD] hover:bg-[#d8d4cf] text-[#101010] border-2 border-[#101010] text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_#101010] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer disabled:opacity-50"
            >
              {saving ? "SAVING..." : "SAVE DRAFT"}
            </button>
            <button
              type="button"
              onClick={handleConfirmDelivery}
              disabled={saving || confirming}
              className="px-4 py-2 bg-[#FCBC18] hover:bg-[#e5aa16] text-[#101010] border-2 border-[#101010] font-bold text-xs uppercase tracking-wider shadow-[2px_2px_0px_#101010] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer disabled:opacity-50"
            >
              {confirming ? "CONFIRMING..." : "✓ CONFIRM & RECONCILE"}
            </button>
          </div>
        )}
      </div>

      {isProcessing && (
        <div className="p-4 bg-[#FCBC18]/20 border-2 border-[#101010] shadow-[2px_2px_0px_#101010] text-[#101010] text-xs font-mono flex items-center gap-3">
          <span className="material-symbols-outlined text-xl animate-spin text-[#101010]">refresh</span>
          <div>
            <strong>OCR NEURAL PARSER EXECUTING:</strong> Extracting line item matrices and vendor identification from uploaded slip. Live polling active.
          </div>
        </div>
      )}

      {isFailed && (
        <div className="p-4 bg-[#B3261E]/15 border-2 border-[#B3261E] text-[#B3261E] text-xs font-mono flex items-center gap-3">
          <span className="font-bold text-base">⚠</span>
          <div>
            <strong>OCR PARSING FAILED:</strong> {challan.failure_reason || "Document illegible or format unsupported."} Enter field telemetry manually below.
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-[#B3261E]/15 border-2 border-[#B3261E] text-[#B3261E] text-xs font-mono flex items-center gap-2">
          <span className="font-bold">⚠</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Split Pane: Scanned Slip vs Form Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[550px]">
        {/* Left Pane: Image / PDF Preview (5 cols) */}
        <div className="lg:col-span-5 h-[550px] lg:h-auto">
          {fileUrl ? (
            <ImageViewer
              fileUrl={fileUrl}
              fileName={challan.challan_no}
              isPdf={isPdf}
            />
          ) : (
            <div className="h-full border-2 border-dashed border-[#101010] bg-[#E6E2DD]/50 p-8 flex flex-col items-center justify-center text-center text-[#6E675F] text-xs font-mono">
              <span className="material-symbols-outlined text-4xl mb-2 text-[#101010]">edit_document</span>
              <p className="font-['Space_Grotesk'] text-sm font-bold uppercase tracking-wider text-[#101010]">
                MANUAL ENTRY CHALLAN
              </p>
              <p className="text-[11px] mt-1">No scanned raster or vector document attached to this revision.</p>
            </div>
          )}
        </div>

        {/* Right Pane: Extracted Fields Review Form (7 cols) */}
        <div className="lg:col-span-7 p-6 border-2 border-[#101010] bg-[#F2ECE6] shadow-[3px_3px_0px_#101010] space-y-6 overflow-y-auto">
          <div className="border-b-2 border-[#101010] pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-['Space_Grotesk'] text-sm font-bold uppercase tracking-wider text-[#101010]">
                Challan Telemetry & Spec
              </h3>
              <p className="font-['Archivo_Narrow'] text-xs text-[#6E675F]">
                Verify neural confidence ratings and adjust values prior to stock ledger commit
              </p>
            </div>
            <span className="font-mono text-[10px] text-[#101010] bg-[#FCBC18] border border-[#101010] px-2 py-0.5 font-bold uppercase">
              SPEC-VALIDATION
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Challan Number */}
            <ConfidenceField
              confidence={challan.ocr_confidence}
              label="CHALLAN NUMBER *"
            >
              <input
                type="text"
                disabled={isReadOnly}
                value={challanNo}
                onChange={(e) => setChallanNo(e.target.value)}
                placeholder="e.g. CH-2024-001"
                className="w-full bg-white border border-[#101010] px-3 py-2 text-xs font-mono text-[#101010] rounded-none focus:outline-hidden focus:ring-1 focus:ring-[#101010] disabled:bg-[#E6E2DD] disabled:text-[#6E675F]"
              />
            </ConfidenceField>

            {/* Challan Date */}
            <ConfidenceField
              confidence={challan.ocr_confidence}
              label="DELIVERY DATE"
            >
              <input
                type="date"
                disabled={isReadOnly}
                value={challanDate}
                onChange={(e) => setChallanDate(e.target.value)}
                className="w-full bg-white border border-[#101010] px-3 py-2 text-xs font-mono text-[#101010] rounded-none focus:outline-hidden focus:ring-1 focus:ring-[#101010] disabled:bg-[#E6E2DD] disabled:text-[#6E675F]"
              />
            </ConfidenceField>
          </div>

          {/* Vendor Selection */}
          <div className="space-y-2">
            <ConfidenceField
              confidence={challan.ocr_confidence}
              label="SUPPLIER / VENDOR ENTITY *"
            >
              <select
                disabled={isReadOnly}
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="w-full bg-white border border-[#101010] px-3 py-2 text-xs font-mono text-[#101010] rounded-none focus:outline-hidden focus:ring-1 focus:ring-[#101010] disabled:bg-[#E6E2DD] disabled:text-[#6E675F] cursor-pointer"
              >
                <option value="">-- SELECT REGISTERED VENDOR ENTITY --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {!v.is_approved ? "[!] (UNAPPROVED)" : "✓ (APPROVED)"}
                  </option>
                ))}
              </select>
            </ConfidenceField>

            {/* Raw extracted vendor string */}
            {vendorNameRaw && (
              <p className="text-[11px] text-[#6E675F] font-mono">
                OCR PARSED STRING: <span className="text-[#101010] font-bold">"{vendorNameRaw}"</span>
              </p>
            )}

            {selectedVendorObj && !selectedVendorObj.is_approved && (
              <div className="p-3 bg-[#FCBC18]/25 border border-[#101010] text-[#101010] text-xs font-mono flex items-center gap-2">
                <span className="font-bold text-sm">⚠</span>
                <span>
                  <strong>UNAPPROVED VENDOR NOTICE:</strong> This vendor entity is not accredited in master registry. Confirmation will trigger an AUD-ALERT-VND.
                </span>
              </div>
            )}
          </div>

          {/* Line Items Section */}
          <div className="space-y-3 pt-4 border-t-2 border-[#101010]">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-['Space_Grotesk'] text-xs font-bold uppercase tracking-wider text-[#101010]">
                  Delivered Materials ({items.length})
                </h4>
                <p className="font-['Archivo_Narrow'] text-[11px] text-[#6E675F]">
                  Match line specifications against approved project material catalog
                </p>
              </div>

              {!isReadOnly && (
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1 text-xs font-mono uppercase tracking-wider font-bold bg-[#101010] text-[#F2ECE6] hover:bg-[#FCBC18] hover:text-[#101010] border border-[#101010] shadow-[1px_1px_0px_#101010] transition-none cursor-pointer"
                >
                  + APPEND LINE
                </button>
              )}
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="p-3.5 border border-[#101010] bg-white shadow-[2px_2px_0px_#101010] space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-[#A39B8F]/30 pb-2">
                    <span className="text-xs font-mono font-bold text-[#101010]">
                      LINE ITEM #{String(idx + 1).padStart(2, "0")}
                    </span>
                    {it.field_confidence && (
                      <span className="text-[10px] font-mono text-[#6E675F] bg-[#E6E2DD] px-1.5 py-0.5 border border-[#A39B8F]">
                        CONF: {Math.round(it.field_confidence)}%
                      </span>
                    )}
                    {!isReadOnly && items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-xs text-[#B3261E] font-mono uppercase font-bold hover:underline cursor-pointer"
                      >
                        [REMOVE ×]
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Material Select */}
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-[#6E675F] font-bold mb-1">
                        CATALOG MAT-ID
                      </label>
                      <select
                        disabled={isReadOnly}
                        value={it.material_id}
                        onChange={(e) => handleItemChange(idx, "material_id", e.target.value)}
                        className="w-full bg-[#F2ECE6] border border-[#101010] px-2 py-1.5 text-xs font-mono text-[#101010] rounded-none focus:outline-hidden cursor-pointer"
                      >
                        <option value="">-- MATCH CATALOG --</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      {it.material_name_raw && (
                        <p className="text-[10px] text-[#6E675F] font-mono mt-1 truncate" title={it.material_name_raw}>
                          OCR: <span className="text-[#101010] font-bold">"{it.material_name_raw}"</span>
                        </p>
                      )}
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-[#6E675F] font-bold mb-1">
                        DISPATCH QTY
                      </label>
                      <input
                        type="number"
                        step="any"
                        disabled={isReadOnly}
                        value={it.qty}
                        onChange={(e) => handleItemChange(idx, "qty", e.target.value)}
                        className="w-full bg-[#F2ECE6] border border-[#101010] px-2 py-1.5 text-xs font-mono text-[#101010] rounded-none focus:outline-hidden tabular-nums font-bold"
                      />
                    </div>

                    {/* Unit */}
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-[#6E675F] font-bold mb-1">
                        UNIT SPEC
                      </label>
                      {(() => {
                        const matObj = materials.find((m) => String(m.id) === String(it.material_id));
                        const allowed = matObj?.allowed_units?.length ? matObj.allowed_units : ["kg", "bag", "tonne", "bundle"];
                        const unitOptions = Array.from(new Set([...allowed, it.unit].filter(Boolean)));
                        return (
                          <select
                            disabled={isReadOnly}
                            value={it.unit}
                            onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                            className="w-full bg-[#F2ECE6] border border-[#101010] px-2 py-1.5 text-xs font-mono text-[#101010] rounded-none focus:outline-hidden cursor-pointer"
                          >
                            {unitOptions.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation & Reconcile Summary Modal */}
      <ConfirmDialog
        isOpen={confirmModalOpen}
        title="DELIVERY RECONCILED AGAINST BOQ SPEC"
        confirmText="FINALIZE"
        cancelText="DISMISS"
        onConfirm={() => setConfirmModalOpen(false)}
        onCancel={() => setConfirmModalOpen(false)}
      >
        <div className="space-y-4 font-mono">
          <p className="text-xs text-[#101010] leading-relaxed">
            Delivery Challan #{challan.challan_no} has been confirmed. Stock balances and ledger ledgers have been updated under ISO-19650 audit protocol.
          </p>

          {reconcileResult?.reconcile_summary && (
            <ReconcileTable items={reconcileResult.reconcile_summary} />
          )}

          {reconcileResult?.alerts_created && reconcileResult.alerts_created.length > 0 && (
            <div className="p-3 bg-[#FCBC18]/25 border-2 border-[#101010] text-[#101010] text-xs space-y-1">
              <strong className="font-bold">⚠️ AUDIT ALERTS TRIGGERED:</strong>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                {reconcileResult.alerts_created.map((a, i) => (
                  <li key={i}>{a.explanation}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
};

