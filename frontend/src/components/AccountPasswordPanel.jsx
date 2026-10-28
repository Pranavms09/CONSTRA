import React, { useEffect, useState } from "react";
import { changePassword, fetchMe } from "../api/client";

const inputCls =
  "w-full px-3 py-2 bg-[#f5f2f9] border border-[#d4c5ac] font-body-md text-body-md text-[#1b1b20] focus:outline-none focus:border-[#7a5900]";
const labelCls = "font-label-code text-label-code font-bold text-[#504533] uppercase tracking-wider";

/** Sets the email + password the CONSTRA mobile app signs in with (POST /auth/password). */
export default function AccountPasswordPanel({ email }) {
  const [hasPassword, setHasPassword] = useState(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMe()
      .then((me) => setHasPassword(!!me.has_password))
      .catch((err) => setError(err.message));
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (next.trim().length < 8) return setError("New password must be at least 8 characters.");
    if (next !== confirm) return setError("New password and confirmation do not match.");
    setSaving(true);
    try {
      await changePassword(current, next);
      setMessage(hasPassword ? "Password changed. Use it next time you sign in to the app." : "Password set. You can now sign in to the CONSTRA app with your email and this password.");
      setHasPassword(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative bg-white border border-[#d4c5ac]/50 p-6 flex flex-col gap-6">
      <div className="border-b border-[#d4c5ac]/30 pb-3">
        <h2 className="font-headline-lg text-headline-lg uppercase font-bold text-[#1b1b20]">04 // ACCOUNT &amp; APP LOGIN</h2>
        <p className="font-body-md text-body-md text-[#504533]">
          Set a password for the CONSTRA mobile app. On the app, choose email sign-in and enter{" "}
          <strong className="text-[#1b1b20]">{email || "your account email"}</strong> with this password.
        </p>
      </div>

      <form onSubmit={onSubmit} className="max-w-md flex flex-col gap-4">
        <div className="font-label-code text-label-code text-[#504533]">
          APP PASSWORD STATUS:{" "}
          <strong className={hasPassword ? "text-[#1b5e3e]" : "text-[#7a5900]"}>
            {hasPassword === null ? "CHECKING..." : hasPassword ? "SET" : "NOT SET"}
          </strong>
        </div>

        {hasPassword && (
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Current password</span>
            <input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className={labelCls}>New password (min 8 characters)</span>
          <input type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Confirm new password</span>
          <input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
        </label>

        <button
          type="submit"
          disabled={saving || hasPassword === null}
          className="self-start px-4 py-2 bg-[#fcbc18] hover:bg-[#101010] text-[#261900] hover:text-[#fcbc18] border border-[#1b1b20] font-label-code text-label-code font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-[2px_2px_0px_#101010] disabled:opacity-50"
        >
          {saving ? "SAVING..." : hasPassword ? "CHANGE PASSWORD" : "SET PASSWORD"}
        </button>

        {message && (
          <p role="status" className="p-3 bg-[#e9e7ee] border border-[#296a49] text-[#1b5e3e] font-label-code text-label-code">{message}</p>
        )}
        {error && (
          <p role="alert" className="p-3 bg-[#ffdad6] border border-[#ba1a1a] text-[#ba1a1a] font-label-code text-label-code">{error}</p>
        )}
      </form>
    </div>
  );
}
