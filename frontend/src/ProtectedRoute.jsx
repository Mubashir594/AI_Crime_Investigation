import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getApiBaseCandidates } from "./utils/apiBase";

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      for (const base of getApiBaseCandidates()) {
        try {
          const response = await fetch(`${base}/api/auth/check/`, {
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

    checkAuth();
  }, []);

  if (loading) {
    return <div style={{ color: "#00ff88", padding: "30px" }}>Checking access...</div>;
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
