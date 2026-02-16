export default function BottomNav({ tab, setTab }) {
  return (
    <nav className="bottom-nav">
      <button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}>
        <span>Home</span>
      </button>
      <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
        <span>History</span>
      </button>
      <button className={`scan-btn ${tab === "scan" ? "active" : ""}`} onClick={() => setTab("scan")}>
        <span>SCAN</span>
      </button>
      <button className={tab === "services" ? "active" : ""} onClick={() => setTab("services")}>
        <span>Services</span>
      </button>
      <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>
        <span>Profile</span>
      </button>
    </nav>
  );
}
