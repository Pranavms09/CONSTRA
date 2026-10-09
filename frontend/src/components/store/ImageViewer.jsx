import React, { useState, useEffect } from "react";

export const ImageViewer = ({ fileUrl, fileName, isPdf = false }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!fileUrl) {
      setBlobUrl(null);
      return;
    }

    let active = true;
    let createdUrl = null;

    async function loadSecureFile() {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem("siteverify_token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await fetch(fileUrl, { headers });
        if (!res.ok) {
          throw new Error(`Failed to load file preview (${res.status})`);
        }

        const blob = await res.blob();
        if (active) {
          createdUrl = URL.createObjectURL(blob);
          setBlobUrl(createdUrl);
        }
      } catch (err) {
        if (active) {
          console.warn("Could not load preview via blob, falling back to direct URL:", err);
          // Fallback to direct fileUrl
          setBlobUrl(fileUrl);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadSecureFile();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [fileUrl]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const displayUrl = blobUrl || fileUrl;

  if (isPdf) {
    return (
      <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-slate-950/80 border-b border-slate-800 text-xs text-slate-400">
          <span className="font-mono truncate">{fileName || "Challan PDF Document"}</span>
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:text-amber-300 font-medium"
          >
            Open in new tab ↗
          </a>
        </div>
        <div className="flex-1 w-full min-h-[400px]">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              Loading PDF preview...
            </div>
          ) : (
            <iframe
              src={displayUrl}
              title="Challan PDF"
              className="w-full h-full border-0"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400 truncate max-w-[180px]">
            {fileName || "Challan Image"}
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            {Math.round(zoom * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
            title="Zoom Out"
          >
            -
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleRotate}
            className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
            title="Rotate 90°"
          >
            ↻
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
            title="Reset View"
          >
            Reset
          </button>
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 px-2 py-1 text-xs text-amber-400 hover:text-amber-300"
            title="Open Full Image"
          >
            ↗
          </a>
        </div>
      </div>

      {/* Image Pan & Zoom Canvas */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/40 min-h-[350px]">
        {loading ? (
          <div className="text-center text-slate-400 text-xs py-12 flex flex-col items-center gap-2">
            <span className="text-xl animate-spin">⚙️</span>
            <span>Loading image preview...</span>
          </div>
        ) : displayUrl ? (
          <img
            src={displayUrl}
            alt="Challan Scan"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: "center center",
              transition: "transform 0.15s ease-out",
            }}
            className="max-w-full max-h-[600px] object-contain rounded shadow-lg border border-slate-800"
          />
        ) : (
          <div className="text-center text-slate-500 text-xs py-12">
            No image preview available
          </div>
        )}
      </div>
    </div>
  );
};
