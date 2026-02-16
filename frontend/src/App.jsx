import { useEffect, useState } from "react";
import { apiGet } from "./api/client";
import BottomNav from "./components/BottomNav";
import HomePage from "./pages/HomePage";
import HistoryPage from "./pages/HistoryPage";
import ScanPage from "./pages/ScanPage";
import ServicesPage from "./pages/ServicesPage";
import ProfilePage from "./pages/ProfilePage";

export default function App() {
  const [tab, setTab] = useState("home");
  const [homeData, setHomeData] = useState(null);
  const [history, setHistory] = useState([]);
  const [profile, setProfile] = useState(null);

  const loadAll = async () => {
    const [home, historyData, profileData] = await Promise.all([
      apiGet("/home"),
      apiGet("/history"),
      apiGet("/profile?telegramId=demo_user")
    ]);

    setHomeData(home);
    setHistory(historyData.items || []);
    setProfile(profileData);
  };

  useEffect(() => {
    loadAll().catch(console.error);
  }, []);

  let content = null;
  if (tab === "home") content = <HomePage homeData={homeData} />;
  if (tab === "history") content = <HistoryPage items={history} />;
  if (tab === "scan") content = <ScanPage onPaid={loadAll} />;
  if (tab === "services") content = <ServicesPage />;
  if (tab === "profile") content = <ProfilePage profile={profile} />;

  return (
    <div className="app">
      <main className="content">{content}</main>
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}
