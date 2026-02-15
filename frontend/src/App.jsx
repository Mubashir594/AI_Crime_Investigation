import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import WebcamScan from "./pages/WebcamScan";
import VideoUpload from "./pages/VideoUpload";
import Login from "./pages/Login";
import CriminalDatabase from "./pages/CriminalDatabase";
import EvidenceReport from "./pages/EvidenceReport";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "./ProtectedRoute";
import AdminProtectedRoute from "./AdminProtectedRoute";
import "./styles/hud.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* 🔐 Login */}
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<Login />} />

        {/* 🔒 Protected Investigator Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/webcam"
          element={
            <ProtectedRoute>
              <WebcamScan />
            </ProtectedRoute>
          }
        />

        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <VideoUpload />
            </ProtectedRoute>
          }
        />

        <Route
          path="/database"
          element={
            <ProtectedRoute>
              <CriminalDatabase />
            </ProtectedRoute>
          }
        />
        <Route
          path="/evidence-report"
          element={
            <ProtectedRoute>
              <EvidenceReport />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}
