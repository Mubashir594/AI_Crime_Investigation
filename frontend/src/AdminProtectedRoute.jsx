import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getApiBaseCandidates } from "./utils/apiBase";

export default function AdminProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const checkAdminAuth = async () => {
      for (const base of getApiBaseCandidates()) {
        try {
          const response = await fetch(`${base}/api/admin/auth/check/`, {
            credentials: "include",
          });
          const data = await response.json();
          if (data.authenticated) {
            window.localStorage.setItem("api_base", base);
            setAuthenticated(true);
            setLoading(false);
            return;
          }
        } catch {
          // try next base
        }
      }

      setAuthenticated(false);
      setLoading(false);
    };

    checkAdminAuth();
  }, []);

  if (loading) {
    return <div style={{ color: "#9ae6ff", padding: "30px" }}>Checking admin access...</div>;
  }

  if (!authenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}
