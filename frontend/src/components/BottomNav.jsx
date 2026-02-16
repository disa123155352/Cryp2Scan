export default function BottomNav({ tab, setTab }) {
  return (
    <nav className="bottom-nav">
      <button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}>
        <span className="nav-icon">⌂</span>
        <span className="nav-label">Главная</span>
      </button>
      <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
        <span className="nav-icon">◷</span>
        <span className="nav-label">История</span>
      </button>
      <button className={`scan-btn ${tab === "scan" ? "active" : ""}`} onClick={() => setTab("scan")}>
        <span className="nav-icon">⌗</span>
        <span className="nav-label">Скан</span>
      </button>
      <button className={tab === "services" ? "active" : ""} onClick={() => setTab("services")}>
        <span className="nav-icon">◫</span>
        <span className="nav-label">Сервисы</span>
      </button>
      <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>
        <span className="nav-icon">◎</span>
        <span className="nav-label">Профиль</span>
      </button>
    </nav>
  );
}
