function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 7v6l4 2" />
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
      <path d="M3 4v4h4" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M8 8h8v8H8z" />
      <path d="M11 11h2v2h-2z" />
    </svg>
  );
}

function ServicesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4z" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

export default function BottomNav({ tab, setTab }) {
  return (
    <nav className="bottom-nav">
      <button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}>
        <span className="nav-icon"><HomeIcon /></span>
        <span className="nav-label">Главная</span>
      </button>
      <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
        <span className="nav-icon"><HistoryIcon /></span>
        <span className="nav-label">История</span>
      </button>
      <button className={`scan-btn ${tab === "scan" ? "active" : ""}`} onClick={() => setTab("scan")}>
        <span className="nav-icon"><ScanIcon /></span>
        <span className="nav-label">Скан</span>
      </button>
      <button className={tab === "services" ? "active" : ""} onClick={() => setTab("services")}>
        <span className="nav-icon"><ServicesIcon /></span>
        <span className="nav-label">Сервисы</span>
      </button>
      <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>
        <span className="nav-icon"><ProfileIcon /></span>
        <span className="nav-label">Профиль</span>
      </button>
    </nav>
  );
}
