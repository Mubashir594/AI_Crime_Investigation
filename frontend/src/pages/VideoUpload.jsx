import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import Sidebar from "../components/Sidebar";
import LiveScanPanel from "../components/LiveScanPanel";
import AlertPanel from "../components/AlertPanel";
import AiAccuracyRing from "../components/AiAccuracyRing";
import LiveScanMatchesPanel from "../components/LiveScanMatchesPanel";
import { getApiBase } from "../utils/apiBase";

const API_BASE = getApiBase();
const MATCH_CONFIDENCE_THRESHOLD = 70;

export default function VideoUpload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [matches, setMatches] = useState([]);
  const [annotatedPreviewUrl, setAnnotatedPreviewUrl] = useState("");
  const [accuracyLoopIndex, setAccuracyLoopIndex] = useState(0);
  const [statusText, setStatusText] = useState("Choose an image or video and click PROCESS MEDIA.");

  const activeAccuracyItem = useMemo(() => {
    if (!matches.length) return null;
    return matches[accuracyLoopIndex % matches.length] || null;
  }, [matches, accuracyLoopIndex]);

  const activeAccuracyValue = Number(activeAccuracyItem?.confidence) || 0;
  const activeAccuracyLabel = activeAccuracyItem
    ? `${activeAccuracyItem.name || activeAccuracyItem.face_label}`
    : "ACCURACY";

  useEffect(() => {
    return () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    };
  }, [mediaUrl]);

  const applySelectedFile = (file) => {
    if (!file) return;
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);

    const nextUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setMediaUrl(nextUrl);
    setMediaType(file.type.startsWith("video/") ? "VIDEO" : "IMAGE");
    setMatches([]);
    setAnnotatedPreviewUrl("");
    setAccuracyLoopIndex(0);
    setStatusText(`Selected: ${file.name}`);
  };

  const handleFileChoose = (event) => {
    const file = event.target.files?.[0];
    applySelectedFile(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragActive) setIsDragActive(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
    const file = event.dataTransfer?.files?.[0];
    applySelectedFile(file);
  };

  useEffect(() => {
    if (matches.length <= 1) {
      setAccuracyLoopIndex(0);
      return;
    }

    const timer = setInterval(() => {
      setAccuracyLoopIndex((prev) => (prev + 1) % matches.length);
    }, 1800);

    return () => clearInterval(timer);
  }, [matches]);

  const handleProcessMedia = async () => {
    if (!selectedFile || isProcessing) return;

    setIsProcessing(true);
    setStatusText("Processing media for face matching...");

    try {
      const formData = new FormData();
      formData.append("media", selectedFile);

      const res = await fetch(`${API_BASE}/api/video/upload/`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();

      if (!data.success) {
        setStatusText(data.message || "Upload failed.");
        setMatches([]);
        return;
      }

      const nextMatchesRaw = Array.isArray(data.criminals) ? data.criminals : [];
      const nextMatches = nextMatchesRaw
        .map((criminal) => {
          const photo = criminal?.photo
            ? criminal.photo.startsWith("http")
              ? criminal.photo
              : `${API_BASE}${criminal.photo}`
            : null;
          return {
            ...criminal,
            photo,
            snapshot: data.preview_image || "",
          };
        })
        .filter((criminal) => Number(criminal?.confidence) > MATCH_CONFIDENCE_THRESHOLD);

      setMatches(nextMatches);
      setAnnotatedPreviewUrl(data.preview_image || "");
      setAccuracyLoopIndex(0);
      setStatusText(nextMatches.length ? "Media processed. Matches found." : "Media processed. No matches found.");
    } catch (_) {
      setStatusText("Upload failed. Please try again.");
      setMatches([]);
      setAnnotatedPreviewUrl("");
      setAccuracyLoopIndex(0);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBack = () => navigate("/dashboard");

  return (
    <DashboardLayout className="hud-root-no-bg-radar">
      <div className="hud-menu">
        <Sidebar />
      </div>

      <div className="hud-summary">
        <div className="hud-card live-info-panel">
          <h3 className="hud-section-title">UPLOAD SCAN WINDOW</h3>
          <p>Upload a photo or video and run face matching.</p>
          <p>{statusText}</p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChoose}
            style={{ display: "none" }}
          />

          <button className="hud-button live-control-btn" onClick={() => fileInputRef.current?.click()}>
            CHOOSE FILE
          </button>
          <button
            className="hud-button live-control-btn"
            onClick={handleProcessMedia}
            disabled={!selectedFile || isProcessing}
          >
            {isProcessing ? "PROCESSING..." : "PROCESS MEDIA"}
          </button>
          <button className="hud-button live-back-btn" onClick={handleBack}>
            BACK TO DASHBOARD
          </button>
        </div>
      </div>

      <div className="hud-center">
        <div className="live-stage">
          <div
            className={`upload-dropzone ${isDragActive ? "upload-dropzone-active" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <LiveScanPanel
              mode="UPLOAD"
              mediaUrl={mediaUrl}
              mediaType={mediaType}
              annotatedPreviewUrl={annotatedPreviewUrl}
            />
            <div className="upload-dropzone-hint">
              <span>Drag & drop an image or video here</span>
              <button
                type="button"
                className="hud-button upload-dropzone-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Or choose a file
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="hud-right">
        <AiAccuracyRing accuracy={activeAccuracyValue} label={activeAccuracyLabel} />
        <AlertPanel />
      </div>

      <div className="hud-history">
        <LiveScanMatchesPanel records={matches} />
      </div>
    </DashboardLayout>
  );
}
