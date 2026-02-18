import { useEffect, useState } from "react";
import { getApiBase } from "../utils/apiBase";

const API_BASE = getApiBase();

export default function InvestigationActivityRadar() {
  const [activity, setActivity] = useState({
    intensity: null,
    totalScansToday: 0,
    activeInvestigations: 0,
    alertsToday: 0,
    matchesFound: 0,
  });

  useEffect(() => {
    let isDisposed = false;

    const loadActivity = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/activity-radar/`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load activity radar");
        const data = await res.json();
        if (isDisposed) return;

        setActivity({
          intensity: Number.isFinite(Number(data.intensity_percent))
            ? Number(data.intensity_percent)
            : null,
          totalScansToday: Number(data.total_scans_today) || 0,
          activeInvestigations: Number(data.active_investigations) || 0,
          alertsToday: Number(data.alerts_today) || 0,
          matchesFound: Number(data.matches_found) || 0,
        });
      } catch (_) {
        // Keep last known values if endpoint is temporarily unavailable.
      }
    };

    loadActivity();
    const timer = setInterval(loadActivity, 5000);

    return () => {
      isDisposed = true;
      clearInterval(timer);
    };
  }, []);

  const normalizedIntensity = Number.isFinite(Number(activity.intensity))
    ? Number(activity.intensity)
    : null;
  const displayIntensity =
    normalizedIntensity === null
      ? "--"
      : Math.max(0, Math.min(100, normalizedIntensity)).toFixed(0);

  return (
    <div className="hud-panel radar-panel activity-radar-panel">
      <h3 className="hud-section-title">INVESTIGATION ACTIVITY RADAR</h3>

      <div className="radar-container">
        <div className="radar-grid"></div>
        <div className="radar-sweep"></div>

        <div className="radar-center">
          <div className="radar-value">{displayIntensity}%</div>
          <div className="radar-label">Activity Intensity</div>
        </div>
      </div>

      <div className="activity-metrics">
        <div className="activity-metric">
          <span>Total Scans Today</span>
          <span>{activity.totalScansToday}</span>
        </div>
        <div className="activity-metric">
          <span>Active Investigations</span>
          <span>{activity.activeInvestigations}</span>
        </div>
        <div className="activity-metric">
          <span>Alerts Triggered Today</span>
          <span>{activity.alertsToday}</span>
        </div>
        <div className="activity-metric">
          <span>Matches Found</span>
          <span>{activity.matchesFound}</span>
        </div>
      </div>
    </div>
  );
}
