import React, { useState, useRef } from "react";

export const FileUploader = ({ onFileSelected, isUploading, error }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [localError, setLocalError] = useState(null);
  const fileInputRef = useRef(null);

  const validateAndSetFile = (file) => {
    setLocalError(null);
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      setLocalError("Only genuine JPEG, PNG, or PDF challan files are accepted.");
      return;
    }

    const maxSize = 15 * 1024 * 1024; // 15 MB
    if (file.size > maxSize) {
      setLocalError("File exceeds the 15 MB maximum size limit.");
      return;
    }

    setSelectedFile(file);
    if (onFileSelected) {
      onFileSelected(file);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const displayedError = error || localError;

  return (
    <div className="w-full">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          dragActive
            ? "border-amber-400 bg-amber-500/10 scale-[1.01]"
            : "border-slate-700 hover:border-slate-600 bg-slate-900/40 hover:bg-slate-900/60"
        } ${isUploading ? "opacity-60 cursor-not-allowed pointer-events-none" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          onChange={handleChange}
          disabled={isUploading}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-2xl text-amber-400">
            {isUploading ? (
              <span className="animate-spin text-xl">⏳</span>
            ) : (
              "📄"
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-white">
              {isUploading
                ? "Uploading & processing challan with OCR..."
                : selectedFile
                ? selectedFile.name
                : "Drop your vendor challan here, or click to browse"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports Scanned PDF, JPEG, PNG slips (up to 15 MB)
            </p>
          </div>

          {selectedFile && !isUploading && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-mono text-emerald-400">
              <span>✓ Ready to upload:</span>
              <span className="text-slate-300">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>
          )}
        </div>
      </div>

      {displayedError && (
        <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <span>⚠️</span>
          <span>{displayedError}</span>
        </div>
      )}
    </div>
  );
};
