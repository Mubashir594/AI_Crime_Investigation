export default function LiveScanPanel({
  mode = "IDLE", // IDLE | LIVE | UPLOAD
  isWebcamOn = false,
  streamUrl = "",
  mediaUrl = "",
  mediaType = "", // IMAGE | VIDEO
  annotatedPreviewUrl = "",
}) {
  return (
    <div className="hud-card live-scan-panel">
      <h3 className="hud-section-title">LIVE SCAN</h3>

      <div className="live-scan-content">
        {mode === "IDLE" && (
          <p className="scan-placeholder">
            Waiting for live scan or upload...
          </p>
        )}

        {mode === "LIVE" && (
          isWebcamOn && streamUrl ? (
            <img className="live-feed-image" src={streamUrl} alt="Live webcam feed" />
          ) : (
            <p className="scan-placeholder">
              Click START WEBCAM to begin live scan.
            </p>
          )
        )}

        {mode === "UPLOAD" && (
          annotatedPreviewUrl ? (
            <div className="upload-preview-stack">
              <img className="live-feed-image" src={annotatedPreviewUrl} alt="Detected face matches preview" />
              <p className="scan-placeholder">Processed preview with detected face boxes.</p>
            </div>
          ) : mediaUrl ? (
            mediaType === "VIDEO" ? (
              <video className="live-feed-image" src={mediaUrl} controls />
            ) : (
              <img className="live-feed-image" src={mediaUrl} alt="Uploaded media preview" />
            )
          ) : (
            <p className="scan-placeholder">
              Uploaded video/image preview will appear here
            </p>
          )
        )}
      </div>
    </div>
  );
}
