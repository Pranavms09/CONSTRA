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
      setToastMsg("Draft changes saved successfully.");
    } catch (err) {
      if (err.status === 409) {
        setErrorMessage("Conflict: This challan was updated by another request. Please reload to sync.");
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
      // First save draft changes
      await handleSaveDraft();

      // Trigger confirm
      const confirmData = await confirmChallan(challan.id, {
        version: challan.version + 1,
      });

      setChallan(confirmData.challan);
      setReconcileResult(confirmData);
      setConfirmModalOpen(true);
      setToastType("success");
      setToastMsg("Challan confirmed & reconciled against BOQ.");
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
      <div className="p-8 text-center text-slate-400">
        Challan not found.
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

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/store/deliveries")}
              className="text-xs text-slate-400 hover:text-white"
            >
              ← Back to Deliveries
            </button>
            <StatusBadge status={challan.status} />
            {challan.version && (
              <span className="text-[11px] font-mono text-slate-500">
                v{challan.version}
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-white">
            {challan.challan_no ? `Challan #${challan.challan_no}` : "Draft Challan Review"}
          </h2>
          <p className="text-xs text-slate-400">
            Uploaded by {challan.uploader_name || "Storekeeper"} on{" "}
            {new Date(challan.uploaded_at).toLocaleString()}
          </p>
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || confirming}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={handleConfirmDelivery}
              disabled={saving || confirming}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition disabled:opacity-50 shadow-sm"
            >
              {confirming ? "Confirming..." : "✓ Confirm & Reconcile"}
            </button>
          </div>
        )}
      </div>

      {isProcessing && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs flex items-center gap-3 animate-pulse">
          <span className="text-lg">⏳</span>
          <div>
            <strong>OCR Processing in Background:</strong> Our system is currently extracting challan fields from the uploaded slip. This page will update automatically.
          </div>
        </div>
      )}

      {isFailed && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
          <span className="text-lg">✗</span>
          <div>
            <strong>OCR Parsing Failed:</strong> {challan.failure_reason || "Unable to parse text from scan."}. You can manually fill in fields below.
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <span>⚠️</span>
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
            <div className="h-full rounded-xl border border-slate-800 bg-slate-900/40 p-8 flex flex-col items-center justify-center text-center text-slate-500 text-xs">
              <span className="text-3xl mb-2">✍️</span>
              <p>Manual Entry Challan</p>
              <p className="text-[11px] text-slate-600 mt-1">No scanned document attached.</p>
            </div>
          )}
        </div>

        {/* Right Pane: Extracted Fields Review Form (7 cols) */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6 overflow-y-auto">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-sm font-bold text-white">Challan Metadata</h3>
            <p className="text-xs text-slate-400">Review OCR confidence ratings before confirmation</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Challan Number */}
            <ConfidenceField
              confidence={challan.ocr_confidence}
              label="Challan Number *"
            >
              <input
                type="text"
                disabled={isReadOnly}
                value={challanNo}
                onChange={(e) => setChallanNo(e.target.value)}
                placeholder="e.g. CH-2024-001"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-hidden focus:border-amber-500 disabled:opacity-60"
              />
            </ConfidenceField>

            {/* Challan Date */}
            <ConfidenceField
              confidence={challan.ocr_confidence}
              label="Delivery Date"
            >
              <input
                type="date"
                disabled={isReadOnly}
                value={challanDate}
                onChange={(e) => setChallanDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-hidden focus:border-amber-500 disabled:opacity-60"
              />
            </ConfidenceField>
          </div>

          {/* Vendor Selection */}
          <div className="space-y-2">
            <ConfidenceField
              confidence={challan.ocr_confidence}
              label="Supplier / Vendor *"
            >
              <select
                disabled={isReadOnly}
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-amber-500 disabled:opacity-60 cursor-pointer"
              >
                <option value="">-- Select Registered Vendor --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {!v.is_approved ? "⚠️ (Unapproved)" : "✓ (Approved)"}
                  </option>
                ))}
              </select>
            </ConfidenceField>

            {/* Raw extracted vendor string */}
            {vendorNameRaw && (
              <p className="text-[11px] text-slate-400 font-mono">
                OCR Extracted Text: <span className="text-slate-300">"{vendorNameRaw}"</span>
              </p>
            )}

            {selectedVendorObj && !selectedVendorObj.is_approved && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>
                  <strong>Vendor Notice:</strong> This vendor is unapproved. An audit alert will be raised upon confirmation.
                </span>
              </div>
            )}
          </div>

          {/* Line Items Section */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Delivered Materials ({items.length})
                </h4>
                <p className="text-[11px] text-slate-400">Match lines against project materials catalog</p>
              </div>

              {!isReadOnly && (
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg border border-slate-700 transition"
                >
                  + Add Line Item
                </button>
              )}
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-400">
                      Line #{idx + 1}
                    </span>
                    {it.field_confidence && (
                      <span className="text-[10px] font-mono text-slate-500">
                        Conf: {Math.round(it.field_confidence)}%
                      </span>
                    )}
                    {!isReadOnly && items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-xs text-rose-400 hover:text-rose-300 font-bold"
                      >
                        Remove ×
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Material Select */}
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">
                        Material Catalog
                      </label>
                      <select
                        disabled={isReadOnly}
                        value={it.material_id}
                        onChange={(e) => handleItemChange(idx, "material_id", e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-white focus:outline-hidden"
                      >
                        <option value="">-- Match Material --</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      {it.material_name_raw && (
                        <p className="text-[10px] text-slate-400 font-mono mt-1 truncate" title={it.material_name_raw}>
                          OCR: <span className="text-slate-300">"{it.material_name_raw}"</span>
                        </p>
                      )}
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        step="any"
                        disabled={isReadOnly}
                        value={it.qty}
                        onChange={(e) => handleItemChange(idx, "qty", e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs font-mono text-white focus:outline-hidden"
                      />
                    </div>

                    {/* Unit */}
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">
                        Unit
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
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs font-mono text-white focus:outline-hidden cursor-pointer"
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
        title="Delivery Reconciled Against BOQ"
        confirmText="Done"
        cancelText="Close"
        onConfirm={() => setConfirmModalOpen(false)}
        onCancel={() => setConfirmModalOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-300">
            Delivery Challan #{challan.challan_no} has been confirmed. Stock balances have been updated.
          </p>

          {reconcileResult?.reconcile_summary && (
            <ReconcileTable items={reconcileResult.reconcile_summary} />
          )}

          {reconcileResult?.alerts_created && reconcileResult.alerts_created.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
              <strong>⚠️ Alerts Raised:</strong>
              <ul className="list-disc list-inside space-y-0.5">
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
