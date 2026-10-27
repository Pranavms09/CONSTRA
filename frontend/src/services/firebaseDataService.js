// Data persistence: the Cloudflare Worker API (backed by D1) is the source of truth.
// localStorage is only an offline cache. Firestore is no longer used; the exported names are kept for existing callers.
import {
  fetchClaims as apiFetchClaims,
  fetchClaim as apiFetchClaim,
  createClaimApi,
  submitAuditReport as apiSubmitReport,
} from "../api/client";

const LOCAL_STORAGE_CLAIMS_KEY = "constra_firestore_claims";
const LOCAL_STORAGE_DELIVERIES_KEY = "constra_firestore_deliveries";
const LOCAL_STORAGE_ISSUES_KEY = "constra_firestore_issues";
const LOCAL_STORAGE_ALERTS_KEY = "constra_firestore_alerts";

function getLocal(key) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : [];
  } catch {
    return [];
  }
}

function setLocal(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore
  }
}

/* =========================================================================
   1. CLAIMS & SUPERVISOR EVIDENCE PIPELINE
   ========================================================================= */

export async function saveClaimToFirestore(claimData) {
  // The server assigns the claim id; a failed create throws so the caller shows the error instead of a false success.
  const { claim } = await createClaimApi(claimData);
  const record = { ...claim, updatedAt: new Date().toISOString() };

  const current = getLocal(LOCAL_STORAGE_CLAIMS_KEY);
  const filtered = current.filter((c) => c.id !== record.id);
  setLocal(LOCAL_STORAGE_CLAIMS_KEY, [record, ...filtered]);

  return record;
}

export async function fetchAllClaims() {
  let claims = [];

  try {
    const apiClaims = await apiFetchClaims();
    if (Array.isArray(apiClaims) && apiClaims.length > 0) {
      claims = apiClaims;
    }
  } catch {
    // ignore
  }

  if (!claims.length) {
    claims = getLocal(LOCAL_STORAGE_CLAIMS_KEY);
  }

  if (claims.length > 0) {
    setLocal(LOCAL_STORAGE_CLAIMS_KEY, claims);
  }

  return claims;
}

export async function fetchClaimById(claimId) {
  try {
    const data = await apiFetchClaim(claimId);
    if (data) return data;
  } catch {
    // fallback
  }

  const localList = getLocal(LOCAL_STORAGE_CLAIMS_KEY);
  const found = localList.find((c) => c.id === claimId);
  return found || null;
}

export async function submitClaimVerdict(claimId, verdict, verdictNote, decisions) {
  // Backend enforces verification and blocker checks.
  const apiRes = await apiSubmitReport(claimId, verdict, verdictNote, decisions);

  const finalStatus =
    verdict === "agree" || verdict === "amend" || verdict === "approve"
      ? "CLEARED"
      : "FLAGGED";

  const updatePayload = {
    status: finalStatus,
    decisions: decisions || {},
    report: apiRes?.report || {
      claim_id: claimId,
      verdict,
      verdict_note: verdictNote,
      submitted_at: new Date().toISOString(),
      certificate: apiRes?.certificate,
    },
    updatedAt: new Date().toISOString(),
  };

  const localList = getLocal(LOCAL_STORAGE_CLAIMS_KEY);
  const updated = localList.map((c) => (c.id === claimId ? { ...c, ...updatePayload } : c));
  setLocal(LOCAL_STORAGE_CLAIMS_KEY, updated);

  return apiRes;
}

/* =========================================================================
   2-5. LOCAL CACHES (records are already persisted by the backend API)
   ========================================================================= */

export async function saveChallanToFirestore(challanData) {
  const challanId = String(challanData.id || `CH-${Date.now()}`);
  const record = { ...challanData, id: challanId, updatedAt: new Date().toISOString() };
  const current = getLocal(LOCAL_STORAGE_DELIVERIES_KEY);
  setLocal(LOCAL_STORAGE_DELIVERIES_KEY, [record, ...current.filter((c) => String(c.id) !== challanId)]);
  return record;
}

export async function saveIssueToFirestore(issueData) {
  const record = {
    ...issueData,
    id: String(issueData.id || `ISS-${Date.now()}`),
    issued_at: issueData.issued_at || new Date().toISOString(),
  };
  setLocal(LOCAL_STORAGE_ISSUES_KEY, [record, ...getLocal(LOCAL_STORAGE_ISSUES_KEY)]);
  return record;
}

export async function saveAlertToFirestore(alertData) {
  const record = {
    ...alertData,
    id: String(alertData.id || `ALT-${Date.now()}`),
    status: alertData.status || "open",
    created_at: alertData.created_at || new Date().toISOString(),
  };
  setLocal(LOCAL_STORAGE_ALERTS_KEY, [record, ...getLocal(LOCAL_STORAGE_ALERTS_KEY)]);
  return record;
}

export async function saveUserToFirestore(userData) {
  return { ...userData, id: String(userData.id || `USR-${Date.now()}`), created_at: new Date().toISOString() };
}
