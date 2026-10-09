import { auth } from "../auth/firebase";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function apiFetch(endpoint, options = {}) {
  const token = await auth.currentUser?.getIdToken();

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
