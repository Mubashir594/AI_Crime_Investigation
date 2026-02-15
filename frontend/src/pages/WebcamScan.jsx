import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import Sidebar from "../components/Sidebar";
import LiveScanPanel from "../components/LiveScanPanel";
import AlertPanel from "../components/AlertPanel";
import AiAccuracyRing from "../components/AiAccuracyRing";
import LiveScanMatchesPanel from "../components/LiveScanMatchesPanel";

const API_BASE = window.localStorage.getItem("api_base") || `http://${window.location.hostname || "localhost"}:8000`;

export default function WebcamScan() {
  const navigate = useNavigate();
  const [isWebcamOn, setIsWebcamOn] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const [matches, setMatches] = useState([]);
  const [liveAccuracy, setLiveAccuracy] = useState(0);

  const streamUrl = useMemo(
    () => `${API_BASE}/api/video-feed/?stream=${streamKey}`,
    [streamKey]
  );

  const startWebcam = async () => {
    setMatches([]);
    setLiveAccuracy(0);
    try {
      await fetch(`${API_BASE}/api/start-webcam/`, { credentials: "include" });
    } catch (_) {
      // proceed even if bind endpoint is temporarily unavailable
    }
    setStreamKey(Date.now());
    setIsWebcamOn(true);
  };

  const stopWebcam = async () => {
    setIsWebcamOn(false);
    setLiveAccuracy(0);
    try {
      await fetch(`${API_BASE}/api/stop-webcam/`, { credentials: "include" });
    } catch (_) {
      // keep UI responsive even if backend stop endpoint is unavailable
    }
  };

  const handleBack = async () => {
    await stopWebcam();
    navigate("/dashboard");
  };

  useEffect(() => {
    const timer = setInterval(async () => {
      if (!isWebcamOn) return;

      try {
        const res = await fetch(`${API_BASE}/api/live-scan/`, { credentials: "include" });
        const data = await res.json();
        setLiveAccuracy(Number(data?.confidence) || 0);
        const criminals = Array.isArray(data?.criminals)
          ? data.criminals
          : data?.criminal
            ? [data.criminal]
            : [];
        if (criminals.length === 0) return;

        setMatches((prev) => {
          const clone = [...prev];

          for (const criminal of criminals) {
            if (!criminal?.face_label) continue;

            const photo = criminal.photo
              ? criminal.photo.startsWith("http")
                ? criminal.photo
                : `${API_BASE}${criminal.photo}`
              : null;

            const nextItem = { ...criminal, photo };
            if (criminal.snapshot) {
              nextItem.snapshot = criminal.snapshot.startsWith("http")
                ? criminal.snapshot
                : criminal.snapshot.startsWith("data:")
                  ? criminal.snapshot
                  : `${API_BASE}${criminal.snapshot}`;
            }
            const idx = clone.findIndex((p) => p.face_label === criminal.face_label);

            if (idx === -1) {
              clone.unshift(nextItem);
            } else {
              clone[idx] = nextItem;
            }
          }

          return clone;
        });

      } catch (_) {
        // polling failures should not crash the live scan UI
      }
    }, 1200);

    return () => clearInterval(timer);
  }, [isWebcamOn]);

  useEffect(() => {
    return () => {
      fetch(`${API_BASE}/api/stop-webcam/`, { credentials: "include" }).catch(() => {});
    };
  }, []);

  return (
    <DashboardLayout>
      <div className="hud-menu">
        <Sidebar />
      </div>

      <div className="hud-summary">
        <div className="hud-card live-info-panel">
          <h3 className="hud-section-title">LIVE SCAN WINDOW</h3>
          <p>Control webcam stream and monitor criminal matches for this scan session.</p>
          <button className="hud-button live-control-btn" onClick={startWebcam} disabled={isWebcamOn}>
            START WEBCAM
          </button>
          <button className="hud-button live-control-btn stop-btn" onClick={stopWebcam} disabled={!isWebcamOn}>
            STOP WEBCAM
          </button>
          <button className="hud-button live-back-btn" onClick={handleBack}>
            BACK TO DASHBOARD
          </button>
        </div>
      </div>

      <div className="hud-center">
        <div className="live-stage">
          <LiveScanPanel mode="LIVE" isWebcamOn={isWebcamOn} streamUrl={streamUrl} />
        </div>
      </div>

      <div className="hud-right">
        <AiAccuracyRing accuracy={liveAccuracy} />
        <AlertPanel />
      </div>

      <div className="hud-history">
        <LiveScanMatchesPanel records={matches} />
      </div>
    </DashboardLayout>
  );
}
