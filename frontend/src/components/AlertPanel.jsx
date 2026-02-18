import { useEffect, useRef, useState } from "react";
import { getApiBase } from "../utils/apiBase";

const ALERT_VISIBLE_MS = 5000;
const ALERT_SOUND_COOLDOWN_MS = 30000;
const ALERT_REPEAT_COOLDOWN_MS = 30000;
const API_BASE = getApiBase();

export default function AlertPanel() {
  const [alert, setAlert] = useState(null);
  const [error, setError] = useState("");
  const lastAlertId = useRef(null);
  const hasInitialized = useRef(false);
  const lastSoundPlayedAtByFace = useRef({});
  const lastShownAtByFace = useRef({});
  const audioRef = useRef(new Audio("/sounds/alert.mp3"));
  const hideTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`${API_BASE}/api/alerts/`, { credentials: "include" })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data?.message || `Alert request failed (${res.status})`);
          }
          return data;
        })
        .then(data => {
          setError("");
          const alerts = Array.isArray(data?.alerts) ? data.alerts : [];

          // Initialize once after first successful poll.
          // If list is empty, keep lastAlertId as null so the first real alert is shown.
          if (!hasInitialized.current) {
            hasInitialized.current = true;
            lastAlertId.current = alerts.length > 0 ? alerts[0].id : null;
            return;
          }

          if (alerts.length === 0) return;

          const latest = alerts[0];

          // 🔔 New alert detected
          if (lastAlertId.current !== latest.id) {
            lastAlertId.current = latest.id;
            const photo = latest.photo
              ? latest.photo.startsWith("http")
                ? latest.photo
                : `${API_BASE}${latest.photo}`
              : null;

            const faceKey = latest.face_label || `alert-${latest.id}`;
            const nowTs = Date.now();
            const lastShown = lastShownAtByFace.current[faceKey] || 0;
            if (nowTs - lastShown < ALERT_REPEAT_COOLDOWN_MS) {
              return;
            }
            lastShownAtByFace.current[faceKey] = nowTs;

            setAlert({ ...latest, photo });

            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
            hideTimerRef.current = setTimeout(() => {
              setAlert(null);
            }, ALERT_VISIBLE_MS);

            // 🔊 Play sound only once per face within cooldown window.
            const lastPlayed = lastSoundPlayedAtByFace.current[faceKey] || 0;
            if (nowTs - lastPlayed >= ALERT_SOUND_COOLDOWN_MS) {
              lastSoundPlayedAtByFace.current[faceKey] = nowTs;
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(() => {});
            }
          }
        })
        .catch((err) => {
          setError(err?.message || "Unable to load alerts.");
        });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`hud-alert hud-card ${alert ? "alert-active" : ""}`}>
      <h3 className="hud-section-title">ALERT PANEL</h3>
      {error ? (
        <p className="alert-placeholder">{error}</p>
      ) : alert ? (
        <>
          {alert.photo ? (
            <div className="alert-photo-wrap">
              <img src={alert.photo} alt={alert.name || "Detected criminal"} className="alert-photo" />
            </div>
          ) : null}
          <p><b>{alert.message}</b></p>
          {alert.name ? <p>Name: {alert.name}</p> : null}
          {alert.face_label ? <p>Face Label: {alert.face_label}</p> : null}
          <p>Crime: {alert.crime_type}</p>
          <p>Risk Level: {alert.risk_level}</p>
          <p>Confidence: {alert.confidence}%</p>
          <p>Time: {alert.time}</p>
        </>
      ) : (
        <p className="alert-placeholder">No active alerts. Monitoring all feeds.</p>
      )}
    </div>
  );
}
