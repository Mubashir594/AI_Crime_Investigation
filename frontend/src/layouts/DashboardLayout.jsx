import { useEffect, useRef, useState } from "react";
import { FaUserCircle } from "react-icons/fa";
import { getApiBase } from "../utils/apiBase";
import "../styles/hud.css";

export default function DashboardLayout({ children, className = "" }) {
  const [now, setNow] = useState(new Date());
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const profileRef = useRef(null);
  const apiBase = getApiBase();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch(`${apiBase}/api/auth/profile/`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        const data = await response.json();
        if (response.ok && data.success) {
          setProfile(data.profile);
          setProfileError("");
          return;
        }
        setProfileError(data.message || "Unable to load profile.");
      } catch {
        setProfileError("Unable to load profile.");
      }
    };
    loadProfile();
  }, [apiBase]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!profileRef.current) return;
      if (!profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div className={`hud-root ${className}`.trim()}>
      <header className="hud-top">
        <div className="hud-profile-slot" ref={profileRef}>
          <button
            type="button"
            className="hud-profile-btn"
            aria-label="Investigator profile"
            onClick={() => setProfileOpen((prev) => !prev)}
          >
            <FaUserCircle />
          </button>
          {profileOpen ? (
            <div className="hud-profile-card">
              {profile ? (
                <>
                  <h3>{profile.full_name}</h3>
                  <p><strong>Username:</strong> {profile.username}</p>
                  <p><strong>Badge ID:</strong> {profile.badge_id}</p>
                  <p><strong>Department:</strong> {profile.department}</p>
                  <p><strong>Status:</strong> {profile.is_active ? "Active" : "Inactive"}</p>
                </>
              ) : (
                <p>{profileError || "Loading profile..."}</p>
              )}
            </div>
          ) : null}
        </div>
        <div className="hud-main-title">AI INVESTIGATION SYSTEM</div>
        <div className="hud-datetime">{now.toLocaleString()}</div>
      </header>
      {children}
    </div>
  );
}
