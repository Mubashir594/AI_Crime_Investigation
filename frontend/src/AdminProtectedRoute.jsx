import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

const getApiBaseCandidates = () => {
  const host = window.location.hostname || "localhost";
  const preferred = `http://${host}:8000`;
  const fallback = ["http://localhost:8000", "http://127.0.0.1:8000"];
  const saved = window.localStorage.getItem("api_base");
  return [saved, preferred, ...fallback].filter((value, index, arr) => value && arr.indexOf(value) === index);
};

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
