import { useEffect, useMemo, useState } from "react";
import {
  FaUserSecret,
  FaFileAlt,
  FaUserShield,
  FaChartLine,
  FaFileDownload,
  FaPlus,
  FaEdit,
  FaSignOutAlt,
} from "react-icons/fa";
import "../styles/admin-module.css";

const getApiBaseCandidates = () => {
  const host = window.location.hostname || "localhost";
  const preferred = `http://${host}:8000`;
  const fallback = ["http://localhost:8000", "http://127.0.0.1:8000"];
  const saved = window.localStorage.getItem("api_base");
  return [saved, preferred, ...fallback].filter((value, index, arr) => value && arr.indexOf(value) === index);
};

async function resolveApiBase() {
  for (const base of getApiBaseCandidates()) {
    try {
      const response = await fetch(`${base}/api/test/`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (response.ok) return base;
    } catch {
      // continue trying next base
    }
  }
  return getApiBaseCandidates()[0];
}

const adminSections = [
  { key: "criminals", label: "Criminals", icon: FaUserSecret },
  { key: "records", label: "Crime Records", icon: FaFileAlt },
  { key: "investigators", label: "Investigators", icon: FaUserShield },
  { key: "monitor", label: "Monitoring", icon: FaChartLine },
  { key: "reports", label: "Evidence Reports", icon: FaFileDownload },
];

const quickLinks = {
  criminals: [
    { text: "Add Criminal", action: "add", icon: FaPlus },
    { text: "Edit Criminals", action: "edit", icon: FaEdit },
  ],
  records: [
    { text: "Add Crime Record", action: "add", icon: FaPlus },
    { text: "Edit Crime Records", action: "edit", icon: FaEdit },
  ],
  monitor: [],
};

const emptyForm = {
  full_name: "",
  username: "",
  password: "",
  badge_id: "",
  department: "",
  is_active: true,
};

const emptyCriminalForm = {
  name: "",
  face_label: "",
  age: "",
  gender: "",
  address: "",
  crime_type: "",
  photo: null,
  dataset_photos: [],
};

const emptyCrimeRecordForm = {
  criminal_id: "",
  crime_type: "",
  crime_date: "",
  crime_location: "",
  description: "",
};

export default function AdminDashboard() {
  const [apiBase, setApiBase] = useState(getApiBaseCandidates()[0]);
  const [apiReady, setApiReady] = useState(false);
  const [activeSection, setActiveSection] = useState("criminals");
  const [summary, setSummary] = useState(null);
  const [investigators, setInvestigators] = useState([]);
  const [criminals, setCriminals] = useState([]);
  const [crimeRecords, setCrimeRecords] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedInvestigatorId, setSelectedInvestigatorId] = useState(null);
  const [selectedCriminalId, setSelectedCriminalId] = useState(null);
  const [criminalMode, setCriminalMode] = useState("view");
  const [recordMode, setRecordMode] = useState("view");
  const [criminalForm, setCriminalForm] = useState(emptyCriminalForm);
  const [criminalEditForm, setCriminalEditForm] = useState(emptyCriminalForm);
  const [crimeRecordForm, setCrimeRecordForm] = useState(emptyCrimeRecordForm);
  const [crimeRecordEditForm, setCrimeRecordEditForm] = useState(emptyCrimeRecordForm);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [selectedRecordCriminalId, setSelectedRecordCriminalId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [embeddedAdminUrl, setEmbeddedAdminUrl] = useState("");
  const [embeddedAdminTitle, setEmbeddedAdminTitle] = useState("");
  const [message, setMessage] = useState("");
  const [scanLogs, setScanLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [monitorInvestigatorFilter, setMonitorInvestigatorFilter] = useState("ALL");
  const [reportInvestigatorId, setReportInvestigatorId] = useState("ALL");
  const [reportFileType, setReportFileType] = useState("pdf");
  const [recordSwitchPrompt, setRecordSwitchPrompt] = useState({ open: false, nextCriminalId: null });
  const [recordModalOpen, setRecordModalOpen] = useState(null);

  const selectedInvestigator = useMemo(
    () => investigators.find((inv) => inv.id === selectedInvestigatorId) || null,
    [investigators, selectedInvestigatorId]
  );

  const selectedCriminal = useMemo(
    () => criminals.find((criminal) => criminal.id === selectedCriminalId) || null,
    [criminals, selectedCriminalId]
  );

  const selectedRecord = useMemo(
    () => crimeRecords.find((record) => record.id === selectedRecordId) || null,
    [crimeRecords, selectedRecordId]
  );

  const recordsByCriminal = useMemo(() => {
    const grouped = new Map();
    crimeRecords.forEach((record) => {
      const key = record.criminal_id;
      if (!grouped.has(key)) {
        grouped.set(key, {
          criminal_id: key,
          criminal_name: record.criminal_name || "Unknown",
          records: [],
        });
      }
      grouped.get(key).records.push(record);
    });
    return Array.from(grouped.values()).map((item) => ({
      ...item,
      records: item.records.sort((a, b) => String(b.crime_date || "").localeCompare(String(a.crime_date || ""))),
    }));
  }, [crimeRecords]);

  const selectedCriminalRecords = useMemo(() => {
    if (!selectedRecordCriminalId) return [];
    const found = recordsByCriminal.find((item) => item.criminal_id === selectedRecordCriminalId);
    return found?.records || [];
  }, [recordsByCriminal, selectedRecordCriminalId]);

  const isRecordEditDirty = useMemo(() => {
    if (!selectedRecord) return false;
    return (
      String(crimeRecordEditForm.criminal_id || "") !== String(selectedRecord.criminal_id || "") ||
      String(crimeRecordEditForm.crime_type || "").trim() !== String(selectedRecord.crime_type || "").trim() ||
      String(crimeRecordEditForm.crime_date || "") !== String(selectedRecord.crime_date || "") ||
      String(crimeRecordEditForm.crime_location || "").trim() !== String(selectedRecord.crime_location || "").trim() ||
      String(crimeRecordEditForm.description || "").trim() !== String(selectedRecord.description || "").trim()
    );
  }, [crimeRecordEditForm, selectedRecord]);

  const investigatorOptions = useMemo(() => {
    const names = new Map();
    scanLogs.forEach((log) => {
      if (log.investigator_id && log.investigator_name) {
        names.set(String(log.investigator_id), log.investigator_name);
      }
    });
    alerts.forEach((alert) => {
      if (alert.investigator_id && alert.investigator_name) {
        names.set(String(alert.investigator_id), alert.investigator_name);
      }
    });
    return Array.from(names.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [scanLogs, alerts]);

  const monitorStats = useMemo(() => {
    const statsMap = new Map();
    const ensure = (name) => {
      const key = name || "";
      if (!key || key === "Unknown") return null;
      if (!statsMap.has(key)) {
        statsMap.set(key, {
          investigator_name: key,
          scans: 0,
          matches: 0,
          alerts: 0,
        });
      }
      return statsMap.get(key);
    };

    scanLogs.forEach((log) => {
      const row = ensure(log.investigator_name);
      if (!row) return;
      row.scans += 1;
      if ((Number(log.confidence) || 0) > 0 && log.name && log.name !== "Unknown") {
        row.matches += 1;
      }
    });

    alerts.forEach((alert) => {
      const row = ensure(alert.investigator_name);
      if (!row) return;
      row.alerts += 1;
    });

    const rows = Array.from(statsMap.values());
    if (monitorInvestigatorFilter !== "ALL") {
      return rows.filter((row) => row.investigator_name === monitorInvestigatorFilter);
    }
    return rows;
  }, [scanLogs, alerts, monitorInvestigatorFilter]);

  const filteredScanLogs = useMemo(() => {
    const knownLogs = scanLogs.filter((log) => log.investigator_name && log.investigator_name !== "Unknown");
    if (monitorInvestigatorFilter === "ALL") return knownLogs;
    return knownLogs.filter((log) => log.investigator_name === monitorInvestigatorFilter);
  }, [scanLogs, monitorInvestigatorFilter]);

  const filteredAlerts = useMemo(() => {
    const knownAlerts = alerts.filter((alert) => alert.investigator_name && alert.investigator_name !== "Unknown");
    if (monitorInvestigatorFilter === "ALL") return knownAlerts;
    return knownAlerts.filter((alert) => alert.investigator_name === monitorInvestigatorFilter);
  }, [alerts, monitorInvestigatorFilter]);

  const reportAlerts = useMemo(() => {
    const filtered = reportInvestigatorId === "ALL"
      ? alerts
      : alerts.filter((alert) => String(alert.investigator_id || "") === String(reportInvestigatorId));

    return filtered.map((item) => {
      const criminalPhoto = item.photo
        ? item.photo.startsWith("http")
          ? item.photo
          : `${apiBase}${item.photo}`
        : null;
      const matchedSnapshot = item.snapshot
        ? item.snapshot.startsWith("http")
          ? item.snapshot
          : `${apiBase}${item.snapshot}`
        : null;
      return {
        id: item.id,
        investigatorId: item.investigator_id,
        investigatorName: item.investigator_name || "Unknown",
        criminalName: item.name || "Unknown",
        criminalPhoto,
        matchedSnapshot,
        time: item.time || "N/A",
        confidence: Number(item.confidence) || 0,
        crimeType: item.crime_type || "Unknown",
      };
    });
  }, [alerts, apiBase, reportInvestigatorId]);

  const apiFetch = async (path, options = {}) => {
    const mergedOptions = {
      credentials: "include",
      ...options,
    };

    if (apiBase) {
      const primary = await fetch(`${apiBase}${path}`, mergedOptions);
      if (primary.status !== 404) return primary;
    }

    for (const base of getApiBaseCandidates()) {
      if (base === apiBase) continue;
      try {
        const response = await fetch(`${base}${path}`, mergedOptions);
        if (response.ok) {
          window.localStorage.setItem("api_base", base);
          setApiBase(base);
          return response;
        }
      } catch {
        // continue
      }
    }

    const fallbackBase = getApiBaseCandidates()[0];
    return fetch(`${fallbackBase}${path}`, mergedOptions);
  };

  const loadDashboardData = async () => {
    const [summaryRes, invRes, criminalsRes, recordsRes, logsRes, alertsRes] = await Promise.all([
      apiFetch("/api/admin/summary/"),
      apiFetch("/api/admin/investigators/"),
      apiFetch("/api/admin/criminals/"),
      apiFetch("/api/admin/crime-records/"),
      apiFetch("/api/logs/"),
      apiFetch("/api/alerts/"),
    ]);
    const summaryData = await summaryRes.json();
    const invData = await invRes.json();
    const criminalsData = await criminalsRes.json();
    const recordsData = await recordsRes.json();
    const logsData = await logsRes.json();
    const alertsData = await alertsRes.json();
    if (summaryRes.status === 401 || invRes.status === 401 || criminalsRes.status === 401 || recordsRes.status === 401 || logsRes.status === 401 || alertsRes.status === 401) {
      window.location.href = "/admin/login";
      return;
    }
    if (summaryData.success) setSummary(summaryData.summary);
    if (invData.success) setInvestigators(invData.investigators);
    if (criminalsData.success && criminalsData.criminals) setCriminals(criminalsData.criminals);
    if (recordsData.success && recordsData.records) setCrimeRecords(recordsData.records);
    if (Array.isArray(logsData.records)) setScanLogs(logsData.records);
    if (Array.isArray(alertsData.alerts)) setAlerts(alertsData.alerts);
    else if (!criminalsData.success) setMessage(criminalsData.message || "Unable to load criminal list.");
  };

  useEffect(() => {
    const bootstrap = async () => {
      const resolvedBase = await resolveApiBase();
      window.localStorage.setItem("api_base", resolvedBase);
      setApiBase(resolvedBase);
      setApiReady(true);
    };

    bootstrap().catch(() => {
      setApiReady(true);
      setMessage("Failed to connect to backend.");
    });
  }, []);

  useEffect(() => {
    if (!apiReady) return;
    loadDashboardData().catch(() => setMessage("Failed to load admin data."));
  }, [apiReady]);

  useEffect(() => {
    if (!selectedInvestigator) {
      setEditForm(null);
      return;
    }
    setEditForm({
      full_name: selectedInvestigator.full_name,
      username: selectedInvestigator.username,
      badge_id: selectedInvestigator.badge_id,
      department: selectedInvestigator.department,
      password: "",
    });
  }, [selectedInvestigator]);

  useEffect(() => {
    if (!criminals.length) {
      setSelectedCriminalId(null);
      return;
    }

    const exists = criminals.some((criminal) => criminal.id === selectedCriminalId);
    if (!exists) {
      setSelectedCriminalId(criminals[0].id);
    }
  }, [criminals, selectedCriminalId]);

  useEffect(() => {
    if (!crimeRecords.length) {
      setSelectedRecordId(null);
      setSelectedRecordCriminalId(null);
      return;
    }
    const exists = crimeRecords.some((record) => record.id === selectedRecordId);
    if (!exists) {
      setSelectedRecordId(crimeRecords[0].id);
      setSelectedRecordCriminalId(crimeRecords[0].criminal_id);
    }
  }, [crimeRecords, selectedRecordId]);

  useEffect(() => {
    if (selectedRecord && selectedRecord.criminal_id !== selectedRecordCriminalId) {
      setSelectedRecordCriminalId(selectedRecord.criminal_id);
    }
  }, [selectedRecord, selectedRecordCriminalId]);

  useEffect(() => {
    if (!selectedRecordCriminalId) return;
    const inCurrentCriminal = crimeRecords.some(
      (record) => record.id === selectedRecordId && record.criminal_id === selectedRecordCriminalId
    );
    if (!inCurrentCriminal) {
      const first = crimeRecords.find((record) => record.criminal_id === selectedRecordCriminalId);
      if (first) setSelectedRecordId(first.id);
    }
  }, [selectedRecordCriminalId, selectedRecordId, crimeRecords]);

  useEffect(() => {
    if (!selectedCriminal) {
      setCriminalEditForm(emptyCriminalForm);
      return;
    }

    setCriminalEditForm({
      name: selectedCriminal.name || "",
      face_label: selectedCriminal.face_label || "",
      age: selectedCriminal.age?.toString() || "",
      gender: selectedCriminal.gender || "",
      address: selectedCriminal.address || "",
      crime_type: selectedCriminal.crime_type || "",
      photo: null,
      dataset_photos: [],
    });
  }, [selectedCriminal]);

  useEffect(() => {
    if (!selectedRecord) {
      setCrimeRecordEditForm(emptyCrimeRecordForm);
      return;
    }
    setCrimeRecordEditForm({
      criminal_id: selectedRecord.criminal_id?.toString() || "",
      crime_type: selectedRecord.crime_type || "",
      crime_date: selectedRecord.crime_date || "",
      crime_location: selectedRecord.crime_location || "",
      description: selectedRecord.description || "",
    });
  }, [selectedRecord]);

  const logoutAdmin = async () => {
    await apiFetch("/api/admin/auth/logout/", {
      method: "POST",
    });
    window.location.href = "/admin/login";
  };

  const createInvestigator = async (e) => {
    e.preventDefault();
    setMessage("");
    const response = await apiFetch("/api/admin/investigators/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    if (!data.success) {
      setMessage(data.message || "Unable to create investigator.");
      return;
    }
    setForm(emptyForm);
    setMessage("Investigator created.");
    await loadDashboardData();
  };

  const updateInvestigator = async (id, payload) => {
    const response = await apiFetch(`/api/admin/investigators/${id}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setMessage(data.success ? "Investigator updated." : (data.message || "Update failed."));
    if (data.success) {
      await loadDashboardData();
    }
  };

  const createCriminal = async (e) => {
    e.preventDefault();
    setMessage("");
    const body = new FormData();
    body.append("name", criminalForm.name);
    body.append("face_label", criminalForm.face_label);
    body.append("age", criminalForm.age);
    body.append("gender", criminalForm.gender);
    body.append("address", criminalForm.address);
    body.append("crime_type", criminalForm.crime_type);
    if (criminalForm.photo) body.append("photo", criminalForm.photo);
    criminalForm.dataset_photos.forEach((file) => body.append("dataset_photos", file));

    const response = await apiFetch("/api/admin/criminals/", {
      method: "POST",
      body,
    });
    const data = await response.json();
    if (!data.success) {
      setMessage(data.message || "Unable to add criminal.");
      return;
    }

    setCriminalForm(emptyCriminalForm);
    setMessage(data.message || "Criminal added.");
    await loadDashboardData();
    setSelectedCriminalId(data.criminal?.id || null);
    setCriminalMode("edit");
  };

  const updateCriminal = async (e) => {
    e.preventDefault();
    if (!selectedCriminal) {
      setMessage("Select a criminal to edit.");
      return;
    }

    setMessage("");
    const body = new FormData();
    body.append("name", criminalEditForm.name);
    body.append("face_label", criminalEditForm.face_label);
    body.append("age", criminalEditForm.age);
    body.append("gender", criminalEditForm.gender);
    body.append("address", criminalEditForm.address);
    body.append("crime_type", criminalEditForm.crime_type);
    if (criminalEditForm.photo) body.append("photo", criminalEditForm.photo);
    criminalEditForm.dataset_photos.forEach((file) => body.append("dataset_photos", file));

    const response = await apiFetch(`/api/admin/criminals/${selectedCriminal.id}/`, {
      method: "POST",
      body,
    });
    const data = await response.json();
    setMessage(data.success ? (data.message || "Criminal updated.") : (data.message || "Update failed."));
    if (data.success) {
      await loadDashboardData();
      setSelectedCriminalId(data.criminal?.id || selectedCriminal.id);
    }
  };

  const createCrimeRecord = async (e) => {
    e.preventDefault();
    setMessage("");
    const response = await apiFetch("/api/admin/crime-records/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...crimeRecordForm,
        criminal_id: Number(crimeRecordForm.criminal_id),
      }),
    });
    const data = await response.json();
    if (!data.success) {
      setMessage(data.message || "Unable to add crime record.");
      return;
    }
    setCrimeRecordForm(emptyCrimeRecordForm);
    setMessage(data.message || "Crime record added.");
    await loadDashboardData();
    setSelectedRecordId(data.record?.id || null);
    if (data.record?.criminal_id) setSelectedRecordCriminalId(data.record.criminal_id);
    setRecordMode("edit");
    setRecordModalOpen(null);
  };

  const persistCrimeRecordEdit = async () => {
    if (!selectedRecord) {
      setMessage("Select a crime record to edit.");
      return false;
    }
    setMessage("");
    const response = await apiFetch(`/api/admin/crime-records/${selectedRecord.id}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...crimeRecordEditForm,
        criminal_id: Number(crimeRecordEditForm.criminal_id),
      }),
    });
    const data = await response.json();
    setMessage(data.success ? (data.message || "Crime record updated.") : (data.message || "Update failed."));
    if (data.success) {
      await loadDashboardData();
      setSelectedRecordId(data.record?.id || selectedRecord.id);
      setSelectedRecordCriminalId(data.record?.criminal_id || selectedRecord.criminal_id);
      return true;
    }
    return false;
  };

  const updateCrimeRecord = async (e) => {
    e.preventDefault();
    const saved = await persistCrimeRecordEdit();
    if (saved) {
      setRecordModalOpen(null);
      setRecordMode("view");
    }
  };

  const switchRecordCriminal = (nextCriminalId) => {
    if (!nextCriminalId) return;
    setSelectedRecordCriminalId(nextCriminalId);
    const first = crimeRecords.find((record) => record.criminal_id === nextCriminalId);
    setSelectedRecordId(first ? first.id : null);
  };

  const handleRecordCriminalClick = (nextCriminalId) => {
    if (nextCriminalId === selectedRecordCriminalId) return;
    if (isRecordEditDirty) {
      setRecordSwitchPrompt({ open: true, nextCriminalId });
      return;
    }
    switchRecordCriminal(nextCriminalId);
  };

  const discardAndSwitchRecordCriminal = () => {
    const nextId = recordSwitchPrompt.nextCriminalId;
    setRecordSwitchPrompt({ open: false, nextCriminalId: null });
    switchRecordCriminal(nextId);
  };

  const saveAndSwitchRecordCriminal = async () => {
    const nextId = recordSwitchPrompt.nextCriminalId;
    const saved = await persistCrimeRecordEdit();
    if (!saved) return;
    setRecordSwitchPrompt({ open: false, nextCriminalId: null });
    switchRecordCriminal(nextId);
  };

  const cancelRecordCriminalSwitch = () => {
    setRecordSwitchPrompt({ open: false, nextCriminalId: null });
  };

  const openEmbeddedAdmin = (link) => {
    setEmbeddedAdminUrl(`${apiBase}${link.href}`);
    setEmbeddedAdminTitle(link.text);
    setMessage("");
  };

  const retrainDataset = async () => {
    setMessage("Re-training face dataset...");
    const response = await apiFetch("/api/admin/retrain/", { method: "POST" });
    const data = await response.json();
    setMessage(data.message || (data.success ? "Dataset retrained." : "Dataset retrain failed."));
  };

  const downloadEvidenceReport = () => {
    if (reportFileType === "csv") {
      downloadEvidenceCsv(reportAlerts);
      return;
    }
    downloadEvidencePdf(reportAlerts);
  };

  return (
    <div className="admin-root">
      <aside className="admin-side-icons">
        {adminSections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.key}
              className={`admin-icon-btn ${activeSection === section.key ? "admin-icon-btn-active" : ""}`}
              onClick={() => setActiveSection(section.key)}
              title={section.label}
              aria-label={section.label}
            >
              <Icon />
            </button>
          );
        })}
      </aside>

      <main className="admin-main">
        <header className="admin-top">
          <div>
            <h1 className="admin-title">Administrative Control Window</h1>
          </div>
          <button className="admin-btn admin-btn-danger" onClick={logoutAdmin}>
            <FaSignOutAlt /> Logout
          </button>
        </header>

        <section className="admin-summary-grid">
          <article className="admin-card"><p>Criminals</p><h3>{summary?.criminals ?? "-"}</h3></article>
          <article className="admin-card"><p>Crime Records</p><h3>{summary?.crime_records ?? "-"}</h3></article>
          <article className="admin-card"><p>Investigators</p><h3>{summary?.investigators ?? "-"}</h3></article>
          <article className="admin-card"><p>Active Investigators</p><h3>{summary?.active_investigators ?? "-"}</h3></article>
        </section>

        {activeSection === "investigators" ? (
          <section className="admin-workspace">
            <article className="admin-panel">
              <h2>Investigator Access Control</h2>
              <p>Admin can add investigators and enable/disable their login access.</p>

              <form className="admin-form-grid" onSubmit={createInvestigator} autoComplete="off">
                <input className="admin-input" placeholder="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoComplete="off" required />
                <input className="admin-input" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" required />
                <input className="admin-input" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" required />
                <input className="admin-input" placeholder="Badge ID" value={form.badge_id} onChange={(e) => setForm({ ...form, badge_id: e.target.value })} autoComplete="off" required />
                <input className="admin-input" placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} autoComplete="off" required />
                <label className="admin-checkbox">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                  Active
                </label>
                <button className="admin-btn admin-btn-primary" type="submit">Add Investigator</button>
              </form>
            </article>

            <article className="admin-panel">
              <h2>Existing Investigators</h2>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Badge</th>
                      <th>Department</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investigators.map((inv) => (
                      <tr key={inv.id}>
                        <td>{inv.full_name}</td>
                        <td>{inv.username}</td>
                        <td>{inv.badge_id}</td>
                        <td>{inv.department}</td>
                        <td>{inv.is_active ? "Active" : "Inactive"}</td>
                        <td>
                          <button
                            className="admin-btn admin-btn-ghost"
                            onClick={() => updateInvestigator(inv.id, { is_active: !inv.is_active })}
                          >
                            {inv.is_active ? "Disable" : "Enable"}
                          </button>
                          <button
                            className="admin-btn admin-btn-ghost"
                            onClick={() => setSelectedInvestigatorId(inv.id)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            {selectedInvestigator && editForm ? (
              <article className="admin-panel">
                <h2>Edit Investigator</h2>
                <div className="admin-form-grid">
                  <input className="admin-input" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} autoComplete="off" />
                  <input className="admin-input" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} autoComplete="off" />
                  <input className="admin-input" value={editForm.badge_id} onChange={(e) => setEditForm({ ...editForm, badge_id: e.target.value })} autoComplete="off" />
                  <input className="admin-input" value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} autoComplete="off" />
                  <input className="admin-input" type="password" placeholder="New Password (optional)" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} autoComplete="new-password" />
                  <button
                    className="admin-btn admin-btn-primary"
                    onClick={() =>
                      updateInvestigator(selectedInvestigator.id, editForm)
                    }
                  >
                    Save Changes
                  </button>
                </div>
              </article>
            ) : null}
          </section>
        ) : activeSection === "records" ? (
          <section className="admin-workspace">
            <article className="admin-panel">
              <h2>Crime Record Actions</h2>
              <p>Create and edit crime records stored in the main database.</p>
              <div className="admin-link-grid">
                {quickLinks.records.map((link) => {
                  const Icon = link.icon;
                  return (
                    <button
                      key={link.text}
                      type="button"
                      className="admin-link-card"
                      onClick={() => {
                        setRecordMode(link.action);
                        setRecordModalOpen(link.action);
                      }}
                    >
                      <Icon />
                      <span>{link.text}</span>
                    </button>
                  );
                })}
              </div>
            </article>

            <article className="admin-panel">
              <h2>Existing Crime Records</h2>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Criminal</th>
                      <th>Crime Type</th>
                      <th>Date</th>
                      <th>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crimeRecords.length ? crimeRecords.map((record) => (
                      <tr key={record.id}>
                        <td>{record.criminal_name}</td>
                        <td>{record.crime_type}</td>
                        <td>{record.crime_date}</td>
                        <td>{record.crime_location}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4}>No crime records available.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            {recordMode === "edit" ? (
              <>
                <article className="admin-panel">
                  <h2>Select Criminal</h2>
                  <p>Click a criminal name to load all their crime records for editing.</p>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Criminal Name</th>
                          <th>Total Crime Records</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recordsByCriminal.length ? recordsByCriminal.map((group) => (
                          <tr key={group.criminal_id}>
                            <td>{group.criminal_name}</td>
                            <td>{group.records.length}</td>
                            <td>
                              <button
                                className="admin-btn admin-btn-ghost"
                                onClick={() => handleRecordCriminalClick(group.criminal_id)}
                              >
                                {selectedRecordCriminalId === group.criminal_id ? "Opened" : "Open Records"}
                              </button>
                            </td>
                          </tr>
                        )) : (
                          <tr><td colSpan={3}>No criminals with crime records found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </article>

                <article className="admin-panel">
                  <h2>Selected Criminal Records</h2>
                  {selectedRecordCriminalId ? (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Crime Type</th>
                            <th>Crime Date</th>
                            <th>Crime Location</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCriminalRecords.length ? selectedCriminalRecords.map((record) => (
                            <tr key={`selected-${record.id}`}>
                              <td>{record.crime_type}</td>
                              <td>{record.crime_date}</td>
                              <td>{record.crime_location}</td>
                              <td>
                                <button
                                  className="admin-btn admin-btn-ghost"
                                  onClick={() => {
                                    setSelectedRecordId(record.id);
                                    setRecordModalOpen("edit");
                                  }}
                                >
                                  Edit This Record
                                </button>
                              </td>
                            </tr>
                          )) : (
                            <tr><td colSpan={4}>No records for selected criminal.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p>Select a criminal first to view all their crime records.</p>
                  )}
                </article>
              </>
            ) : null}
          </section>
        ) : activeSection === "monitor" ? (
          <section className="admin-workspace">
            <article className="admin-panel">
              <h2>Investigator Monitoring</h2>
              <p>Track each investigator's scan workload, matches, and triggered alerts.</p>
              <div className="admin-form-grid">
                <select
                  className="admin-input"
                  value={monitorInvestigatorFilter}
                  onChange={(e) => setMonitorInvestigatorFilter(e.target.value)}
                >
                  <option value="ALL">All Investigators</option>
                  {investigatorOptions.map((item) => (
                    <option key={item.id} value={item.name}>{item.name}</option>
                  ))}
                </select>
              </div>
            </article>

            <article className="admin-panel">
              <h2>Investigator Activity Summary</h2>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Investigator</th>
                      <th>Total Scans</th>
                      <th>Matches</th>
                      <th>Alerts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monitorStats.length ? monitorStats.map((row) => (
                      <tr key={row.investigator_name}>
                        <td>{row.investigator_name}</td>
                        <td>{row.scans}</td>
                        <td>{row.matches}</td>
                        <td>{row.alerts}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4}>No monitoring data available.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="admin-panel">
              <h2>Recent Scan Logs</h2>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Investigator</th>
                      <th>Matched Name</th>
                      <th>Crime Type</th>
                      <th>Confidence</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredScanLogs.length ? filteredScanLogs.slice(0, 40).map((log) => (
                      <tr key={`scan-${log.id}`}>
                        <td>{log.investigator_name || "Unknown"}</td>
                        <td>{log.name || "Unknown"}</td>
                        <td>{log.crime_type || "-"}</td>
                        <td>{log.confidence ?? "-"}</td>
                        <td>{log.time || "-"}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5}>No scan logs available.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="admin-panel">
              <h2>Recent Alerts</h2>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Investigator</th>
                      <th>Message</th>
                      <th>Crime Type</th>
                      <th>Risk</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts.length ? filteredAlerts.slice(0, 40).map((alert) => (
                      <tr key={`alert-${alert.id}`}>
                        <td>{alert.investigator_name || "Unknown"}</td>
                        <td>{alert.message || "-"}</td>
                        <td>{alert.crime_type || "-"}</td>
                        <td>{alert.risk_level || "-"}</td>
                        <td>{alert.time || "-"}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5}>No alerts available.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        ) : activeSection === "reports" ? (
          <section className="admin-workspace admin-workspace-reports">
            <article className="admin-panel admin-panel-full">
              <div className="admin-report-header">
                <div>
                  <h2>Evidence Reports</h2>
                  <p>Download evidence reports per investigator with snapshots and match details.</p>
                </div>
                <div className="admin-report-controls">
                  <select
                    className="admin-input"
                    value={reportInvestigatorId}
                    onChange={(e) => setReportInvestigatorId(e.target.value)}
                  >
                    <option value="ALL">All Investigators</option>
                    {investigatorOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="admin-input"
                    value={reportFileType}
                    onChange={(e) => setReportFileType(e.target.value)}
                  >
                    <option value="pdf">PDF</option>
                    <option value="csv">CSV</option>
                  </select>
                  <button className="admin-btn admin-btn-primary" onClick={downloadEvidenceReport}>
                    Download Report
                  </button>
                </div>
              </div>

              <div className="admin-table-wrap admin-report-table">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Investigator</th>
                      <th>Criminal</th>
                      <th>Crime Type</th>
                      <th>Confidence</th>
                      <th>Time</th>
                      <th>Criminal Photo</th>
                      <th>Matched Snapshot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportAlerts.length ? reportAlerts.map((row) => (
                      <tr key={row.id ?? `${row.investigatorId}-${row.time}`}>
                        <td>{row.investigatorName}</td>
                        <td>{row.criminalName}</td>
                        <td>{row.crimeType}</td>
                        <td>{row.confidence}%</td>
                        <td>{row.time}</td>
                        <td>
                          {row.criminalPhoto ? (
                            <img className="admin-report-image" src={row.criminalPhoto} alt="Criminal" />
                          ) : (
                            <span className="admin-report-placeholder">No Image</span>
                          )}
                        </td>
                        <td>
                          {row.matchedSnapshot ? (
                            <img className="admin-report-image" src={row.matchedSnapshot} alt="Matched snapshot" />
                          ) : (
                            <span className="admin-report-placeholder">No Image</span>
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7}>No evidence alerts available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        ) : activeSection === "criminals" ? (
          <section className="admin-workspace">
            <article className="admin-panel">
              <h2>Criminal Actions</h2>
              <p>Add or edit criminals without leaving this React dashboard. Dataset photos are used for auto-training.</p>
              <div className="admin-link-grid">
                {quickLinks.criminals.map((link) => {
                  const Icon = link.icon;
                  return (
                    <button
                      key={link.text}
                      type="button"
                      className="admin-link-card"
                      onClick={() => setCriminalMode(link.action)}
                    >
                      <Icon />
                      <span>{link.text}</span>
                    </button>
                  );
                })}
              </div>
              <button type="button" className="admin-btn admin-btn-ghost" onClick={retrainDataset}>
                Re-Train Face Dataset
              </button>
            </article>

            {criminalMode === "add" ? (
              <article className="admin-panel">
                <h2>Add Criminal</h2>
                <form className="admin-form-grid" onSubmit={createCriminal}>
                  <input className="admin-input" placeholder="Name" value={criminalForm.name} onChange={(e) => setCriminalForm({ ...criminalForm, name: e.target.value })} required />
                  <input className="admin-input" placeholder="Face Label (e.g., person_001)" value={criminalForm.face_label} onChange={(e) => setCriminalForm({ ...criminalForm, face_label: e.target.value })} required />
                  <input className="admin-input" placeholder="Age" type="number" min="1" value={criminalForm.age} onChange={(e) => setCriminalForm({ ...criminalForm, age: e.target.value })} required />
                  <input className="admin-input" placeholder="Gender" value={criminalForm.gender} onChange={(e) => setCriminalForm({ ...criminalForm, gender: e.target.value })} required />
                  <input className="admin-input" placeholder="Crime Type" value={criminalForm.crime_type} onChange={(e) => setCriminalForm({ ...criminalForm, crime_type: e.target.value })} required />
                  <textarea className="admin-input" placeholder="Address" value={criminalForm.address} onChange={(e) => setCriminalForm({ ...criminalForm, address: e.target.value })} required />
                  <label className="admin-label" htmlFor="criminal-display-photo-add">
                    Display Photo (Single Image)
                  </label>
                  <p>Select one profile/display image shown in dashboard and alerts.</p>
                  <input id="criminal-display-photo-add" className="admin-input" type="file" accept="image/*" onChange={(e) => setCriminalForm({ ...criminalForm, photo: e.target.files?.[0] || null })} required />
                  <label className="admin-label" htmlFor="criminal-training-photos-add">
                    Training Photos (Multiple Images)
                  </label>
                  <p>Upload multiple face images for dataset storage. These are added to the criminal dataset and auto-trained for scanning matches.</p>
                  <input id="criminal-training-photos-add" className="admin-input" type="file" accept="image/*" multiple onChange={(e) => setCriminalForm({ ...criminalForm, dataset_photos: Array.from(e.target.files || []) })} />
                  <button type="submit" className="admin-btn admin-btn-primary">Add Criminal</button>
                </form>
              </article>
            ) : null}

            <article className="admin-panel">
              <h2>Existing Criminals</h2>
              <p>List of all registered criminals in the system database.</p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Face Label</th>
                      <th>Crime Type</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criminals.length ? criminals.map((criminal) => (
                      <tr key={criminal.id}>
                        <td>{criminal.name}</td>
                        <td>{criminal.face_label}</td>
                        <td>{criminal.crime_type}</td>
                        <td>
                          <button
                            className="admin-btn admin-btn-ghost"
                            onClick={() => setSelectedCriminalId(criminal.id)}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4}>No criminals available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="admin-panel">
              <h2>Criminal Details</h2>
              {selectedCriminal ? (
                <div className="admin-form-grid">
                  <p><strong>Name:</strong> {selectedCriminal.name}</p>
                  <p><strong>Face Label:</strong> {selectedCriminal.face_label}</p>
                  <p><strong>Age:</strong> {selectedCriminal.age}</p>
                  <p><strong>Gender:</strong> {selectedCriminal.gender}</p>
                  <p><strong>Address:</strong> {selectedCriminal.address}</p>
                  <p><strong>Crime Type:</strong> {selectedCriminal.crime_type}</p>
                  {selectedCriminal.photo ? (
                    <img
                      src={selectedCriminal.photo.startsWith("http")
                        ? selectedCriminal.photo
                        : `${apiBase}${selectedCriminal.photo}`}
                      alt={selectedCriminal.name}
                      style={{ width: "100%", maxWidth: "260px", borderRadius: "10px", border: "1px solid rgba(98, 224, 255, 0.3)" }}
                    />
                  ) : null}
                </div>
              ) : (
                <p>Select a criminal from the list to view details.</p>
              )}
            </article>

            {criminalMode === "edit" ? (
              <article className="admin-panel">
                <h2>Edit Criminal</h2>
                {selectedCriminal ? (
                  <form className="admin-form-grid" onSubmit={updateCriminal}>
                    <input className="admin-input" value={criminalEditForm.name} onChange={(e) => setCriminalEditForm({ ...criminalEditForm, name: e.target.value })} required />
                    <input className="admin-input" value={criminalEditForm.face_label} onChange={(e) => setCriminalEditForm({ ...criminalEditForm, face_label: e.target.value })} required />
                    <input className="admin-input" type="number" min="1" value={criminalEditForm.age} onChange={(e) => setCriminalEditForm({ ...criminalEditForm, age: e.target.value })} required />
                    <input className="admin-input" value={criminalEditForm.gender} onChange={(e) => setCriminalEditForm({ ...criminalEditForm, gender: e.target.value })} required />
                    <input className="admin-input" value={criminalEditForm.crime_type} onChange={(e) => setCriminalEditForm({ ...criminalEditForm, crime_type: e.target.value })} required />
                    <textarea className="admin-input" value={criminalEditForm.address} onChange={(e) => setCriminalEditForm({ ...criminalEditForm, address: e.target.value })} required />
                    <label className="admin-label" htmlFor="criminal-display-photo-edit">
                      Replace Display Photo (Single Image)
                    </label>
                    <p>Upload one new display image to replace the current profile photo.</p>
                    <input id="criminal-display-photo-edit" className="admin-input" type="file" accept="image/*" onChange={(e) => setCriminalEditForm({ ...criminalEditForm, photo: e.target.files?.[0] || null })} />
                    <label className="admin-label" htmlFor="criminal-training-photos-edit">
                      Add Training Photos (Multiple Images)
                    </label>
                    <p>Upload multiple new images to append into existing dataset images for this criminal, then auto-retrain for future scans.</p>
                    <input id="criminal-training-photos-edit" className="admin-input" type="file" accept="image/*" multiple onChange={(e) => setCriminalEditForm({ ...criminalEditForm, dataset_photos: Array.from(e.target.files || []) })} />
                    <button type="submit" className="admin-btn admin-btn-primary">Save Criminal Changes</button>
                  </form>
                ) : (
                  <p>Select a criminal from the list, then edit details here.</p>
                )}
              </article>
            ) : null}
          </section>
        ) : (
          <section className="admin-workspace">
            <article className="admin-panel">
              <h2>{adminSections.find((s) => s.key === activeSection)?.label}</h2>
              <p>Use quick admin actions for add and edit operations.</p>
              <div className="admin-link-grid">
                {(quickLinks[activeSection] || []).map((link) => {
                  const Icon = link.icon;
                  return (
                    <button
                      key={link.text}
                      type="button"
                      className="admin-link-card"
                      onClick={() => openEmbeddedAdmin(link)}
                    >
                      <Icon />
                      <span>{link.text}</span>
                    </button>
                  );
                })}
              </div>
            </article>

            <article className="admin-panel admin-panel-full">
              <h2>{embeddedAdminTitle || "Admin Tool"}</h2>
              <p>
                {embeddedAdminUrl
                  ? "The selected admin page is opened below in the same window."
                  : "Select an action to open the corresponding admin page here."}
              </p>
              {embeddedAdminUrl ? (
                <iframe
                  className="admin-embed-frame"
                  src={embeddedAdminUrl}
                  title={embeddedAdminTitle || "Embedded Admin"}
                />
              ) : null}
            </article>
          </section>
        )}

        {message ? <p className="admin-message">{message}</p> : null}

        {recordSwitchPrompt.open ? (
          <div className="admin-modal-backdrop">
            <div className="admin-modal-card">
              <h3>Unsaved Crime Record Changes</h3>
              <p>You have unsaved changes for the current record. Save before switching criminal?</p>
              <div className="admin-modal-actions">
                <button className="admin-btn admin-btn-primary" onClick={saveAndSwitchRecordCriminal}>
                  Save & Switch
                </button>
                <button className="admin-btn admin-btn-ghost" onClick={discardAndSwitchRecordCriminal}>
                  Discard & Switch
                </button>
                <button className="admin-btn admin-btn-danger" onClick={cancelRecordCriminalSwitch}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {recordModalOpen === "add" ? (
          <div className="admin-modal-backdrop">
            <div className="admin-modal-card admin-modal-card-wide">
              <h3>Add Crime Record</h3>
              <form className="admin-form-grid" onSubmit={createCrimeRecord}>
                <select className="admin-input" value={crimeRecordForm.criminal_id} onChange={(e) => setCrimeRecordForm({ ...crimeRecordForm, criminal_id: e.target.value })} required>
                  <option value="">Select Criminal</option>
                  {criminals.map((criminal) => (
                    <option key={criminal.id} value={criminal.id}>{criminal.name} ({criminal.face_label})</option>
                  ))}
                </select>
                <input className="admin-input" placeholder="Crime Type" value={crimeRecordForm.crime_type} onChange={(e) => setCrimeRecordForm({ ...crimeRecordForm, crime_type: e.target.value })} required />
                <input className="admin-input" type="date" value={crimeRecordForm.crime_date} onChange={(e) => setCrimeRecordForm({ ...crimeRecordForm, crime_date: e.target.value })} required />
                <input className="admin-input" placeholder="Crime Location" value={crimeRecordForm.crime_location} onChange={(e) => setCrimeRecordForm({ ...crimeRecordForm, crime_location: e.target.value })} required />
                <textarea className="admin-input" placeholder="Description" value={crimeRecordForm.description} onChange={(e) => setCrimeRecordForm({ ...crimeRecordForm, description: e.target.value })} required />
                <div className="admin-modal-actions">
                  <button type="submit" className="admin-btn admin-btn-primary">Save</button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-ghost"
                    onClick={() => {
                      setRecordModalOpen(null);
                      setRecordMode("view");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
        {recordModalOpen === "edit" ? (
          <div className="admin-modal-backdrop">
            <div className="admin-modal-card admin-modal-card-wide">
              <h3>Edit Crime Record</h3>
              {selectedRecord ? (
                <form className="admin-form-grid" onSubmit={updateCrimeRecord}>
                  <select className="admin-input" value={crimeRecordEditForm.criminal_id} onChange={(e) => setCrimeRecordEditForm({ ...crimeRecordEditForm, criminal_id: e.target.value })} required>
                    <option value="">Select Criminal</option>
                    {criminals.map((criminal) => (
                      <option key={criminal.id} value={criminal.id}>{criminal.name} ({criminal.face_label})</option>
                    ))}
                  </select>
                  <input className="admin-input" value={crimeRecordEditForm.crime_type} onChange={(e) => setCrimeRecordEditForm({ ...crimeRecordEditForm, crime_type: e.target.value })} required />
                  <input className="admin-input" type="date" value={crimeRecordEditForm.crime_date} onChange={(e) => setCrimeRecordEditForm({ ...crimeRecordEditForm, crime_date: e.target.value })} required />
                  <input className="admin-input" value={crimeRecordEditForm.crime_location} onChange={(e) => setCrimeRecordEditForm({ ...crimeRecordEditForm, crime_location: e.target.value })} required />
                  <textarea className="admin-input" value={crimeRecordEditForm.description} onChange={(e) => setCrimeRecordEditForm({ ...crimeRecordEditForm, description: e.target.value })} required />
                  <div className="admin-modal-actions">
                    <button type="submit" className="admin-btn admin-btn-primary">Save</button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-ghost"
                      onClick={() => setRecordModalOpen(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p>Select a crime record from the selected criminal list, then edit details here.</p>
                  <div className="admin-modal-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn-ghost"
                      onClick={() => setRecordModalOpen(null)}
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function downloadEvidenceCsv(rows) {
  const headers = [
    "Investigator",
    "Criminal Name",
    "Crime Type",
    "Confidence",
    "Time",
    "Criminal Photo",
    "Matched Snapshot",
  ];
  const lines = [headers.join(",")];

  rows.forEach((row) => {
    const values = [
      row.investigatorName,
      row.criminalName,
      row.crimeType,
      row.confidence,
      row.time,
      row.criminalPhoto || "",
      row.matchedSnapshot || "",
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`);
    lines.push(values.join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `admin-evidence-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadEvidencePdf(rows) {
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
          <td>${row.investigatorName}</td>
          <td>${row.criminalName}</td>
          <td>${row.crimeType}</td>
          <td>${row.confidence}%</td>
          <td>${row.time}</td>
          <td>${criminalPhoto}</td>
          <td>${matchedSnapshot}</td>
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
              <th>Investigator</th>
              <th>Criminal Name</th>
              <th>Crime Type</th>
              <th>Confidence</th>
              <th>Time</th>
              <th>Criminal Photo</th>
              <th>Matched Snapshot</th>
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
