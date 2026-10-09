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
      setUploadError("Please select a project first.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const result = await uploadChallan(selectedProjectId, file);
      // Challan is accepted and processing in background.
      // Redirect to review page which polls or displays the drafted fields
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Upload Delivery Challan</h2>
        <p className="text-xs text-slate-400 mt-1">
          Upload a paper slip photo or scanned delivery document for project{" "}
          <strong className="text-slate-200">{selectedProject?.name}</strong>.
          Our OCR engine will extract line items, vendor details, and dates for your review.
        </p>
      </div>

      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
        <FileUploader
          onFileSelected={handleUpload}
          isUploading={isUploading}
          error={uploadError}
        />

        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-800 w-full" />
          <span className="bg-slate-900 px-3 text-[11px] font-mono text-slate-500 uppercase tracking-wider absolute">
            Or
          </span>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={handleManualEntry}
            disabled={manualLoading || isUploading}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50 cursor-pointer"
          >
            {manualLoading ? "Creating Draft..." : "✍️ Create Manual Challan (No Image Upload)"}
          </button>
          <p className="text-[11px] text-slate-500 mt-1">
            Use when physical paper is unreadable or handwritten beyond OCR capability.
          </p>
        </div>
      </div>

      {/* Guidelines Box */}
      <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 space-y-2">
        <h4 className="font-semibold text-slate-300">Tips for Best OCR Accuracy:</h4>
        <ul className="list-disc list-inside space-y-1 text-[11px]">
          <li>Ensure document is well-lit and oriented right-side up.</li>
          <li>Avoid severe folds obscuring line item quantities and units.</li>
          <li>You will have an opportunity to review and edit every field before confirming.</li>
        </ul>
      </div>
    </div>
  );
};
