import { useNavigate } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import Sidebar from "../components/Sidebar";
import CriminalDatabasePanel from "../components/CriminalDatabasePanel";

export default function CriminalDatabase() {
  const navigate = useNavigate();

  return (
    <DashboardLayout className="hud-root-criminals">
      <div className="hud-menu">
        <Sidebar />
      </div>

      <div className="hud-criminals-main">
        <CriminalDatabasePanel />
      </div>

      <div className="hud-right">
        <div className="hud-card live-info-panel criminals-side-panel">
          <h3 className="hud-section-title">DATABASE VIEW</h3>
          <p>
            Search, filter, and sort all registered criminal records from one
            dedicated screen.
          </p>
          <button className="hud-button live-back-btn" onClick={() => navigate("/dashboard")}>
            BACK TO DASHBOARD
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
