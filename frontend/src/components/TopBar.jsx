import { useNavigate } from "react-router-dom";

const API_BASE = window.localStorage.getItem("api_base") || `http://${window.location.hostname || "localhost"}:8000`;

export default function TopBar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await fetch(`${API_BASE}/api/auth/logout/`, {
      method: "POST",
      credentials: "include",
    });

    navigate("/login");
  };

  return (
    <div style={topBarStyle}>
      <h1 className="hud-title">
  AI Crime Investigation System
</h1>


      <button onClick={handleLogout} style={logoutBtnStyle}>
        Logout
      </button>
    </div>
  );
}

/* ---------- Styles ---------- */

const topBarStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "15px 25px",
  borderBottom: "1px solid #0f172a",
};

const logoutBtnStyle = {
  background: "#ff3b3b",
  color: "#fff",
  border: "none",
  padding: "8px 15px",
  borderRadius: "5px",
  cursor: "pointer",
};
