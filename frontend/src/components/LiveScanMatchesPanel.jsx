export default function LiveScanMatchesPanel({ records = [] }) {
  return (
    <div className="hud-card live-matches-panel">
      <h3 className="hud-section-title">RECOGNIZED CRIMINALS (CURRENT SCAN)</h3>

      {records.length === 0 ? (
        <p className="history-empty">No criminal match detected in this scan yet.</p>
      ) : (
        <div className="live-matches-list">
          {records.map((item, index) => (
            <div className="live-match-card" key={`${item.face_label}-${index}`}>
              <div className="live-match-photo-wrap">
                {item.photo ? (
                  <img
                    className="live-match-photo"
                    src={item.photo}
                    alt={item.name}
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                      const fallback = event.currentTarget.nextElementSibling;
                      if (fallback) fallback.style.display = "grid";
                    }}
                  />
                ) : (
                  <div className="live-match-photo-placeholder">NO PHOTO</div>
                )}
                {item.photo ? (
                  <div className="live-match-photo-placeholder live-match-photo-fallback">NO PHOTO</div>
                ) : null}
              </div>

              <div className="live-match-photo-wrap">
                {item.snapshot ? (
                  <img
                    className="live-match-photo"
                    src={item.snapshot}
                    alt="Matched snapshot"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                      const fallback = event.currentTarget.nextElementSibling;
                      if (fallback) fallback.style.display = "grid";
                    }}
                  />
                ) : (
                  <div className="live-match-photo-placeholder">NO SNAPSHOT</div>
                )}
                {item.snapshot ? (
                  <div className="live-match-photo-placeholder live-match-photo-fallback">NO SNAPSHOT</div>
                ) : null}
              </div>

              <div className="live-match-info">
                <p><strong>Name:</strong> {item.name}</p>
                <p><strong>Face Label:</strong> {item.face_label}</p>
                <p><strong>Crime:</strong> {item.crime_type}</p>
                <p><strong>Age / Gender:</strong> {item.age} / {item.gender}</p>
                <p><strong>Address:</strong> {item.address}</p>
                <p><strong>Confidence:</strong> {item.confidence}%</p>
                <p><strong>Detected:</strong> {item.time}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
