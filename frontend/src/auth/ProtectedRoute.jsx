import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function getRoleHomeRoute(role) {
  switch (role) {
    case "supervisor":
      return "/supervisor";
    case "store_incharge":
      return "/store";
    case "auditor":
      return "/auditor";
    default:
      return "/login";
  }
}

export const ProtectedRoute = ({ allowedRole, children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-medium">Verifying authorization...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== allowedRole) {
    // Redirect to user's assigned role dashboard
    return <Navigate to={getRoleHomeRoute(user.role)} replace />;
  }

  return <>{children}</>;
};
