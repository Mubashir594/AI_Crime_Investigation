import { useEffect, useMemo, useState } from "react";
import { getApiBase } from "../utils/apiBase";

const API_BASE = getApiBase();

export default function DetectionAnalyticsMiniGraph() {
  const [analytics, setAnalytics] = useState({
    detectionsToday: 0,
    weeklyTrend: [],
    crimesByType: [],
    scanActivity: [],
  });

  useEffect(() => {
    let isDisposed = false;

    const loadAnalytics = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/detection-analytics/`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load detection analytics");
        const data = await res.json();
        if (isDisposed) return;

        setAnalytics({
          detectionsToday: Number(data.detections_today) || 0,
          weeklyTrend: Array.isArray(data.weekly_trend) ? data.weekly_trend : [],
          crimesByType: Array.isArray(data.crimes_by_type) ? data.crimes_by_type : [],
          scanActivity: Array.isArray(data.scan_activity) ? data.scan_activity : [],
        });
      } catch (_) {
        // Keep last known data if endpoint is temporarily unavailable.
      }
    };

    loadAnalytics();
    const timer = setInterval(loadAnalytics, 8000);

    return () => {
      isDisposed = true;
      clearInterval(timer);
    };
  }, []);

  const weeklyMax = useMemo(() => {
    return Math.max(1, ...analytics.weeklyTrend.map((item) => Number(item.detections) || 0));
  }, [analytics.weeklyTrend]);

  const crimesMax = useMemo(() => {
    return Math.max(1, ...analytics.crimesByType.map((item) => Number(item.count) || 0));
  }, [analytics.crimesByType]);

  const scanMax = useMemo(() => {
    return Math.max(1, ...analytics.scanActivity.map((item) => Number(item.scans) || 0));
  }, [analytics.scanActivity]);

  const scanPoints = useMemo(() => {
    if (!analytics.scanActivity.length) return "";
    const step = 100 / Math.max(analytics.scanActivity.length - 1, 1);
    return analytics.scanActivity
      .map((item, index) => {
        const value = Number(item.scans) || 0;
        const x = (index * step).toFixed(2);
        const y = (100 - (value / scanMax) * 100).toFixed(2);
        return `${x},${y}`;
      })
      .join(" ");
  }, [analytics.scanActivity, scanMax]);

  return (
    <div className="hud-panel detection-analytics-panel">
      <h3 className="hud-section-title">DETECTION ANALYTICS</h3>

      <div className="analytics-top">
        <div className="analytics-kpi">
          <span className="analytics-kpi-label">Detections Today</span>
          <span className="analytics-kpi-value">{analytics.detectionsToday}</span>
        </div>

        <div className="weekly-trend">
          {analytics.weeklyTrend.map((item) => {
            const value = Number(item.detections) || 0;
            const height = Math.round((value / weeklyMax) * 100);
            const label = typeof item.date === "string" ? item.date.slice(5) : "";
            return (
              <div className="weekly-bar" key={item.date || label}>
                <div className="weekly-bar-fill" style={{ height: `${height}%` }} />
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="analytics-bottom">
        <div className="crimes-by-type">
          <div className="analytics-subtitle">Crimes By Type</div>
          <div className="crime-bars">
            {analytics.crimesByType.map((item) => {
              const value = Number(item.count) || 0;
              const width = Math.round((value / crimesMax) * 100);
              return (
                <div className="crime-bar-row" key={item.crime_type}>
                  <span>{item.crime_type}</span>
                  <div className="crime-bar-track">
                    <div className="crime-bar-fill" style={{ width: `${width}%` }} />
                  </div>
                  <span className="crime-bar-count">{value}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="scan-activity">
          <div className="analytics-subtitle">Scan Activity</div>
          <div className="scan-chart">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline points={scanPoints} />
            </svg>
            <div className="scan-labels">
              {analytics.scanActivity.map((item) => (
                <span key={item.time}>{item.time}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
