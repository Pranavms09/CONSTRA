import { apiFetch, getAuthToken } from "./client";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function getAuthHeader() {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// 1. Projects and Metadata
export async function fetchProjects() {
  return apiFetch("/store/projects");
}

export async function fetchStages(projectId) {
  return apiFetch(`/store/projects/${projectId}/stages`);
}

export async function fetchMaterials(projectId) {
  return projectId
    ? apiFetch(`/store/projects/${projectId}/materials`)
    : apiFetch("/store/materials");
}

export async function fetchVendors(projectId) {
  return projectId
    ? apiFetch(`/store/projects/${projectId}/vendors`)
    : apiFetch("/store/vendors");
}

// 2. Challans
export async function fetchChallans(projectId, params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.vendor_id) query.set("vendor_id", params.vendor_id);
  if (params.start_date) query.set("start_date", params.start_date);
  if (params.end_date) query.set("end_date", params.end_date);
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", params.page);
  if (params.limit) query.set("limit", params.limit || 20);

  const qs = query.toString();
  return apiFetch(`/store/projects/${projectId}/challans${qs ? `?${qs}` : ""}`);
}

export async function fetchChallanDetail(id) {
  return apiFetch(`/store/challans/${id}`);
}

export async function uploadChallan(projectId, file) {
  const formData = new FormData();
  formData.append("file", file);

  const headers = await getAuthHeader();
  const url = `${API_BASE_URL}/store/projects/${projectId}/challans`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    let detail = `Upload failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.detail) {
        detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
      }
    } catch {}
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

export async function createManualChallan(projectId) {
  return apiFetch(`/store/projects/${projectId}/challans/manual`, {
    method: "POST",
  });
}

export async function updateChallanDraft(id, payload) {
  return apiFetch(`/store/challans/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function confirmChallan(id, payload = {}) {
  return apiFetch(`/store/challans/${id}/confirm`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getChallanFileUrl(id) {
  let token = localStorage.getItem("siteverify_token");
  if (!token) {
    try {
      const u = localStorage.getItem("siteverify_user");
      if (u) {
        const parsed = JSON.parse(u);
        token = parsed.token || (parsed.role ? `demo-${parsed.role}` : null);
      }
    } catch {
      // ignore
    }
  }
  const base = `${API_BASE_URL}/store/files/${id}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

// 3. Material Issues
export async function previewIssue(payload) {
  return apiFetch("/store/issue-preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logMaterialIssue(stageId, payload) {
  return apiFetch(`/store/stages/${stageId}/material-issues`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchMaterialIssues(projectId, params = {}) {
  const query = new URLSearchParams();
  if (params.stage_id) query.set("stage_id", params.stage_id);
  if (params.material_id) query.set("material_id", params.material_id);
  if (params.page) query.set("page", params.page);
  if (params.limit) query.set("limit", params.limit || 50);

  const qs = query.toString();
  return apiFetch(`/store/projects/${projectId}/material-issues${qs ? `?${qs}` : ""}`);
}

// 4. Inventory & Alerts
export async function fetchStockSummary(projectId) {
  return apiFetch(`/store/projects/${projectId}/stock-summary`);
}

export async function fetchStoreAlerts(projectId, params = {}) {
  const query = new URLSearchParams();
  if (params.severity) query.set("severity", params.severity);
  if (params.type) query.set("type", params.type);
  if (params.status) query.set("status", params.status);

  const qs = query.toString();
  return apiFetch(`/store/projects/${projectId}/alerts${qs ? `?${qs}` : ""}`);
}

export async function updateAlertAction(alertId, status, justification) {
  return apiFetch(`/store/alerts/${alertId}/action`, {
    method: "POST",
    body: JSON.stringify({ status, justification }),
  });
}

