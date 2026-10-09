import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../auth/firebase";
import {
  fetchClaims as apiFetchClaims,
  fetchClaim as apiFetchClaim,
  createClaimApi,
  submitAuditReport as apiSubmitReport,
  fetchUsers as apiFetchUsers,
  createUser as apiCreateUser,
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
  const claimId = claimData.id || `CLM-2026-${Date.now().toString().slice(-4)}`;
  const record = {
    ...claimData,
    id: claimId,
    updatedAt: new Date().toISOString(),
  };

  // 1. Write to Firestore if connected
  if (db) {
    try {
      const claimRef = doc(db, "claims", claimId);
      await setDoc(claimRef, {
        ...record,
        firestoreTimestamp: serverTimestamp(),
      }, { merge: true });
      console.info(`[Firebase] Claim ${claimId} successfully synced to Firestore.`);
    } catch (err) {
      console.warn("[Firebase] Firestore write failed, using local/backend fallback:", err.message);
    }
  }

  // 2. Sync to Backend Claims API
  try {
    await createClaimApi(record);
  } catch (err) {
    console.warn("[API] Backend claims API sync note:", err.message);
  }

  // 3. Update Local Persistence
  const current = getLocal(LOCAL_STORAGE_CLAIMS_KEY);
  const filtered = current.filter((c) => c.id !== claimId);
  setLocal(LOCAL_STORAGE_CLAIMS_KEY, [record, ...filtered]);

  return record;
}

export async function fetchAllClaims() {
  let claims = [];

  // 1. Try Firestore
  if (db) {
    try {
      const q = query(collection(db, "claims"), orderBy("updatedAt", "desc"));
      const snap = await getDocs(q);
      if (!snap.empty) {
        claims = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
    } catch (err) {
      // Fallback
    }
  }

  // 2. Try Backend API if empty
  if (!claims.length) {
    try {
      const apiClaims = await apiFetchClaims();
      if (Array.isArray(apiClaims) && apiClaims.length > 0) {
        claims = apiClaims;
      }
    } catch {
      // ignore
    }
  }

  // 3. Fallback to Local Storage
  if (!claims.length) {
    claims = getLocal(LOCAL_STORAGE_CLAIMS_KEY);
  }

  // Update local cache
  if (claims.length > 0) {
    setLocal(LOCAL_STORAGE_CLAIMS_KEY, claims);
  }

  return claims;
}

export async function fetchClaimById(claimId) {
  if (db) {
    try {
      const docRef = doc(db, "claims", claimId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() };
      }
    } catch {
      // fallback
    }
  }

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
  const updatePayload = {
    status: verdict === "agree" || verdict === "amend" ? "APPROVED" : "FLAGGED",
    decisions: decisions || {},
    report: {
      claim_id: claimId,
      verdict,
      verdict_note: verdictNote,
      submitted_at: new Date().toISOString(),
      sha256: `sha256_verdict_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    },
    updatedAt: new Date().toISOString(),
  };

  // 1. Firestore update
  if (db) {
    try {
      const claimRef = doc(db, "claims", claimId);
      await updateDoc(claimRef, updatePayload);
    } catch (err) {
      console.warn("[Firebase] Could not update verdict in Firestore:", err.message);
    }
  }

  // 2. Backend API update
  try {
    await apiSubmitReport(claimId, verdict, verdictNote, decisions);
  } catch (err) {
    console.warn("[API] Backend report update note:", err.message);
  }

  // 3. Local update
  const localList = getLocal(LOCAL_STORAGE_CLAIMS_KEY);
  const updated = localList.map((c) => (c.id === claimId ? { ...c, ...updatePayload } : c));
  setLocal(LOCAL_STORAGE_CLAIMS_KEY, updated);

  return updatePayload;
}

/* =========================================================================
   2. STORE CHALLANS & DELIVERIES
   ========================================================================= */

export async function saveChallanToFirestore(challanData) {
  const challanId = String(challanData.id || `CH-${Date.now()}`);
  const record = {
    ...challanData,
    id: challanId,
    updatedAt: new Date().toISOString(),
  };

  if (db) {
    try {
      const docRef = doc(db, "deliveries", challanId);
      await setDoc(docRef, { ...record, firestoreTimestamp: serverTimestamp() }, { merge: true });
    } catch (e) {
      console.warn("[Firebase] Store challan write fallback:", e.message);
    }
  }

  const current = getLocal(LOCAL_STORAGE_DELIVERIES_KEY);
  const filtered = current.filter((c) => String(c.id) !== challanId);
  setLocal(LOCAL_STORAGE_DELIVERIES_KEY, [record, ...filtered]);

  return record;
}

/* =========================================================================
   3. MATERIAL ISSUES & DRAWDOWNS
   ========================================================================= */

export async function saveIssueToFirestore(issueData) {
  const issueId = String(issueData.id || `ISS-${Date.now()}`);
  const record = {
    ...issueData,
    id: issueId,
    issued_at: issueData.issued_at || new Date().toISOString(),
  };

  if (db) {
    try {
      const docRef = doc(db, "material_issues", issueId);
      await setDoc(docRef, { ...record, firestoreTimestamp: serverTimestamp() }, { merge: true });
    } catch (e) {
      console.warn("[Firebase] Issue write fallback:", e.message);
    }
  }

  const current = getLocal(LOCAL_STORAGE_ISSUES_KEY);
  setLocal(LOCAL_STORAGE_ISSUES_KEY, [record, ...current]);

  return record;
}

/* =========================================================================
   4. AUDIT & DISCREPANCY ALERTS
   ========================================================================= */

export async function saveAlertToFirestore(alertData) {
  const alertId = String(alertData.id || `ALT-${Date.now()}`);
  const record = {
    ...alertData,
    id: alertId,
    status: alertData.status || "open",
    created_at: alertData.created_at || new Date().toISOString(),
  };

  if (db) {
    try {
      const docRef = doc(db, "alerts", alertId);
      await setDoc(docRef, { ...record, firestoreTimestamp: serverTimestamp() }, { merge: true });
    } catch (e) {
      console.warn("[Firebase] Alert write fallback:", e.message);
    }
  }

  const current = getLocal(LOCAL_STORAGE_ALERTS_KEY);
  setLocal(LOCAL_STORAGE_ALERTS_KEY, [record, ...current]);

  return record;
}

/* =========================================================================
   5. USER AUTHORITIES & ACCESS ALLOWLIST
   ========================================================================= */

export async function saveUserToFirestore(userData) {
  const userId = String(userData.id || `USR-${Date.now()}`);
  const record = {
    ...userData,
    id: userId,
    created_at: new Date().toISOString(),
  };

  if (db) {
    try {
      const docRef = doc(db, "users", userId);
      await setDoc(docRef, { ...record, firestoreTimestamp: serverTimestamp() }, { merge: true });
    } catch (e) {
      console.warn("[Firebase] User allowlist write note:", e.message);
    }
  }

  return record;
}
