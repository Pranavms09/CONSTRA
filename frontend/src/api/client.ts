import { auth } from "../auth/firebase";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export interface UserProfile {
  id: number;
  full_name: string;
  email: string;
  role: "supervisor" | "store_incharge" | "auditor";
}

export interface ApiError {
  status: number;
  message: string;
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

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
    const err = new Error(errorDetail) as Error & { status: number };
    err.status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}

export async function loginWithBackend(claimedRole: string, idToken: string): Promise<UserProfile> {
  const url = `${API_BASE_URL}/auth/login`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify({ claimed_role: claimedRole }),
  });

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
    const err = new Error(detail) as Error & { status: number };
    err.status = res.status;
    throw err;
  }

  return res.json() as Promise<UserProfile>;
}

export async function fetchMe(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/auth/me");
}

export async function pingSupervisor(): Promise<{ status: string; message: string; role: string; user: string }> {
  return apiFetch("/supervisor/ping");
}

export async function pingStore(): Promise<{ status: string; message: string; role: string; user: string }> {
  return apiFetch("/store/ping");
}

export async function pingAuditor(): Promise<{ status: string; message: string; role: string; user: string }> {
  return apiFetch("/auditor/ping");
}

export async function fetchUsers(): Promise<UserProfile[]> {
  return apiFetch<UserProfile[]>("/users");
}

export async function createUser(data: { full_name: string; email: string; role: string }): Promise<UserProfile> {
  return apiFetch<UserProfile>("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
