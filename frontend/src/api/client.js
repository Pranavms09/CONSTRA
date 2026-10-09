import { auth } from "../auth/firebase";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function apiFetch(endpoint, options = {}) {
  const demoToken = localStorage.getItem("siteverify_token");
  let token = demoToken;

  if (!token && auth?.currentUser) {
    try {
      token = await auth.currentUser.getIdToken();
    } catch {
      // ignore if firebase not logged in
    }
  }

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
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (networkError) {
    throw new Error(
      `Cannot connect to backend server at ${API_BASE_URL}. Please ensure the FastAPI backend is running.`
    );
  }

  if (!res.ok) {
    let errorDetail = `Request failed with status ${res.status}`;
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

export async function demoLoginApi(role) {
  const url = `${API_BASE_URL}/auth/demo-login`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role }),
    });
  } catch (networkError) {
    throw new Error(
      `Cannot connect to backend server at ${API_BASE_URL}. Please ensure the FastAPI backend is running.`
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

export async function loginWithBackend(claimedRole, idToken) {
  const url = `${API_BASE_URL}/auth/login`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({ claimed_role: claimedRole }),
    });
  } catch (networkError) {
    throw new Error(
      `Cannot connect to backend server at ${API_BASE_URL}. Please ensure the FastAPI backend is running on port 8000.`
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

export async function analyzeImage(file) {
  const formData = new FormData();
  formData.append("file", file);

  const demoToken = localStorage.getItem("siteverify_token");
  let token = demoToken;
  if (!token && auth?.currentUser) {
    try {
      token = await auth.currentUser.getIdToken();
    } catch {
      // ignore
    }
  }

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
      `Cannot connect to backend server at ${API_BASE_URL}. Please ensure the FastAPI backend is running.`
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
