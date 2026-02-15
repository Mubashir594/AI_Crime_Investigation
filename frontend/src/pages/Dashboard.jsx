import DashboardLayout from "../layouts/DashboardLayout";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import SummaryPanel from "../components/SummaryPanel";
import ActionButtons from "../components/ActionButtons";
import DetectionAnalyticsMiniGraph from "../components/DetectionAnalyticsMiniGraph";
import RecognitionHistory from "../components/RecognitionHistory";

export default function Dashboard() {
  const navigate = useNavigate();

  const handleStartScan = () => {
    navigate("/webcam");
  };

  const handleUpload = () => {
    navigate("/upload");
  };

  return (
    <DashboardLayout className="hud-root-no-bg-radar">
      <div className="hud-menu">
        <Sidebar />
      </div>

      <div className="hud-summary">
        <SummaryPanel />
      </div>

      <div className="hud-center">
        <ActionButtons onStart={handleStartScan} onUpload={handleUpload} />
      </div>

      <div className="hud-right">
        <DetectionAnalyticsMiniGraph />
      </div>

      <div className="hud-history">
        <RecognitionHistory />
      </div>
    </DashboardLayout>
  );
}
