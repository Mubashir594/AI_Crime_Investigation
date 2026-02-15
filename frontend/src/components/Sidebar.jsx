import {
  FaBrain,
  FaCamera,
  FaUpload,
  FaDatabase,
  FaBell,
  FaFileDownload,
  FaSignOutAlt
} from "react-icons/fa";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_BASE = window.localStorage.getItem("api_base") || `http://${window.location.hostname || "localhost"}:8000`;

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isNotificationsOpen) return;

    const loadNotifications = () => {
      fetch(`${API_BASE}/api/alerts/`, { credentials: "include" })
        .then((res) => res.json())
        .then((data) => setNotifications(data.alerts || []))
        .catch(() => {});
    };

    loadNotifications();
    const timer = setInterval(loadNotifications, 4000);

    return () => clearInterval(timer);
  }, [isNotificationsOpen]);

  useEffect(() => {
    const onMouseDown = (event) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout/`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Redirect regardless of network errors to avoid blocking logout flow.
    }
    navigate("/login");
  };

  return (
    <div className="hud-sidebar-shell" ref={containerRef}>
      <div className="hud-sidebar">
        <button
          className={`hud-sidebar-item ${location.pathname === "/dashboard" || location.pathname === "/" ? "hud-sidebar-item-active" : ""}`}
          onClick={() => navigate("/dashboard")}
          aria-label="Dashboard"
        >
          <FaBrain />
        </button>
        <button
          className={`hud-sidebar-item ${location.pathname === "/webcam" ? "hud-sidebar-item-active" : ""}`}
          onClick={() => navigate("/webcam")}
          aria-label="Live Scan"
        >
          <FaCamera />
        </button>
        <button
          className={`hud-sidebar-item ${location.pathname === "/upload" ? "hud-sidebar-item-active" : ""}`}
          onClick={() => navigate("/upload")}
          aria-label="Upload"
        >
          <FaUpload />
        </button>
        <button
          className={`hud-sidebar-item ${location.pathname === "/database" ? "hud-sidebar-item-active" : ""}`}
          onClick={() => navigate("/database")}
          aria-label="Criminal Database"
        >
          <FaDatabase />
        </button>
        <button
          className={`hud-sidebar-item ${location.pathname === "/evidence-report" ? "hud-sidebar-item-active" : ""}`}
          onClick={() => navigate("/evidence-report")}
          aria-label="Evidence Report"
        >
          <FaFileDownload />
        </button>
        <button
          className={`hud-sidebar-item ${isNotificationsOpen ? "hud-sidebar-item-active" : ""}`}
          onClick={() => setIsNotificationsOpen((prev) => !prev)}
          aria-label="Notifications"
        >
          <FaBell />
        </button>
        <button className="hud-sidebar-item" onClick={handleLogout} aria-label="Logout">
          <FaSignOutAlt />
        </button>
      </div>

      {isNotificationsOpen ? (
        <div className="hud-notifications-panel hud-card">
          <h3 className="hud-section-title">NOTIFICATIONS</h3>

          {notifications.length === 0 ? (
            <p className="history-empty">No notifications available.</p>
          ) : (
            <div className="hud-notifications-list">
              {notifications.map((item) => (
                <div className="hud-notification-item" key={item.id}>
                  <p><b>{item.message}</b></p>
                  <p>Name: {item.name || "Unknown"}</p>
                  <p>Crime: {item.crime_type}</p>
                  <p>Risk: {item.risk_level}</p>
                  <p>Confidence: {item.confidence}%</p>
                  <p>Time: {item.time}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
