import { useEffect, useState } from "react";
import { getApiBaseCandidates } from "../utils/apiBase";

export default function CriminalDatabasePanel() {
  const [criminals, setCriminals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchText, setSearchText] = useState("");
  const [genderFilter, setGenderFilter] = useState("ALL");
  const [crimeFilter, setCrimeFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");

  useEffect(() => {
    let isDisposed = false;

    const loadCriminals = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        let payload = null;
        let lastError = "";

        for (const base of getApiBaseCandidates()) {
          try {
            const res = await fetch(`${base}/api/criminals/`, {
              credentials: "include",
              headers: { Accept: "application/json" },
            });

            if (!res.ok) {
              lastError = `API ${res.status}`;
              continue;
            }

            const data = await res.json();
            if (Array.isArray(data?.criminals)) {
              payload = data.criminals;
              break;
            }
          } catch (err) {
            lastError = err?.message || "Network error";
          }
        }

        if (isDisposed) return;

        if (payload) {
          setCriminals(payload);
          setErrorMessage("");
        } else {
          setCriminals([]);
          setErrorMessage(lastError || "Unable to load criminal records.");
        }
      } catch (_) {
        if (isDisposed) return;
        setCriminals([]);
        setErrorMessage("Unable to load criminal records.");
      } finally {
        if (!isDisposed) setIsLoading(false);
      }
    };

    loadCriminals();
    const timer = setInterval(loadCriminals, 5000);

    return () => {
      isDisposed = true;
      clearInterval(timer);
    };
  }, []);

  const normalizedSearch = searchText.trim().toLowerCase();

  const genderOptions = Array.from(
    new Set(
      criminals
        .map((item) => item.gender)
        .filter((item) => typeof item === "string" && item.trim().length > 0)
    )
  );

  const crimeOptions = Array.from(
    new Set(
      criminals
        .map((item) => item.crime_type)
        .filter((item) => typeof item === "string" && item.trim().length > 0)
    )
  );

  const visibleCriminals = criminals
    .filter((item) => {
      if (genderFilter !== "ALL" && item.gender !== genderFilter) return false;
      if (crimeFilter !== "ALL" && item.crime_type !== crimeFilter) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        item.id,
        item.name,
        item.face_label,
        item.crime_type,
        item.gender,
        item.address,
      ]
        .filter((v) => v !== null && v !== undefined)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    })
    .sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      const left = a?.[sortBy];
      const right = b?.[sortBy];

      if (typeof left === "number" || typeof right === "number") {
        return ((Number(left) || 0) - (Number(right) || 0)) * direction;
      }

      return String(left ?? "")
        .localeCompare(String(right ?? ""), undefined, { sensitivity: "base" }) * direction;
    });

  const handleReset = () => {
    setSearchText("");
    setGenderFilter("ALL");
    setCrimeFilter("ALL");
    setSortBy("name");
    setSortDirection("asc");
  };

  return (
    <div className="hud-card criminals-panel">
      <h3 className="hud-section-title">CRIMINAL DATABASE</h3>

      <div className="criminals-controls">
        <input
          className="criminals-input"
          placeholder="Search by name, face label, crime, address..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />

        <select
          className="criminals-select"
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
        >
          <option value="ALL">All Genders</option>
          {genderOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <select
          className="criminals-select"
          value={crimeFilter}
          onChange={(e) => setCrimeFilter(e.target.value)}
        >
          <option value="ALL">All Crimes</option>
          {crimeOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <select
          className="criminals-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="name">Sort: Name</option>
          <option value="id">Sort: ID</option>
          <option value="age">Sort: Age</option>
          <option value="face_label">Sort: Face Label</option>
          <option value="crime_type">Sort: Crime Type</option>
        </select>

        <select
          className="criminals-select"
          value={sortDirection}
          onChange={(e) => setSortDirection(e.target.value)}
        >
          <option value="asc">Asc</option>
          <option value="desc">Desc</option>
        </select>

        <button className="hud-button criminals-reset-btn" onClick={handleReset}>
          RESET
        </button>
      </div>

      <p className="criminals-meta">
        Showing <b>{visibleCriminals.length}</b> of <b>{criminals.length}</b> records
      </p>

      {isLoading ? (
        <p className="history-empty">Loading criminal records...</p>
      ) : errorMessage ? (
        <p className="history-empty">{errorMessage}</p>
      ) : visibleCriminals.length === 0 ? (
        <p className="history-empty">No criminal records available.</p>
      ) : (
        <div className="criminals-table-wrap">
          <table className="criminals-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Face Label</th>
                <th>Crime Type</th>
                <th>Crime Records</th>
                <th>Evidence Files</th>
                <th>Age</th>
                <th>Gender</th>
                <th>Address</th>
              </tr>
            </thead>
            <tbody>
              {visibleCriminals.map((criminal) => (
                <tr key={criminal.id ?? criminal.face_label}>
                  <td>{criminal.id ?? "-"}</td>
                  <td>{criminal.name || "-"}</td>
                  <td>{criminal.face_label || "-"}</td>
                  <td>{criminal.crime_type || "-"}</td>
                  <td>{criminal.crime_record_count ?? 0}</td>
                  <td>{criminal.evidence_count ?? 0}</td>
                  <td>{criminal.age ?? "-"}</td>
                  <td>{criminal.gender || "-"}</td>
                  <td>{criminal.address || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
