import { FaHouse, FaClockRotateLeft, FaQrcode, FaGrip, FaUser } from "react-icons/fa6";

export default function BottomNav({ tab, setTab }) {
  return (
    <nav className="bottom-nav">
      <button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}><FaHouse /><span>Home</span></button>
      <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}><FaClockRotateLeft /><span>History</span></button>
      <button className={`scan-btn ${tab === "scan" ? "active" : ""}`} onClick={() => setTab("scan")}><FaQrcode /><span>SCAN</span></button>
      <button className={tab === "services" ? "active" : ""} onClick={() => setTab("services")}><FaGrip /><span>Services</span></button>
      <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><FaUser /><span>Profile</span></button>
    </nav>
  );
}
