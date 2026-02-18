import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiBaseCandidates } from "../utils/apiBase";
import "../styles/admin-module.css";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const adminLogin = async (payload) => {
    for (const base of getApiBaseCandidates()) {
      try {
        const response = await fetch(`${base}/api/admin/auth/login/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (data.success) {
          window.localStorage.setItem("api_base", base);
          return { ok: true, data };
        }
        return { ok: false, data };
      } catch {
        // try next base
      }
    }

    return { ok: false, data: { message: "Unable to reach server. Please try again." } };
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const result = await adminLogin({ username, password });
      if (!result.ok) {
        setError(result.data?.message || "Admin login failed");
        return;
      }

      navigate("/admin/dashboard");
    } catch {
      setError("Unable to reach server. Please try again.");
    }
  };

  return (
    <div className="admin-auth-page">
      <form className="admin-auth-card" onSubmit={handleLogin}>
        <p className="admin-eyebrow">ADMIN ACCESS</p>
        <h1 className="admin-auth-title">Crime Admin Control</h1>

        {error ? (
          <p className="admin-error" role="alert">
            {error}
          </p>
        ) : null}

        <label className="admin-label" htmlFor="admin-username">
          Username
        </label>
        <input
          id="admin-username"
          className="admin-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter admin username"
          required
        />

        <label className="admin-label" htmlFor="admin-password">
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          className="admin-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter admin password"
          required
        />

        <button type="submit" className="admin-btn admin-btn-primary">
          Open Admin Dashboard
        </button>

        <button
          type="button"
          className="admin-btn admin-btn-ghost"
          onClick={() => navigate("/login")}
        >
          Go To Investigator Login
        </button>
      </form>
    </div>
  );
}
