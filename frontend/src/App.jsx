import { useEffect, useState } from "react";
import { apiGet } from "./api/client";
import BottomNav from "./components/BottomNav";
import HomePage from "./pages/HomePage";
import HistoryPage from "./pages/HistoryPage";
import ScanPage from "./pages/ScanPage";
import ServicesPage from "./pages/ServicesPage";
import ProfilePage from "./pages/ProfilePage";
import TopUpPage from "./pages/TopUpPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  const [tab, setTab] = useState("home");
  const [screen, setScreen] = useState("tabs");
  const [telegramId, setTelegramId] = useState("demo_user");
  const [homeData, setHomeData] = useState(null);
  const [history, setHistory] = useState([]);
  const [profile, setProfile] = useState(null);

  const loadAll = async () => {
    const query = `?telegramId=${encodeURIComponent(telegramId)}`;
    const [home, historyData, profileData] = await Promise.all([
      apiGet(`/home${query}`),
      apiGet(`/history${query}`),
      apiGet(`/profile${query}`)
    ]);

    setHomeData(home);
    setHistory(historyData.items || []);
    setProfile(profileData);
  };

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    const id = webApp?.initDataUnsafe?.user?.id;
    if (id) setTelegramId(String(id));
    webApp?.ready?.();
    webApp?.expand?.();

    // Make Telegram system header blend with app theme and request fullscreen where supported.
    try {
      webApp?.setHeaderColor?.("#0b0c0f");
      webApp?.setBackgroundColor?.("#0b0c0f");
      webApp?.requestFullscreen?.();
      webApp?.disableVerticalSwipes?.();
    } catch (error) {
      // Ignore if a Telegram client does not support one of these methods.
      console.debug("WebApp UI methods are partially unsupported:", error);
    }
  }, []);

  useEffect(() => {
    loadAll().catch(console.error);
  }, [telegramId]);

  let content = null;
  if (screen === "topup") {
    content = (
      <TopUpPage
        telegramId={telegramId}
        onBack={() => setScreen("tabs")}
        onTopUpDone={async () => {
          await loadAll();
          setTab("home");
          setScreen("tabs");
        }}
      />
    );
  } else if (screen === "settings") {
    content = <SettingsPage telegramId={telegramId} onBack={() => setScreen("tabs")} />;
  } else {
    if (tab === "home") {
      content = <HomePage homeData={homeData} telegramId={telegramId} onOpenTopUp={() => setScreen("topup")} />;
    }
    if (tab === "history") content = <HistoryPage items={history} />;
    if (tab === "scan") content = <ScanPage telegramId={telegramId} onPaid={loadAll} />;
    if (tab === "services") content = <ServicesPage onOpenSettings={() => setScreen("settings")} />;
    if (tab === "profile") content = <ProfilePage profile={profile} />;
  }

  return (
    <div className="app">
      <main className="content">{content}</main>
      {screen === "tabs" && <BottomNav tab={tab} setTab={setTab} />}
    </div>
  );
}
