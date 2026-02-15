import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import Sidebar from "../components/Sidebar";

const API_BASE =
  window.localStorage.getItem("api_base") ||
  `http://${window.location.hostname || "localhost"}:8000`;

const DOWNLOAD_OPTIONS = [
  { value: "pdf", label: "PDF" },
  { value: "csv", label: "CSV" },
];

export default function EvidenceReport() {
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [fileType, setFileType] = useState("pdf");

  useEffect(() => {
    let isDisposed = false;

    const loadAlerts = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const res = await fetch(`${API_BASE}/api/alerts/`, {
          credentials: "include",
        });
        const data = await res.json();
        if (isDisposed) return;
        if (!res.ok) {
          setAlerts([]);
          setErrorMessage(data?.message || "Unable to load evidence alerts.");
        } else {
          setAlerts(Array.isArray(data?.alerts) ? data.alerts : []);
        }
      } catch (_) {
        if (!isDisposed) {
          setAlerts([]);
          setErrorMessage("Unable to load evidence alerts.");
        }
      } finally {
        if (!isDisposed) setIsLoading(false);
      }
    };

    loadAlerts();
    const timer = setInterval(loadAlerts, 8000);

    return () => {
      isDisposed = true;
      clearInterval(timer);
    };
  }, []);

  const normalizedAlerts = useMemo(() => {
    return alerts.map((item) => {
      const photo = item.photo
        ? item.photo.startsWith("http")
          ? item.photo
          : `${API_BASE}${item.photo}`
        : null;

      return {
        id: item.id,
        criminalName: item.name || "Unknown",
        criminalPhoto: photo,
        matchedSnapshot: item.snapshot
          ? item.snapshot.startsWith("http")
            ? item.snapshot
            : `${API_BASE}${item.snapshot}`
          : null,
        time: item.time || "N/A",
        confidence: Number(item.confidence) || 0,
        crimeType: item.crime_type || "Unknown",
      };
    });
  }, [alerts]);

  const handleDownload = () => {
    if (fileType === "csv") {
      downloadCsv(normalizedAlerts);
      return;
    }
    downloadPdf(normalizedAlerts);
  };

  return (
    <DashboardLayout className="hud-root-criminals">
      <div className="hud-menu">
        <Sidebar />
      </div>

      <div className="hud-criminals-main">
        <div className="hud-card evidence-report-panel">
          <div className="evidence-report-header">
            <h3 className="hud-section-title">EVIDENCE REPORT</h3>
            <div className="evidence-download-controls">
              <select
                className="criminals-select"
                value={fileType}
                onChange={(e) => setFileType(e.target.value)}
              >
                {DOWNLOAD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button className="hud-button evidence-download-btn" onClick={handleDownload}>
                Download Evidence Report
              </button>
            </div>
          </div>

          {isLoading ? (
            <p className="history-empty">Loading evidence data...</p>
          ) : errorMessage ? (
            <p className="history-empty">{errorMessage}</p>
          ) : normalizedAlerts.length === 0 ? (
            <p className="history-empty">No evidence alerts available.</p>
          ) : (
            <div className="evidence-table-wrap">
              <table className="evidence-table">
                <thead>
                  <tr>
                    <th>Criminal Photo</th>
                    <th>Matched Snapshot</th>
                    <th>Criminal Name</th>
                    <th>Time</th>
                    <th>Confidence</th>
                    <th>Crime Type</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizedAlerts.map((item) => (
                    <tr key={item.id ?? item.time}>
                      <td>
                        {item.criminalPhoto ? (
                          <img className="evidence-snapshot" src={item.criminalPhoto} alt="Criminal" />
                        ) : (
                          <span className="evidence-placeholder">No Image</span>
                        )}
                      </td>
                      <td>
                        {item.matchedSnapshot ? (
                          <img className="evidence-snapshot" src={item.matchedSnapshot} alt="Matched snapshot" />
                        ) : (
                          <span className="evidence-placeholder">No Image</span>
                        )}
                      </td>
                      <td>{item.criminalName}</td>
                      <td>{item.time}</td>
                      <td>{item.confidence}%</td>
                      <td>{item.crimeType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="hud-right"></div>
    </DashboardLayout>
  );
}

function downloadCsv(rows) {
  const headers = [
    "Criminal Name",
    "Criminal Photo",
    "Matched Snapshot",
    "Time",
    "Confidence",
    "Crime Type",
  ];
  const lines = [headers.join(",")];

  rows.forEach((row) => {
    const values = [
      row.criminalName,
      row.criminalPhoto || "",
      row.matchedSnapshot || "",
      row.time,
      row.confidence,
      row.crimeType,
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`);
    lines.push(values.join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `evidence-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadPdf(rows) {
  const doc = window.open("", "_blank");
  if (!doc) return;

  const rowsHtml = rows
    .map((row) => {
      const criminalPhoto = row.criminalPhoto
        ? `<img src="${row.criminalPhoto}" alt="Criminal" />`
        : "<span>No Image</span>";
      const matchedSnapshot = row.matchedSnapshot
        ? `<img src="${row.matchedSnapshot}" alt="Matched Snapshot" />`
        : "<span>No Image</span>";
      return `
        <tr>
          <td>${criminalPhoto}</td>
          <td>${matchedSnapshot}</td>
          <td>${row.criminalName}</td>
          <td>${row.time}</td>
          <td>${row.confidence}%</td>
          <td>${row.crimeType}</td>
        </tr>
      `;
    })
    .join("");

  doc.document.write(`
    <html>
      <head>
        <title>Evidence Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #0b1a2a; }
          h1 { font-size: 20px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #c9d6e4; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #eef4fb; }
          img { width: 70px; height: 70px; object-fit: cover; border-radius: 6px; }
        </style>
      </head>
      <body>
        <h1>Evidence Report</h1>
        <table>
          <thead>
            <tr>
              <th>Criminal Photo</th>
              <th>Matched Snapshot</th>
              <th>Criminal Name</th>
              <th>Time</th>
              <th>Confidence</th>
              <th>Crime Type</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
  `);
  doc.document.close();
  doc.focus();
  doc.print();
}
