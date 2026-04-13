export default function TopBar() {
  return (
    <div style={{
      height: "60px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 20px",
      background: "#0b1220",
      borderBottom: "1px solid #1f2a44"
    }}>
      <div style={{ fontWeight: 600, fontSize: "18px" }}>
        LILA Player Ops
      </div>

      <div style={{ fontSize: "14px", opacity: 0.7 }}>
        Map Analytics Dashboard
      </div>
    </div>
  );
}