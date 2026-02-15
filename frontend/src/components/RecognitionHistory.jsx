import { useEffect, useState } from "react";

const API_BASE = window.localStorage.getItem("api_base") || `http://${window.location.hostname || "localhost"}:8000`;

export default function RecognitionHistory() {
  const [records, setRecords] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let isDisposed = false;

    const loadHistory = () => {
      fetch(`${API_BASE}/api/logs/`, { credentials: "include" })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data?.message || `History request failed (${res.status})`);
          }
          return data;
        })
        .then(data => {
          if (isDisposed) return;
          setError("");
          setRecords(data.records || []);
        })
        .catch((err) => {
          if (isDisposed) return;
          setError(err?.message || "Unable to load recognition history.");
          setRecords([]);
        });
    };

    loadHistory();
    const interval = setInterval(loadHistory, 2000);

    return () => {
      isDisposed = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="hud-card history-panel">
      <h3 className="hud-section-title">RECOGNITION HISTORY</h3>

      {error ? (
        <p className="history-empty">{error}</p>
      ) : records.length === 0 ? (
        <p className="history-empty">No recognition history yet.</p>
      ) : (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Face Label</th>
              <th>Crime Type</th>
              <th>Age/Gender</th>
              <th>Address</th>
              <th>Confidence</th>
              <th>Detected At</th>
            </tr>
            </thead>
            <tbody>
            {records.map((r, i) => (
              <tr key={r.id ?? i}>
                <td>{r.id ?? "-"}</td>
                <td>{r.name}</td>
                <td>{r.face_label}</td>
                <td>{r.crime_type || "-"}</td>
                <td>{r.age ?? "-"} / {r.gender || "-"}</td>
                <td>{r.address || "-"}</td>
                <td>{r.confidence}%</td>
                <td>{r.detected_at || r.time}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
