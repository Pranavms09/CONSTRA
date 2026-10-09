import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ProtectedRoute, getRoleHomeRoute } from "./auth/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { LandingPage } from "./pages/LandingPage";
import { SupervisorHome } from "./pages/supervisor/SupervisorHome";
import { StoreLayout } from "./pages/store/StoreLayout";
import { StoreDashboard } from "./pages/store/StoreDashboard";
import { DeliveriesList } from "./pages/store/DeliveriesList";
import { NewDelivery } from "./pages/store/NewDelivery";
import { ChallanReview } from "./pages/store/ChallanReview";
import { IssueMaterial } from "./pages/store/IssueMaterial";
import { IssueHistory } from "./pages/store/IssueHistory";
import { StockSummary } from "./pages/store/StockSummary";
import { StoreAlerts } from "./pages/store/StoreAlerts";
import { AuditorHome } from "./pages/auditor/AuditorHome";
import { ImageAnalysisPage } from "./pages/ImageAnalysisPage";
import { NotFound } from "./pages/NotFound";

export const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/landing" element={<LandingPage />} />
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
                <StoreLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<StoreDashboard />} />
            <Route path="deliveries" element={<DeliveriesList />} />
            <Route path="deliveries/new" element={<NewDelivery />} />
            <Route path="deliveries/:id" element={<ChallanReview />} />
            <Route path="issue" element={<IssueMaterial />} />
            <Route path="issues" element={<IssueHistory />} />
            <Route path="stock" element={<StockSummary />} />
            <Route path="alerts" element={<StoreAlerts />} />
          </Route>

          <Route
            path="/auditor"
            element={
              <ProtectedRoute allowedRole="auditor">
                <AuditorHome />
              </ProtectedRoute>
            }
          />

          <Route path="/analyze" element={<ImageAnalysisPage />} />
          <Route path="/image-analysis" element={<ImageAnalysisPage />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
