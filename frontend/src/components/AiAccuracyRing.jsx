export default function AccuracyRadar({
  accuracy = 97.6,
  label = "ACCURACY",
}) {
  const normalizedAccuracy = Number.isFinite(Number(accuracy)) ? Number(accuracy) : 0;
  const displayAccuracy = normalizedAccuracy.toFixed(2);

  return (
    <div className="hud-panel radar-panel">
      <h3 className="hud-section-title">AI ACTIVITY</h3>

      <div className="radar-container">
        <div className="radar-grid"></div>
        <div className="radar-sweep"></div>

        <div className="radar-center">
          <div className="radar-value">{displayAccuracy}%</div>
          <div className="radar-label">{label}</div>
        </div>
      </div>
    </div>
  );
}
