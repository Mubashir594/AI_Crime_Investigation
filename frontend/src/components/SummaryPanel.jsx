import { useEffect, useState } from "react";
import { getApiBase } from "../utils/apiBase";

const API_BASE = getApiBase();

export default function SummaryPanel({
  cameraStatus = "ONLINE",
  aiModel = "FaceNet",
  sessionStatus = "RUNNING",
  facesDetected = 0,
  matchesFound = 0,
  crimesFlagged = 0,
  registeredFaces = 0,
}) {
  const [summary, setSummary] = useState({
    cameraStatus,
    aiModel,
    sessionStatus,
    facesDetected,
    matchesFound,
    crimesFlagged,
    registeredFaces,
  });

  useEffect(() => {
    let isDisposed = false;

    const loadSummary = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/dashboard/status/`, { credentials: "include" });
        const data = await res.json();

        if (isDisposed) return;

        setSummary({
          cameraStatus: data.camera_status || cameraStatus,
          aiModel: data.ai_model || aiModel,
          sessionStatus: data.session || sessionStatus,
          facesDetected: Number(data.faces_detected) || 0,
          matchesFound: Number(data.matches_found) || 0,
          crimesFlagged: Number(data.crimes_flagged) || 0,
          registeredFaces: Number(data.registered_faces) || 0,
        });
      } catch (_) {
        // Keep last values if endpoint is temporarily unavailable.
      }
    };

    loadSummary();
    const timer = setInterval(loadSummary, 4000);

    return () => {
      isDisposed = true;
      clearInterval(timer);
    };
  }, [aiModel, cameraStatus, sessionStatus]);

  return (
    <div className="hud-card summary-panel">
      <h3 className="hud-section-title">SYSTEM STATUS</h3>

      <div className="summary-section">
        <p className="summary-label">MODULE HEALTH</p>
        <p>Camera: <b>{summary.cameraStatus}</b></p>
        <p>AI Model: <b>{summary.aiModel}</b></p>
        <p>Session: <b>{summary.sessionStatus}</b></p>
      </div>

      <div className="summary-section">
        <p className="summary-label">SUMMARY</p>
        <p>Faces Detected: <b>{summary.facesDetected}</b></p>
        <p>Matches Found: <b>{summary.matchesFound}</b></p>
        <p>Crimes Flagged: <b>{summary.crimesFlagged}</b></p>
        <p>Registered Faces: <b>{summary.registeredFaces}</b></p>
      </div>
    </div>
  );
}
