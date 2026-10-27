import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStoreProject } from "./StoreLayout";
import { uploadChallan, createManualChallan } from "../../api/store";
import { FileUploader } from "../../components/store/FileUploader";

export const NewDelivery = () => {
  const { selectedProjectId, selectedProject } = useStoreProject();
  const navigate = useNavigate();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [manualLoading, setManualLoading] = useState(false);

  const handleUpload = async (file) => {
    if (!selectedProjectId) {
      setUploadError("SELECT PROJECT IDENTIFIER BEFORE INITIATING INGESTION.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const result = await uploadChallan(selectedProjectId, file);
      navigate(`/store/deliveries/${result.id}`);
    } catch (err) {
      setUploadError(err.message || "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleManualEntry = async () => {
    if (!selectedProjectId) return;
    setManualLoading(true);
    try {
      const draft = await createManualChallan(selectedProjectId);
      navigate(`/store/deliveries/${draft.id}`);
    } catch (err) {
      setUploadError(err.message || "Failed to initialize manual draft.");
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="border-b-2 border-[#101010] pb-4">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[#6E675F]">
          <span>INGESTION PROTOCOL</span>
          <span>//</span>
          <span className="text-[#101010] font-bold">SPEC-CHALLAN-IN</span>
        </div>
        <h2 className="font-['Space_Grotesk'] text-2xl font-bold uppercase tracking-wider text-[#101010] mt-1">
          Upload Delivery Challan
        </h2>
        <p className="font-['Archivo_Narrow'] text-xs text-[#6E675F] mt-1">
          Upload a physical vendor receipt or scanned dispatch invoice for project{" "}
          <strong className="text-[#101010] font-mono font-bold">
            [{selectedProject?.code || "PRJ"} // {selectedProject?.name}]
          </strong>
          . The OCR neural parser extracts line items, quantities, and vendor signatures for audit reconciliation.
        </p>
      </div>

      {/* Main Drafting Box */}
      <div className="border-2 border-[#101010] bg-[#F2ECE6] shadow-[4px_4px_0px_#101010] p-6 space-y-6 relative rounded-none">
        {/* Top telemetry bar */}
        <div className="flex items-center justify-between border-b border-[#A39B8F] pb-3 text-[11px] font-mono text-[#6E675F]">
          <span>STAGE: 01 // RAW DOCUMENT INTAKE</span>
          <span className="text-[#2F6F4E] font-bold">SYS ACTIVE: READY</span>
        </div>

        <FileUploader
          onFileSelected={handleUpload}
          isUploading={isUploading}
          error={uploadError}
        />

        <div className="relative flex items-center justify-center">
          <div className="border-t border-[#A39B8F] w-full" />
          <span className="bg-[#F2ECE6] px-3 font-mono text-[10px] text-[#6E675F] uppercase tracking-widest absolute">
            OR // DIRECT OVERRIDE
          </span>
        </div>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={handleManualEntry}
            disabled={manualLoading || isUploading}
            className="px-5 py-2.5 bg-[#E6E2DD] hover:bg-[#d8d4cf] text-[#101010] border-2 border-[#101010] font-mono uppercase tracking-wider text-xs font-bold shadow-[2px_2px_0px_#101010] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">edit_note</span>
            <span>{manualLoading ? "INITIALIZING DRAFT..." : "CREATE MANUAL ENTRY DRAFT (NO SCAN)"}</span>
          </button>
          <p className="font-['Archivo_Narrow'] text-[11px] text-[#6E675F] mt-2 font-mono">
            AUTHORIZATION: Use only when physical paper slip is severely degraded or unreadable by OCR engine.
          </p>
        </div>
      </div>

      {/* Guidelines Box */}
      <div className="border-l-4 border-[#FCBC18] border-2 border-[#101010] bg-[#E6E2DD] p-4 text-xs shadow-[2px_2px_0px_#101010]">
        <div className="flex items-center gap-2 font-['Space_Grotesk'] font-bold uppercase tracking-wider text-[#101010] mb-2 text-xs">
          <span className="material-symbols-outlined text-sm text-[#FCBC18]">info</span>
          <span>OCR ACCURACY SPECIFICATION GUIDELINES</span>
        </div>
        <ul className="list-disc list-inside space-y-1 font-['Archivo_Narrow'] text-xs text-[#101010]">
          <li>Ensure document is well-lit, orthogonal, and captured at minimum 300 DPI resolution.</li>
          <li>Avoid physical folds or creases obscuring line item quantities, vendor stamps, and units.</li>
          <li>Every extracted line item must be validated in the subsequent Review stage before stock commit.</li>
        </ul>
      </div>
    </div>
  );
};

