import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiBaseCandidates } from "../utils/apiBase";
import "../styles/login.css";

export default function Login() {
  const navigate = useNavigate();
  const [moduleType, setModuleType] = useState("investigator");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginAgainstAnyBackend = async (path, payload) => {
    let lastError = "Unable to reach server. Please try again.";
    for (const base of getApiBaseCandidates()) {
      try {
        const response = await fetch(`${base}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        return { data, base };
      } catch {
        lastError = `Unable to reach ${base}`;
      }
    }
    return { data: { success: false, message: lastError }, base: null };
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const endpoint =
        moduleType === "admin"
          ? "/api/admin/auth/login/"
          : "/api/auth/login/";
      const { data, base } = await loginAgainstAnyBackend(endpoint, { username, password });

      if (data.success) {
        if (base) window.localStorage.setItem("api_base", base);
        navigate(moduleType === "admin" ? "/admin/dashboard" : "/dashboard");
      } else {
        setError(data.message || "Login failed");
      }
    } catch {
      setError("Unable to reach server. Please try again.");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-visual" aria-hidden="true">
          <p className="auth-kicker">AI INVESTIGATION SYSTEM</p>

          <div className="face-scanner">
            <div className="scanner-wireframe">
              <svg viewBox="0 0 600 760" className="wireframe-svg" role="img" aria-label="Graphic face scanning animation">
                <g stroke="rgba(80,235,255,0.95)" fill="none" strokeWidth="1.6">
                  <ellipse cx="300" cy="275" rx="150" ry="206" />
                  <ellipse cx="300" cy="275" rx="128" ry="186" />
                  <ellipse cx="300" cy="275" rx="104" ry="164" />
                  <ellipse cx="300" cy="275" rx="82" ry="140" />
                  <path d="M300 70 Q238 96 210 162 Q188 216 188 282 Q188 365 224 430 Q255 488 300 526" />
                  <path d="M300 70 Q362 96 390 162 Q412 216 412 282 Q412 365 376 430 Q345 488 300 526" />
                  <path d="M300 76 L300 530" />
                  <path d="M248 212 Q300 192 352 212" />
                  <path d="M232 248 Q300 228 368 248" />
                  <path d="M220 292 Q300 278 380 292" />
                  <path d="M228 338 Q300 326 372 338" />
                  <path d="M240 384 Q300 374 360 384" />
                  <path d="M258 432 Q300 426 342 432" />
                  <path d="M206 278 Q238 252 275 267" />
                  <path d="M394 278 Q362 252 325 267" />
                  <path d="M270 352 Q300 374 330 352" />
                  <path d="M146 545 Q300 672 454 545" />
                  <ellipse cx="300" cy="660" rx="196" ry="58" />
                  <ellipse cx="300" cy="648" rx="172" ry="42" />
                  <ellipse cx="300" cy="636" rx="146" ry="30" />
                </g>
              </svg>
            </div>
            <div className="scanner-photo-tint" />
            <div className="portrait-divider" />
            <div className="mesh-overlay" />
            <span className="mesh-point mesh-point-1" />
            <span className="mesh-point mesh-point-2" />
            <span className="mesh-point mesh-point-3" />
            <span className="mesh-point mesh-point-4" />
            <span className="mesh-point mesh-point-5" />
            <span className="mesh-point mesh-point-6" />
            <span className="mesh-point mesh-point-7" />
            <div className="scanner-grid" />
            <div className="scanner-line" />
          </div>
        </section>

        <form className="auth-form" onSubmit={handleLogin}>
          <p className="auth-form-kicker">Secure Entry</p>
          <h2 className="auth-form-title">
            {moduleType === "admin" ? "Admin Login" : "Investigator Login"}
          </h2>

          <div className="auth-role-toggle" role="tablist" aria-label="Select module">
            <button
              type="button"
              role="tab"
              aria-selected={moduleType === "investigator"}
              className={`auth-role-btn ${moduleType === "investigator" ? "auth-role-btn-active" : ""}`}
              onClick={() => {
                setModuleType("investigator");
                setError("");
              }}
            >
              Investigator Module
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={moduleType === "admin"}
              className={`auth-role-btn ${moduleType === "admin" ? "auth-role-btn-active" : ""}`}
              onClick={() => {
                setModuleType("admin");
                setError("");
              }}
            >
              Admin Module
            </button>
          </div>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <label className="auth-label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            type="text"
            placeholder={moduleType === "admin" ? "Enter admin username" : "Enter investigator ID"}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="auth-input"
            required
          />

          <label className="auth-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            placeholder={moduleType === "admin" ? "Enter admin password" : "Enter access key"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            required
          />

          <button type="submit" className="auth-button">
            {moduleType === "admin" ? "Open Admin Dashboard" : "Access Dashboard"}
          </button>

          <p className="auth-hint">
            Authorized personnel only. All login attempts are monitored and logged.
          </p>
        </form>
      </div>
    </div>
  );
}
