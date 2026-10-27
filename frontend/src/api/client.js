import { auth } from "../auth/firebase";

const defaultBaseUrl =
  typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
    ? "https://constra-api.pranavms09.workers.dev"
    : "http://localhost:8787";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || defaultBaseUrl;

export async function getAuthToken() {
  let token = null;
  // Firebase ID tokens expire after 1 hour; the SDK caches and refreshes them, so ask it first.
  if (auth?.currentUser) {
    try {
      token = await auth.currentUser.getIdToken();
      if (token) {
        localStorage.setItem("siteverify_token", token);
      }
    } catch {
      // ignore if firebase not logged in
    }
  }
  token ||= localStorage.getItem("siteverify_token");

  // Automatic recovery for stored sessions (e.g. demo mode or previously logged in user)
  if (!token) {
    try {
      const savedUserStr = localStorage.getItem("siteverify_user");
      if (savedUserStr) {
        const savedUser = JSON.parse(savedUserStr);
        if (savedUser?.token) {
          token = savedUser.token;
          localStorage.setItem("siteverify_token", token);
        } else if (savedUser?.role) {
          token = `demo-${savedUser.role}`;
          localStorage.setItem("siteverify_token", token);
        }
      }
    } catch {
      // ignore json parse error
    }
  }

  return token;
}

export async function apiFetch(endpoint, options = {}) {
  const token = await getAuthToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  let res;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);
    res = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (networkError) {
    if (networkError.name === "AbortError") {
      throw new Error(
        `Backend server at ${API_BASE_URL} timed out after 30s. Please refresh.`
      );
    }
    throw new Error(
      `Cannot connect to backend server at ${API_BASE_URL}. Please ensure the backend Worker is running.`
    );
  }

  if (!res.ok) {
    let errorDetail = `Request failed with status ${res.status}`;
    let blockers = null;
    try {
      const data = await res.json();
      if (data && data.detail) {
        if (typeof data.detail === "object" && data.detail.blockers) {
          blockers = data.detail.blockers;
          errorDetail = `${data.detail.message || "Approval blocked"}: ${data.detail.blockers.join(" | ")}`;
        } else {
          errorDetail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
        }
      }
    } catch {
      // response was not JSON
    }
    const err = new Error(errorDetail);
    err.status = res.status;
    err.blockers = blockers;
    throw err;
  }

  return res.json();
}

export async function demoLoginApi(role) {
  const url = `${API_BASE_URL}/auth/demo-login`;
  let res;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (networkError) {
    if (networkError.name === "AbortError") {
      throw new Error(
        `Backend server at ${API_BASE_URL} timed out after 30s. Please ensure the backend Worker is running and responsive.`
      );
    }
    throw new Error(
      `Cannot connect to backend server at ${API_BASE_URL}. Please ensure the backend Worker is running.`
    );
  }

  if (!res.ok) {
    let detail = `Demo login failed (${res.status})`;
    try {
      const data = await res.json();
      if (data && data.detail) {
        detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
      }
    } catch {
      // ignore
    }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  if (data.token) {
    localStorage.setItem("siteverify_token", data.token);
  }
  return data;
}

export async function passwordLoginApi(email, password, claimedRole) {
  const data = await apiFetch("/auth/login-password", {
    method: "POST",
    body: JSON.stringify({ email, password, claimed_role: claimedRole }),
  });
  localStorage.setItem("siteverify_token", data.token);
  return data;
}

export async function loginWithBackend(claimedRole, idToken, isSignup = false, fullName = null) {
  const url = `${API_BASE_URL}/auth/login`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        claimed_role: claimedRole,
        is_signup: isSignup,
        full_name: fullName,
      }),
    });
  } catch (networkError) {
    throw new Error(
      `Cannot connect to backend server at ${API_BASE_URL}. Please ensure the backend is running and reachable.`
    );
  }

  if (!res.ok) {
    let detail = `Login failed (${res.status})`;
    try {
      const data = await res.json();
      if (data && data.detail) {
        detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
      }
    } catch {
      // ignore
    }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

export async function fetchMe() {
  return apiFetch("/auth/me");
}

export async function pingSupervisor() {
  return apiFetch("/supervisor/ping");
}

export async function pingStore() {
  return apiFetch("/store/ping");
}

export async function pingAuditor() {
  return apiFetch("/auditor/ping");
}

export async function fetchUsers() {
  return apiFetch("/users");
}

export async function createUser(data) {
  return apiFetch("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateUserRole(userId, data) {
  return apiFetch(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteUser(userId) {
  return apiFetch(`/users/${userId}`, {
    method: "DELETE",
  });
}

export async function analyzeImage(file) {
  const formData = new FormData();
  formData.append("file", file);

  const token = await getAuthToken();
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}/api/analyze-image`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });
  } catch (networkError) {
    throw new Error(
      `Cannot connect to backend server at ${API_BASE_URL}. Please ensure the backend Worker is running.`
    );
  }

  if (!res.ok) {
    let errorDetail = `Image analysis failed (${res.status})`;
    try {
      const data = await res.json();
      if (data && data.detail) {
        errorDetail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
      }
    } catch {
      // response was not JSON
    }
    const err = new Error(errorDetail);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

export async function fetchAnalyses() {
  return apiFetch("/api/analyses");
}

export async function checkBackendHealth() {
  const url = `${API_BASE_URL}/api/health`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Health check returned status ${res.status}`);
    }
    return await res.json();
  } catch (networkError) {
    throw new Error(`Cannot connect to backend server at ${API_BASE_URL}.`);
  }
}

export async function fetchExifGpsReport(projectId = "project-001", fileName = "column_casting.jpg") {
  return apiFetch(`/api/v1/projects/${projectId}/evidence/${fileName}/exif-gps`);
}

export async function fetchClaims() {
  return apiFetch("/api/v1/claims");
}

export async function fetchClaim(claimId) {
  return apiFetch(`/api/v1/claims/${claimId}`);
}

export async function sendAgentCommand(claimId, command, params = null) {
  return apiFetch(`/api/v1/claims/${claimId}/commands`, {
    method: "POST",
    body: JSON.stringify({ command, params }),
  });
}

export async function fetchJobStatus(jobId) {
  return apiFetch(`/api/v1/jobs/${jobId}`);
}

export async function saveAuditorDecisions(claimId, decisions) {
  return apiFetch(`/api/v1/claims/${claimId}/decisions`, {
    method: "POST",
    body: JSON.stringify({ decisions }),
  });
}

export async function submitAuditReport(claimId, verdict, verdictNote, decisions) {
  return apiFetch(`/api/v1/claims/${claimId}/submit`, {
    method: "POST",
    body: JSON.stringify({ verdict, verdictNote, decisions }),
  });
}

export async function createClaimApi(claimPayload) {
  return apiFetch("/api/v1/claims", {
    method: "POST",
    body: JSON.stringify(claimPayload),
  });
}

export async function fetchClaimCertificate(claimId) {
  return apiFetch(`/api/v1/claims/${claimId}/certificate`);
}

export async function fetchStageCertificate(stageId) {
  return apiFetch(`/api/v1/stages/${stageId}/certificate`);
}

