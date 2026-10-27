import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  pingAuditor,
  fetchUsers,
  createUser,
  updateUserRole,
  deleteUser,
  fetchExifGpsReport,
} from "../../api/client";
import {
  fetchChallans,
  getChallanFileUrl,
  fetchStoreAlerts,
  updateAlertAction,
} from "../../api/store";
import { ClaimAuditDesk } from "./ClaimAuditDesk";
import { saveUserToFirestore } from "../../services/firebaseDataService";
import { useAuth } from "../../auth/AuthContext";
import ConstraLogo from "../../components/common/ConstraLogo";

export const AuditorHome = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("desk"); // 'desk' | 'deliveries' | 'alerts' | 'exif' | 'users'

  // Deliveries & Store Ingestion State
  const [challansList, setChallansList] = useState([]);
  const [loadingChallans, setLoadingChallans] = useState(false);
  const [challansError, setChallansError] = useState(null);

  // Store & BOQ Alerts State
  const [alertsList, setAlertsList] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alertsError, setAlertsError] = useState(null);

  // Alert Action Modal State
  const [actionModalAlert, setActionModalAlert] = useState(null);
  const [alertActionType, setAlertActionType] = useState("resolved"); // 'resolved' | 'escalated'
  const [alertJustification, setAlertJustification] = useState("");
  const [submittingAlertAction, setSubmittingAlertAction] = useState(false);
  const [alertActionError, setAlertActionError] = useState(null);

  const [pingResult, setPingResult] = useState(null);
  const [loadingPing, setLoadingPing] = useState(false);
  const [errorPing, setErrorPing] = useState(null);

  // User management state
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState(null);

  // Add user form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("supervisor");
  const [submittingUser, setSubmittingUser] = useState(false);
  const [formSuccess, setFormSuccess] = useState(null);
  const [formError, setFormError] = useState(null);

  // EXIF & GPS Analyzer state
  const [projectId, setProjectId] = useState("project-001");
  const [fileName, setFileName] = useState("column_casting.jpg");
  const [exifReport, setExifReport] = useState(null);
  const [loadingExif, setLoadingExif] = useState(false);
  const [exifError, setExifError] = useState(null);

  const loadUsers = async () => {
    setLoadingUsers(true);
    setUsersError(null);
    try {
      const data = await fetchUsers();
      setUsersList(data);
    } catch (err) {
      setUsersError(err?.message || "Failed to load registered users");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleFetchExifReport = async (pId = projectId, fName = fileName) => {
    if (!pId || !fName) return;
    setLoadingExif(true);
    setExifError(null);
    setExifReport(null);
    try {
      const report = await fetchExifGpsReport(pId, fName);
      setExifReport(report);
    } catch (err) {
      setExifError(err?.message || "Failed to fetch EXIF & GPS verification report");
    } finally {
      setLoadingExif(false);
    }
  };

  const loadChallans = async () => {
    setLoadingChallans(true);
    setChallansError(null);
    try {
      const data = await fetchChallans(1);
      setChallansList(data?.items || []);
    } catch (err) {
      setChallansError(err?.message || "Failed to load store challans");
    } finally {
      setLoadingChallans(false);
    }
  };

  const loadAlerts = async () => {
    setLoadingAlerts(true);
    setAlertsError(null);
    try {
      const data = await fetchStoreAlerts(1);
      setAlertsList(data || []);
    } catch (err) {
      setAlertsError(err?.message || "Failed to load project alerts");
    } finally {
      setLoadingAlerts(false);
    }
  };

  const handleAlertActionSubmit = async (e) => {
    e.preventDefault();
    if (!actionModalAlert) return;
    if (!alertJustification.trim() || alertJustification.trim().length < 5) {
      setAlertActionError("A mandatory written justification of at least 5 characters is required.");
      return;
    }
    setSubmittingAlertAction(true);
    setAlertActionError(null);
    try {
      await updateAlertAction(actionModalAlert.id, alertActionType, alertJustification.trim());
      setActionModalAlert(null);
      setAlertJustification("");
      loadAlerts();
    } catch (err) {
      setAlertActionError(err?.message || "Failed to update alert status");
    } finally {
      setSubmittingAlertAction(false);
    }
  };

  useEffect(() => {
    loadUsers();
    handleFetchExifReport("project-001", "column_casting.jpg");
    loadChallans();
    loadAlerts();
  }, []);

  const handleTestPing = async () => {
    setLoadingPing(true);
    setErrorPing(null);
    setPingResult(null);
    try {
      const data = await pingAuditor();
      setPingResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setErrorPing(err?.message || "Ping failed");
    } finally {
      setLoadingPing(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!fullName.trim() || !email.trim()) {
      setFormError("Full name and email are required.");
      return;
    }

    setSubmittingUser(true);
    try {
      const newUser = await createUser({
        full_name: fullName.trim(),
        email: email.trim(),
        role,
      });
      await saveUserToFirestore(newUser);
      setFormSuccess(`User ${newUser.email} added successfully to database & Firebase Firestore!`);
      setFullName("");
      setEmail("");
      loadUsers();
    } catch (err) {
      setFormError(err?.message || "Failed to register new user");
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await updateUserRole(userId, { role: newRole });
      loadUsers();
    } catch (err) {
      alert(err?.message || "Failed to update role");
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (!window.confirm(`Are you sure you want to remove ${userEmail} from authorized users?`)) {
      return;
    }
    try {
      await deleteUser(userId);
      loadUsers();
    } catch (err) {
      alert(err?.message || "Failed to remove user");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "PASS":
        return "bg-[#93d5ad]/30 text-[#296a49] border-[#296a49]";
      case "FLAGGED":
      case "FAIL":
        return "bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]";
      case "REVIEW_REQUIRED":
      case "WARNING":
        return "bg-[#ffdea2] text-[#7a5900] border-[#7a5900]";
      default:
        return "bg-[#E6E2DD] text-[#5F5E5E] border-[#A39B8F]/30";
    }
  };

  const getRoleBadge = (r) => {
    switch (r) {
      case "auditor":
        return "bg-[#ffdea2] text-[#7a5900] border-[#7a5900]";
      case "store_incharge":
        return "bg-[#E6E2DD] text-[#504533] border-[#827560]";
      case "supervisor":
        return "bg-[#93d5ad]/30 text-[#296a49] border-[#296a49]";
      default:
        return "bg-[#E6E2DD] text-[#504533] border-[#A39B8F]";
    }
  };

  return (
    <div className="min-h-screen bg-[#E6E2DD] text-[#101010] flex flex-col font-body-md text-body-md selection:bg-[#FCBC18] selection:text-[#101010]">
      {/* Background Hairline Grid */}
      <div className="pointer-events-none fixed inset-0 z-0 grid grid-cols-12 gap-4 px-6 opacity-[0.06]">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="h-full border-r border-[#101010]" />
        ))}
      </div>

      {/* Top Header Bar */}
      <header className="border-b border-[#101010] bg-[#101010] text-[#F2ECE6] sticky top-0 z-40 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shadow-[0_2px_0px_#101010]">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 group" title="Return to Home">
            <ConstraLogo className="w-7 h-7 object-contain group-hover:scale-105 transition-transform" />
            <span className="font-headline-md text-headline-md tracking-wider uppercase font-bold text-[#F2ECE6] group-hover:text-[#FCBC18] transition-colors">
              CONSTRA
            </span>
          </Link>
          <div className="h-4 w-[1px] bg-[#A39B8F]/30 hidden sm:block" />
          <div className="hidden sm:flex items-center gap-2">
            <span className="font-label-code text-label-code uppercase tracking-widest text-[#A39B8F] border border-[#A39B8F]/30 px-2 py-[1px]">
              CIVIL AUDIT PLATFORM
            </span>
            <span className="font-label-meta text-label-meta uppercase tracking-wider text-[#FCBC18]">
              APEX GOVERNANCE // TIER 03
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="font-label-code text-label-code text-[#F2ECE6] uppercase font-bold">
              {user?.full_name || "Lead Auditor"}
            </p>
            <p className="font-label-meta text-label-meta text-[#A39B8F] uppercase">
              {user?.email}
            </p>
          </div>
          <span className="px-2.5 py-1 font-label-code text-label-code uppercase font-bold bg-[#ffdea2] text-[#7a5900] border border-[#7a5900]">
            CLEARANCE-A
          </span>
          <button
            onClick={() => logout()}
            className="px-3 py-1 font-label-code text-label-code uppercase border border-[#F2ECE6] text-[#F2ECE6] hover:bg-[#F2ECE6] hover:text-[#101010] transition-colors cursor-pointer"
          >
            LOGOUT
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#101010] pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab("desk")}
            className={`px-4 py-2 font-label-code text-label-code uppercase tracking-wider font-bold transition-all border cursor-pointer flex items-center gap-2 ${activeTab === "desk"
                ? "bg-[#FCBC18] text-[#101010] border-[#101010] shadow-[2px_2px_0px_#101010]"
                : "bg-[#F2ECE6] text-[#5F5E5E] border-[#A39B8F]/40 hover:text-[#101010] hover:border-[#101010]"
              }`}
          >
            <span className="material-symbols-outlined text-[15px]">assignment</span>
            <span>01 // CLAIM AUDIT DESK</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("deliveries");
              loadChallans();
            }}
            className={`px-4 py-2 font-label-code text-label-code uppercase tracking-wider font-bold transition-all border cursor-pointer flex items-center gap-2 ${activeTab === "deliveries"
                ? "bg-[#FCBC18] text-[#101010] border-[#101010] shadow-[2px_2px_0px_#101010]"
                : "bg-[#F2ECE6] text-[#5F5E5E] border-[#A39B8F]/40 hover:text-[#101010] hover:border-[#101010]"
              }`}
          >
            <span className="material-symbols-outlined text-[15px]">local_shipping</span>
            <span>02 // STORE CHALLANS ({challansList.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("alerts");
              loadAlerts();
            }}
            className={`px-4 py-2 font-label-code text-label-code uppercase tracking-wider font-bold transition-all border cursor-pointer flex items-center gap-2 ${activeTab === "alerts"
                ? "bg-[#FCBC18] text-[#101010] border-[#101010] shadow-[2px_2px_0px_#101010]"
                : "bg-[#F2ECE6] text-[#5F5E5E] border-[#A39B8F]/40 hover:text-[#101010] hover:border-[#101010]"
              }`}
          >
            <span className="material-symbols-outlined text-[15px]">warning</span>
            <span>03 // AUDIT ALERTS ({alertsList.filter((a) => a.status !== "resolved").length})</span>
          </button>
          <button
            onClick={() => setActiveTab("exif")}
            className={`px-4 py-2 font-label-code text-label-code uppercase tracking-wider font-bold transition-all border cursor-pointer flex items-center gap-2 ${activeTab === "exif"
                ? "bg-[#FCBC18] text-[#101010] border-[#101010] shadow-[2px_2px_0px_#101010]"
                : "bg-[#F2ECE6] text-[#5F5E5E] border-[#A39B8F]/40 hover:text-[#101010] hover:border-[#101010]"
              }`}
          >
            <span className="material-symbols-outlined text-[15px]">location_on</span>
            <span>04 // EXIF &amp; GPS</span>
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 font-label-code text-label-code uppercase tracking-wider font-bold transition-all border cursor-pointer flex items-center gap-2 ${activeTab === "users"
                ? "bg-[#FCBC18] text-[#101010] border-[#101010] shadow-[2px_2px_0px_#101010]"
                : "bg-[#F2ECE6] text-[#5F5E5E] border-[#A39B8F]/40 hover:text-[#101010] hover:border-[#101010]"
              }`}
          >
            <span className="material-symbols-outlined text-[15px]">manage_accounts</span>
            <span>05 // USER ACCESS</span>
          </button>
        </div>

        {/* TAB 1: CLAIM AUDIT DESK */}
        {activeTab === "desk" && (
          <div className="space-y-6">
            <ClaimAuditDesk />
          </div>
        )}

        {/* TAB 2: STORE DELIVERIES & INGESTION */}
        {activeTab === "deliveries" && (
          <div className="p-6 bg-[#F2ECE6] border border-[#101010] shadow-[3px_3px_0px_#101010] space-y-6 relative">
            <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#101010]" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#101010]" />
            <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#101010]" />
            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#101010]" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#A39B8F]/30">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-[#FCBC18]" />
                  <h3 className="font-headline-lg text-headline-lg font-bold text-[#101010] uppercase tracking-tight">
                    Store Deliveries &amp; Challan Ingestion
                  </h3>
                </div>
                <p className="font-label-meta text-label-meta text-[#5F5E5E] uppercase mt-1">
                  INSPECT DELIVERY CHALLANS, INVOICES, AND MATERIAL RECONCILIATIONS SUBMITTED BY STORE IN-CHARGE.
                </p>
              </div>
              <button
                type="button"
                onClick={loadChallans}
                className="px-3 py-1.5 bg-[#FCBC18] text-[#101010] font-label-code text-label-code font-bold uppercase border border-[#101010] shadow-[2px_2px_0px_#101010] hover:bg-white cursor-pointer"
              >
                REFRESH CHALLANS
              </button>
            </div>

            {loadingChallans ? (
              <div className="p-12 text-center text-[#5F5E5E] font-label-code text-label-code uppercase">
                LOADING STORE CHALLANS...
              </div>
            ) : challansError ? (
              <div className="p-4 bg-[#ffdad6] border border-[#ba1a1a] text-[#ba1a1a] font-label-code text-label-code uppercase">
                {challansError}
              </div>
            ) : challansList.length === 0 ? (
              <div className="p-12 text-center bg-[#E6E2DD] border border-[#101010] space-y-2">
                <span className="material-symbols-outlined text-4xl text-[#FCBC18]">local_shipping</span>
                <p className="font-label-code text-label-code text-[#101010] font-bold uppercase">
                  NO STORE CHALLANS FOUND
                </p>
                <p className="font-label-meta text-label-meta text-[#5F5E5E]">
                  Challans uploaded by the Store In-Charge will appear here for audit review.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-[#101010] font-label-code text-label-code">
                  <thead>
                    <tr className="bg-[#101010] text-[#F2ECE6] uppercase text-xs">
                      <th className="py-2.5 px-3 border-r border-[#A39B8F]/30">CHALLAN #</th>
                      <th className="py-2.5 px-3 border-r border-[#A39B8F]/30">VENDOR</th>
                      <th className="py-2.5 px-3 border-r border-[#A39B8F]/30">DATE</th>
                      <th className="py-2.5 px-3 border-r border-[#A39B8F]/30">STATUS</th>
                      <th className="py-2.5 px-3 border-r border-[#A39B8F]/30">ITEMS SUMMARY</th>
                      <th className="py-2.5 px-3 text-right">EVIDENCE DOCUMENT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#101010] bg-[#E6E2DD]">
                    {challansList.map((c) => (
                      <tr key={c.id} className="hover:bg-[#F2ECE6] transition-colors">
                        <td className="py-3 px-3 font-bold border-r border-[#101010] text-[#101010]">
                          {c.challan_no || `CH-${c.id}`}
                        </td>
                        <td className="py-3 px-3 border-r border-[#101010] uppercase">
                          {c.vendor_name || c.vendor?.name || `Vendor #${c.vendor_id || "1"}`}
                        </td>
                        <td className="py-3 px-3 border-r border-[#101010] text-[#5F5E5E]">
                          {c.challan_date || "Recorded"}
                        </td>
                        <td className="py-3 px-3 border-r border-[#101010]">
                          <span
                            className={`px-2 py-0.5 border font-bold uppercase text-xs ${c.status === "confirmed"
                                ? "bg-[#93d5ad]/30 text-[#296a49] border-[#296a49]"
                                : "bg-[#ffdea2] text-[#7a5900] border-[#7a5900]"
                              }`}
                          >
                            {c.status || "DRAFT"}
                          </span>
                        </td>
                        <td className="py-3 px-3 border-r border-[#101010] text-xs">
                          {c.items && c.items.length > 0
                            ? c.items.map((it) => `${it.material_name || "Item"}: ${it.quantity} ${it.unit || ""}`).join(", ")
                            : `${c.items_count || 1} material lines`}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <a
                            href={getChallanFileUrl(c.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1 bg-[#101010] text-[#FCBC18] hover:bg-[#FCBC18] hover:text-[#101010] font-bold uppercase text-xs transition-colors"
                          >
                            <span className="material-symbols-outlined text-xs">open_in_new</span>
                            <span>VIEW ORIGINAL EVIDENCE</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: AUDIT ALERTS & RESOLUTION */}
        {activeTab === "alerts" && (
          <div className="p-6 bg-[#F2ECE6] border border-[#101010] shadow-[3px_3px_0px_#101010] space-y-6 relative">
            <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#101010]" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#101010]" />
            <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#101010]" />
            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#101010]" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#A39B8F]/30">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-[#ba1a1a]" />
                  <h3 className="font-headline-lg text-headline-lg font-bold text-[#101010] uppercase tracking-tight">
                    Project Alerts &amp; Discrepancy Resolution
                  </h3>
                </div>
                <p className="font-label-meta text-label-meta text-[#5F5E5E] uppercase mt-1">
                  CRITICAL OR HIGH UNRESOLVED ALERTS BLOCK MILESTONE APPROVAL ON THE BACKEND. AUDITORS MUST PROVIDE WRITTEN JUSTIFICATION TO RESOLVE OR ESCALATE.
                </p>
              </div>
              <button
                type="button"
                onClick={loadAlerts}
                className="px-3 py-1.5 bg-[#FCBC18] text-[#101010] font-label-code text-label-code font-bold uppercase border border-[#101010] shadow-[2px_2px_0px_#101010] hover:bg-white cursor-pointer"
              >
                REFRESH ALERTS
              </button>
            </div>

            {loadingAlerts ? (
              <div className="p-12 text-center text-[#5F5E5E] font-label-code text-label-code uppercase">
                LOADING PROJECT ALERTS...
              </div>
            ) : alertsError ? (
              <div className="p-4 bg-[#ffdad6] border border-[#ba1a1a] text-[#ba1a1a] font-label-code text-label-code uppercase">
                {alertsError}
              </div>
            ) : alertsList.length === 0 ? (
              <div className="p-12 text-center bg-[#E6E2DD] border border-[#101010] space-y-2">
                <span className="material-symbols-outlined text-4xl text-[#296a49]">check_circle</span>
                <p className="font-label-code text-label-code text-[#101010] font-bold uppercase">
                  ZERO UNRESOLVED ALERTS
                </p>
                <p className="font-label-meta text-label-meta text-[#5F5E5E]">
                  All material reconciliations and geofence gates satisfy project policy.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {alertsList.map((a) => (
                  <div
                    key={a.id}
                    className={`p-4 border-2 transition-all ${a.status === "resolved"
                        ? "bg-[#E6E2DD] border-[#296a49]/40 opacity-75"
                        : a.severity === "CRITICAL"
                          ? "bg-[#ffdad6]/40 border-[#ba1a1a]"
                          : a.severity === "HIGH"
                            ? "bg-[#ffdea2]/40 border-[#7a5900]"
                            : "bg-[#E6E2DD] border-[#101010]"
                      }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#A39B8F]/30">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-label-code text-label-code font-bold text-[#101010]">
                          ALERT #{a.id}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-bold uppercase border ${a.severity === "CRITICAL"
                              ? "bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]"
                              : a.severity === "HIGH"
                                ? "bg-[#ffdea2] text-[#7a5900] border-[#7a5900]"
                                : "bg-[#E6E2DD] text-[#504533] border-[#827560]"
                            }`}
                        >
                          {a.severity} SEVERITY
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-bold uppercase border ${a.status === "resolved"
                              ? "bg-[#93d5ad]/30 text-[#296a49] border-[#296a49]"
                              : a.status === "escalated"
                                ? "bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]"
                                : "bg-[#ffdea2] text-[#7a5900] border-[#7a5900]"
                            }`}
                        >
                          STATUS: {a.status}
                        </span>
                        <span className="font-label-code text-label-code text-[#5F5E5E] text-xs uppercase">
                          TYPE: {a.type}
                        </span>
                      </div>
                      <span className="font-label-meta text-label-meta text-[#5F5E5E] text-xs">
                        {new Date(a.created_at).toLocaleString()}
                      </span>
                    </div>

                    <p className="font-body-md text-body-md text-[#101010] mt-2 font-medium">
                      {a.explanation}
                    </p>

                    {a.auditor_comment && (
                      <div className="mt-2 p-2 bg-white border border-[#101010] text-xs font-label-code text-label-code">
                        <strong className="text-[#296a49] uppercase block">
                          RECORDED AUDITOR JUSTIFICATION:
                        </strong>
                        <p className="text-[#101010]">{a.auditor_comment}</p>
                      </div>
                    )}

                    {a.status !== "resolved" && (
                      <div className="mt-3 pt-2 border-t border-[#A39B8F]/30 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActionModalAlert(a);
                            setAlertActionType("escalated");
                            setAlertJustification("");
                            setAlertActionError(null);
                          }}
                          className="px-3 py-1 bg-[#ffdad6] text-[#ba1a1a] border border-[#ba1a1a] font-label-code text-label-code font-bold uppercase text-xs hover:bg-[#ba1a1a] hover:text-white transition-colors cursor-pointer"
                        >
                          ESCALATE ALERT
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionModalAlert(a);
                            setAlertActionType("resolved");
                            setAlertJustification("");
                            setAlertActionError(null);
                          }}
                          className="px-3 py-1 bg-[#FCBC18] text-[#101010] border border-[#101010] font-label-code text-label-code font-bold uppercase text-xs hover:bg-[#101010] hover:text-[#FCBC18] transition-colors cursor-pointer shadow-[2px_2px_0px_#101010]"
                        >
                          RESOLVE ALERT (JUSTIFIED)
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: EXIF & GPS INSPECTOR */}
        {activeTab === "exif" && (
          <div className="p-6 bg-[#F2ECE6] border border-[#101010] shadow-[3px_3px_0px_#101010] space-y-6 relative">
            <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#101010]" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#101010]" />
            <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#101010]" />
            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#101010]" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#A39B8F]/30">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-[#FCBC18]" />
                  <h3 className="font-headline-lg text-headline-lg font-bold text-[#101010] uppercase tracking-tight">
                    Construction Photo EXIF &amp; GPS Audit
                  </h3>
                </div>
                <p className="font-label-meta text-label-meta text-[#5F5E5E] uppercase mt-1">
                  INSPECT PHOTO CAPTURE TIMESTAMPS, GEOFENCE RADIUS, SOFTWARE EDITING SIGNATURES, AND SHA-256 HASH DUPLICATION.
                </p>
              </div>
              <div className="font-label-code text-label-code bg-[#101010] text-[#FCBC18] px-3 py-1 font-bold">
                WGS 84 // EPSG:4326
              </div>
            </div>

            {/* Form Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#E6E2DD] p-4 border border-[#101010]">
              <div>
                <label className="font-label-meta text-label-meta uppercase text-[#504533] block mb-1">
                  PROJECT IDENTIFIER
                </label>
                <input
                  type="text"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="project-001"
                  className="w-full bg-[#F2ECE6] border border-[#101010] px-3 py-2 text-[#101010] font-label-code text-label-code uppercase outline-none"
                />
              </div>
              <div>
                <label className="font-label-meta text-label-meta uppercase text-[#504533] block mb-1">
                  EVIDENCE PHOTO FILENAME
                </label>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="column_casting.jpg"
                  className="w-full bg-[#F2ECE6] border border-[#101010] px-3 py-2 text-[#101010] font-label-code text-label-code outline-none"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => handleFetchExifReport(projectId, fileName)}
                  disabled={loadingExif}
                  className="w-full py-2 px-4 bg-[#FCBC18] hover:bg-[#101010] text-[#101010] hover:text-[#FCBC18] font-label-code text-label-code uppercase font-bold border border-[#101010] shadow-[2px_2px_0px_#101010] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">search</span>
                  <span>{loadingExif ? "ANALYZING BLOB..." : "RUN EXIF & GPS AUDIT"}</span>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {exifError && (
              <div className="p-4 bg-[#ffdad6] border border-[#ba1a1a] text-[#ba1a1a] font-label-code text-label-code uppercase">
                <div className="font-bold mb-1">AUDIT PIPELINE FAILURE</div>
                <p>{exifError}</p>
              </div>
            )}

            {/* Report Visualization */}
            {exifReport && !loadingExif && (
              <div className="space-y-6">
                {/* Report Header Card */}
                <div className="p-5 bg-[#E6E2DD] border border-[#101010] flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-label-meta text-label-meta text-[#5F5E5E] uppercase">
                        REPORT TYPE:
                      </span>
                      <span className="font-label-code text-label-code font-bold text-[#101010] bg-[#F2ECE6] px-2 py-0.5 border border-[#101010] uppercase">
                        {exifReport.report_type}
                      </span>
                    </div>
                    <h4 className="font-headline-md text-headline-md font-bold text-[#101010] uppercase mt-1 flex items-center gap-2">
                      <span>📄 {exifReport.file_name}</span>
                    </h4>
                    <p className="font-label-meta text-label-meta text-[#5F5E5E] uppercase mt-1">
                      SHA-256: <strong className="text-[#101010]">{exifReport.file_sha256}</strong>
                    </p>
                  </div>

                  <div className="flex flex-col items-start md:items-end gap-1">
                    <span className="font-label-meta text-label-meta uppercase text-[#5F5E5E]">
                      OVERALL GATE STATUS
                    </span>
                    <span
                      className={`px-4 py-1.5 font-label-code text-label-code font-bold uppercase border tracking-wider ${getStatusBadge(
                        exifReport.overall_status
                      )}`}
                    >
                      {exifReport.overall_status}
                    </span>
                    <span className="font-label-meta text-label-meta text-[#8C8B91] uppercase mt-1">
                      GENERATED: {new Date(exifReport.generated_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Telemetry Spec Rows */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-label-code text-label-code text-center">
                  <div className="p-3 bg-[#E6E2DD] border border-[#101010]">
                    <p className="font-label-meta text-label-meta text-[#5F5E5E] uppercase">TOTAL CHECKS</p>
                    <p className="text-xl font-bold text-[#101010] mt-1 tabular-nums">{exifReport.summary.total_checks}</p>
                  </div>
                  <div className="p-3 bg-[#E6E2DD] border border-[#2F6F4E] border-t-4 border-t-[#2F6F4E]">
                    <p className="font-label-meta text-label-meta text-[#2F6F4E] uppercase">PASSED</p>
                    <p className="text-xl font-bold text-[#2F6F4E] mt-1 tabular-nums">{exifReport.summary.passed}</p>
                  </div>
                  <div className="p-3 bg-[#E6E2DD] border border-[#B3261E] border-t-4 border-t-[#B3261E]">
                    <p className="font-label-meta text-label-meta text-[#B3261E] uppercase">FAILED</p>
                    <p className="text-xl font-bold text-[#B3261E] mt-1 tabular-nums">{exifReport.summary.failed}</p>
                  </div>
                  <div className="p-3 bg-[#E6E2DD] border border-[#FCBC18] border-t-4 border-t-[#FCBC18]">
                    <p className="font-label-meta text-label-meta text-[#7a5900] uppercase">WARNINGS</p>
                    <p className="text-xl font-bold text-[#7a5900] mt-1 tabular-nums">{exifReport.summary.warnings}</p>
                  </div>
                  <div className="p-3 bg-[#E6E2DD] border border-[#101010]">
                    <p className="font-label-meta text-label-meta text-[#8C8B91] uppercase">NOT CHECKED</p>
                    <p className="text-xl font-bold text-[#8C8B91] mt-1 tabular-nums">{exifReport.summary.not_checked}</p>
                  </div>
                </div>

                {/* Checks Breakdown */}
                <div className="space-y-3">
                  <h4 className="font-label-code text-label-code font-bold uppercase tracking-wider text-[#101010]">
                    AUTOMATED CHECK PIPELINE RESULTS
                  </h4>
                  <div className="grid grid-cols-1 gap-3 font-label-code text-label-code">
                    {exifReport.checks.map((check, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-[#E6E2DD] border border-[#101010] flex flex-col gap-2"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="font-headline-md text-headline-md font-bold uppercase text-[#101010]">
                            {check.name}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 uppercase font-bold border self-start sm:self-auto ${getStatusBadge(
                              check.status
                            )}`}
                          >
                            {check.status}
                          </span>
                        </div>
                        <p className="font-body-md text-body-md text-[#5F5E5E]">
                          {check.message}
                        </p>

                        {/* Details */}
                        {check.details && Object.keys(check.details).length > 0 && (
                          <div className="mt-2 pt-2 border-t border-[#A39B8F]/30 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {Object.entries(check.details).map(([k, v]) => (
                              <div key={k} className="bg-[#F2ECE6] px-2.5 py-1 border border-[#A39B8F]/40">
                                <span className="font-label-meta text-label-meta uppercase text-[#5F5E5E] block">{k}</span>
                                <span className="font-bold text-[#101010] break-all">{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: USER ALLOWLIST & AUTH */}
        {activeTab === "users" && (
          <div className="space-y-6">
            {/* API Authorization Test */}
            <div className="p-6 bg-[#F2ECE6] border border-[#101010] shadow-[2px_2px_0px_#101010]">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 bg-[#FCBC18]" />
                <h3 className="font-headline-md text-headline-md font-bold uppercase text-[#101010]">
                  API AUTHORIZATION HANDSHAKE TEST
                </h3>
              </div>
              <p className="font-body-md text-body-md text-[#5F5E5E] mb-4">
                Sends an authenticated request with your Firebase Bearer token to <code className="font-label-code text-label-code bg-[#E6E2DD] px-1.5 py-0.5 border border-[#101010]">GET /auditor/ping</code>.
              </p>
              <button
                onClick={handleTestPing}
                disabled={loadingPing}
                className="px-4 py-2 bg-[#FCBC18] hover:bg-[#101010] text-[#101010] hover:text-[#FCBC18] font-label-code text-label-code uppercase font-bold border border-[#101010] shadow-[2px_2px_0px_#101010] transition-colors cursor-pointer disabled:opacity-50"
              >
                {loadingPing ? "CONNECTING..." : "TEST API CONNECTION (/auditor/ping)"}
              </button>

              {pingResult && (
                <div className="mt-4 p-4 bg-[#101010] border border-[#2F6F4E] text-[#93d5ad] font-label-code text-label-code">
                  <div className="font-bold mb-1 uppercase">✓ 200 OK — AUTHORIZATION CONFIRMED:</div>
                  <pre className="overflow-x-auto">{pingResult}</pre>
                </div>
              )}

              {errorPing && (
                <div className="mt-4 p-4 bg-[#ffdad6] border border-[#ba1a1a] text-[#ba1a1a] font-label-code text-label-code uppercase">
                  <div className="font-bold mb-1">✗ HANDSHAKE ERROR:</div>
                  <p>{errorPing}</p>
                </div>
              )}
            </div>

            {/* User Allowlist Roster & Add Form */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Add User Form */}
              <div className="p-6 bg-[#F2ECE6] border border-[#101010] shadow-[2px_2px_0px_#101010] lg:col-span-1">
                <h3 className="font-headline-md text-headline-md font-bold text-[#101010] uppercase mb-1">
                  Add Registered User
                </h3>
                <p className="font-body-sm text-body-sm text-[#5F5E5E] mb-4">
                  Allowlist a Google account email and assign their operational role tier.
                </p>

                {formSuccess && (
                  <div className="mb-4 p-3 bg-[#93d5ad]/30 border border-[#296a49] text-[#296a49] font-label-code text-label-code uppercase font-bold">
                    {formSuccess}
                  </div>
                )}

                {formError && (
                  <div className="mb-4 p-3 bg-[#ffdad6] border border-[#ba1a1a] text-[#ba1a1a] font-label-code text-label-code uppercase font-bold">
                    {formError}
                  </div>
                )}

                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <label className="font-label-meta text-label-meta uppercase text-[#504533] block mb-1">FULL NAME</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-[#E6E2DD] border border-on-surface px-3 py-2 text-[#101010] font-label-code text-label-code outline-none focus:ring-2 focus:ring-primary-container"
                    />
                  </div>

                  <div>
                    <label className="font-label-meta text-label-meta uppercase text-[#504533] block mb-1">GOOGLE EMAIL ADDRESS</label>
                    <input
                      type="email"
                      required
                      placeholder="user@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#E6E2DD] border border-on-surface px-3 py-2 text-[#101010] font-label-code text-label-code outline-none focus:ring-2 focus:ring-primary-container"
                    />
                  </div>

                  <div>
                    <label className="font-label-meta text-label-meta uppercase text-[#504533] block mb-1">ASSIGNED ROLE CLEARANCE</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full bg-[#E6E2DD] border border-on-surface px-3 py-2 text-[#101010] font-label-code text-label-code uppercase outline-none focus:ring-2 focus:ring-primary-container"
                    >
                      <option value="supervisor">SITE SUPERVISOR (LEVEL-01)</option>
                      <option value="store_incharge">STORE IN-CHARGE (LEVEL-02)</option>
                      <option value="auditor">PROJECT AUDITOR (CLEARANCE-A)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingUser}
                    className="w-full py-2.5 px-4 bg-[#FCBC18] hover:bg-[#101010] text-[#101010] hover:text-[#FCBC18] font-label-code text-label-code uppercase font-bold border border-[#101010] shadow-[2px_2px_0px_#101010] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {submittingUser ? "REGISTERING..." : "ALLOWLIST CREDENTIAL"}
                  </button>
                </form>
              </div>

              {/* Registered Users Roster Table */}
              <div className="p-6 bg-[#F2ECE6] border border-[#101010] shadow-[2px_2px_0px_#101010] lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-headline-md text-headline-md font-bold text-[#101010] uppercase">
                      Authorized User Allowlist Roster
                    </h3>
                    <p className="font-body-sm text-body-sm text-[#5F5E5E]">
                      Only emails on this roster can authenticate into operational dashboards.
                    </p>
                  </div>
                  <span className="font-label-code text-label-code px-2 py-0.5 bg-[#101010] text-[#FCBC18] font-bold">
                    {usersList.length} USERS
                  </span>
                </div>

                {usersError && (
                  <div className="p-3 bg-[#ffdad6] border border-[#ba1a1a] text-[#ba1a1a] font-label-code text-label-code uppercase mb-4">
                    {usersError}
                  </div>
                )}

                {loadingUsers ? (
                  <div className="p-8 text-center text-[#5F5E5E] font-label-code text-label-code uppercase animate-pulse">
                    LOADING AUTHORIZED ROSTER...
                  </div>
                ) : (
                  <div className="border border-[#101010] overflow-x-auto">
                    <table className="w-full text-left border-collapse font-label-code text-label-code">
                      <thead>
                        <tr className="bg-[#101010] text-[#F2ECE6] font-label-meta text-label-meta uppercase tracking-widest">
                          <th className="py-2.5 px-3 border-r border-[#A39B8F]/30">USER DETAILS</th>
                          <th className="py-2.5 px-3 border-r border-[#A39B8F]/30">EMAIL ADDRESS</th>
                          <th className="py-2.5 px-3 text-center border-r border-[#A39B8F]/30">ASSIGNED ROLE</th>
                          <th className="py-2.5 px-3 text-center border-r border-[#A39B8F]/30">STATUS</th>
                          <th className="py-2.5 px-3 text-right">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#A39B8F]/30 text-[#101010]">
                        {usersList.map((u, idx) => (
                          <tr key={u.id || idx} className="hover:bg-[#E6E2DD] transition-colors">
                            <td className="py-3 px-3 border-r border-[#A39B8F]/30 font-bold uppercase">
                              {u.full_name}
                            </td>
                            <td className="py-3 px-3 border-r border-[#A39B8F]/30 text-[#5F5E5E]">
                              {u.email}
                            </td>
                            <td className="py-3 px-3 border-r border-[#A39B8F]/30 text-center">
                              <select
                                value={u.role}
                                onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                                className={`px-2 py-1 border font-bold uppercase text-xs bg-[#F2ECE6] outline-none cursor-pointer ${getRoleBadge(
                                  u.role
                                )}`}
                                title="Change user's authorized role"
                              >
                                <option value="supervisor">SITE SUPERVISOR (LEVEL-01)</option>
                                <option value="store_incharge">STORE IN-CHARGE (LEVEL-02)</option>
                                <option value="auditor">PROJECT AUDITOR (CLEARANCE-A)</option>
                              </select>
                            </td>
                            <td className="py-3 px-3 text-center border-r border-[#A39B8F]/30">
                              <span className="text-[#2F6F4E] font-bold uppercase text-xs">
                                ✓ ACTIVE
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              {user?.email?.toLowerCase() !== u.email?.toLowerCase() && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u.id, u.email)}
                                  className="text-[#ba1a1a] hover:bg-[#ffdad6] px-2 py-1 border border-transparent hover:border-[#ba1a1a] font-label-code text-xs uppercase font-bold cursor-pointer transition-colors"
                                  title="Revoke user authorization"
                                >
                                  REMOVE
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Alert Action Modal with Mandatory Written Justification */}
        {actionModalAlert && (
          <div className="fixed inset-0 z-50 bg-[#101010]/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[#F2ECE6] text-[#101010] border-2 border-[#101010] max-w-lg w-full p-6 space-y-4 shadow-[6px_6px_0px_#101010]">
              <div className="flex items-center justify-between border-b-2 border-[#101010] pb-2">
                <span className="font-headline-md text-headline-md font-bold uppercase text-[#101010]">
                  {alertActionType === "resolved" ? "RESOLVE AUDIT EXCEPTION" : "ESCALATE AUDIT EXCEPTION"}
                </span>
                <button
                  type="button"
                  onClick={() => setActionModalAlert(null)}
                  className="font-bold text-xl hover:text-[#ba1a1a] cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="bg-white border border-[#101010] p-3 text-xs font-label-code text-label-code space-y-1">
                <p className="font-bold uppercase text-[#101010]">
                  ALERT #{actionModalAlert.id} // {actionModalAlert.type}
                </p>
                <p className="text-[#5F5E5E]">{actionModalAlert.explanation}</p>
              </div>

              {alertActionError && (
                <div className="p-2.5 bg-[#ffdad6] border border-[#ba1a1a] text-[#ba1a1a] font-label-code text-label-code text-xs">
                  {alertActionError}
                </div>
              )}

              <form onSubmit={handleAlertActionSubmit} className="space-y-3">
                <div>
                  <label className="font-label-meta text-label-meta uppercase text-[#504533] block mb-1 font-bold">
                    MANDATORY RECORDED JUSTIFICATION (MIN. 5 CHARACTERS)
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={alertJustification}
                    onChange={(e) => setAlertJustification(e.target.value)}
                    placeholder="State the technical rationale, site inspection basis, or supplier confirmation justifying this resolution..."
                    className="w-full bg-white border border-[#101010] p-2.5 font-label-code text-label-code text-sm outline-none resize-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setActionModalAlert(null)}
                    className="px-4 py-2 border border-[#101010] bg-transparent text-[#101010] font-label-code text-label-code uppercase font-bold cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAlertAction || alertJustification.trim().length < 5}
                    className="px-4 py-2 bg-[#FCBC18] text-[#101010] border border-[#101010] font-label-code text-label-code uppercase font-bold shadow-[2px_2px_0px_#101010] hover:bg-[#101010] hover:text-[#FCBC18] cursor-pointer disabled:opacity-50"
                  >
                    {submittingAlertAction ? "RECORDING AUDIT LOG..." : "CONFIRM & COMMIT ACTION"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AuditorHome;

