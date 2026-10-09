import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ProtectedRoute, getRoleHomeRoute } from "./auth/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { SupervisorHome } from "./pages/supervisor/SupervisorHome";
import { StoreHome } from "./pages/store/StoreHome";
import { AuditorHome } from "./pages/auditor/AuditorHome";
import { NotFound } from "./pages/NotFound";

const RootRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getRoleHomeRoute(user.role)} replace />;
};

export const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          
          <Route
            path="/supervisor"
            element={
              <ProtectedRoute allowedRole="supervisor">
                <SupervisorHome />
              </ProtectedRoute>
            }
          />

          <Route
            path="/store"
            element={
              <ProtectedRoute allowedRole="store_incharge">
                <StoreHome />
              </ProtectedRoute>
            }
          />

          <Route
            path="/auditor"
            element={
              <ProtectedRoute allowedRole="auditor">
                <AuditorHome />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
