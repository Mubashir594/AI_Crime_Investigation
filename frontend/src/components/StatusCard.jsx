export default function StatusCard({ title, value }) {
  return (
    <div className="hud-panel" style={{ minWidth: "180px" }}>
      <p
        className="text-neon"
        style={{
          fontSize: "12px",
          marginBottom: "8px",
          letterSpacing: "1px",
        }}
      >
        {title}
      </p>

      <p
        style={{
          fontSize: "13px",
          fontWeight: "600",
          margin: 0,
        }}
      >
        {value}
      </p>
    </div>
  );
}
