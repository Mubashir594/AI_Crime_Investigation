export default function ActionButtons({ onStart, onUpload }) {
  return (
    <div className="action-buttons-container">
      <button className="hud-button" type="button" onClick={onStart}>
        START SCAN
      </button>

      <button className="hud-button" type="button" onClick={onUpload}>
        UPLOAD MEDIA
      </button>
    </div>
  );
}
