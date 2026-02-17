import { useEffect, useState } from "react";
import { apiGet, apiPost } from "./api/client";
import BottomNav from "./components/BottomNav";
import HomePage from "./pages/HomePage";
import HistoryPage from "./pages/HistoryPage";
import ScanPage from "./pages/ScanPage";
import ServicesPage from "./pages/ServicesPage";
import ProfilePage from "./pages/ProfilePage";
import TopUpPage from "./pages/TopUpPage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";
import InvestorPitchPage from "./pages/InvestorPitchPage";

function getTelegramUserIdFromInitData(initDataRaw = "") {
  try {
    const params = new URLSearchParams(initDataRaw);
    const userRaw = params.get("user");
    if (!userRaw) return "";
    const user = JSON.parse(userRaw);
    return user?.id ? String(user.id) : "";
  } catch {
    return "";
  }
}

function getTelegramUserIdFallbackFromUrl() {
  try {
    const fromSearch = new URLSearchParams(window.location.search);
    const hashRaw = window.location.hash?.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash || "";
    const fromHash = new URLSearchParams(hashRaw);

    const directId = fromSearch.get("tg_id") || fromHash.get("tg_id");
    if (directId) return String(directId);

    const tgWebAppData = fromSearch.get("tgWebAppData") || fromHash.get("tgWebAppData");
    if (!tgWebAppData) return "";
    return getTelegramUserIdFromInitData(tgWebAppData);
  } catch {
    return "";
  }
}

export default function App() {
  const [tab, setTab] = useState("home");
  const [screen, setScreen] = useState("tabs");
  const [telegramId, setTelegramId] = useState("");
  const [telegramReady, setTelegramReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
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

  const loadAdminAccess = async () => {
    const query = `?telegramId=${encodeURIComponent(telegramId)}`;
    try {
      const access = await apiGet(`/admin/access${query}`);
      setIsAdmin(Boolean(access?.allowed));
    } catch {
      setIsAdmin(false);
    }
  };

  const runDemoPayment = async (demoOptions = {}) => {
    if (!telegramId) {
      return { ok: false, message: "Telegram ID не найден" };
    }

    try {
      const result = await apiPost("/demo/run", { telegramId, ...demoOptions });
      await loadAll();
      return { ok: true, result };
    } catch (error) {
      return { ok: false, message: error?.message || "Не удалось запустить demo" };
    }
  };

  const resetDemoPayment = async () => {
    if (!telegramId) {
      return { ok: false, message: "Telegram ID не найден" };
    }

    try {
      const result = await apiPost("/demo/reset", { telegramId });
      await loadAll();
      return { ok: true, result };
    } catch (error) {
      return { ok: false, message: error?.message || "Не удалось сбросить demo" };
    }
  };

  useEffect(() => {
    let attempts = 0;
    let stopped = false;

    const tryResolveTelegramId = () => {
      if (stopped) return;
      attempts += 1;

      const webApp = window.Telegram?.WebApp;
      const idFromUnsafe = webApp?.initDataUnsafe?.user?.id ? String(webApp.initDataUnsafe.user.id) : "";
      const idFromInitData = getTelegramUserIdFromInitData(webApp?.initData || "");
      const idFromUrl = getTelegramUserIdFallbackFromUrl();
      const resolvedId = idFromUnsafe || idFromInitData || idFromUrl;

      webApp?.ready?.();
      webApp?.expand?.();

      if (resolvedId) {
        setTelegramId(resolvedId);
        setTelegramReady(true);
        return;
      }

      if (attempts >= 30) {
        setTelegramReady(true);
        return;
      }

      setTimeout(tryResolveTelegramId, 300);
    };

    tryResolveTelegramId();

    // Make Telegram system header blend with app theme and request fullscreen where supported.
    try {
      const webApp = window.Telegram?.WebApp;
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const topInsetFromTelegram = Number(
        webApp?.contentSafeAreaInset?.top ?? webApp?.safeAreaInset?.top ?? 0
      );
      const fallbackTopInset = isIOS ? 52 : 20;
      const topInset = Math.max(topInsetFromTelegram, fallbackTopInset);
      document.documentElement.style.setProperty("--tg-top-offset", `${topInset}px`);

      webApp?.setHeaderColor?.("#0b0c0f");
      webApp?.setBackgroundColor?.("#0b0c0f");
      webApp?.disableVerticalSwipes?.();
    } catch (error) {
      // Ignore if a Telegram client does not support one of these methods.
      console.debug("WebApp UI methods are partially unsupported:", error);
    }

    return () => {
      stopped = true;
    };
  }, []);

  useEffect(() => {
    if (!telegramId) return;
    loadAll().catch(console.error);
    loadAdminAccess().catch(console.error);
  }, [telegramId]);

  let content = null;
  if (!telegramId) {
    content = (
      <div className="page">
        <section className="card">
          {telegramReady
            ? "Не удалось определить Telegram ID. Откройте мини-приложение через бота в Telegram."
            : "Загружаем данные Telegram..."}
        </section>
      </div>
    );
  } else if (screen === "topup") {
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
  } else if (screen === "pitch") {
    content = <InvestorPitchPage historyItems={history} onBack={() => setScreen("tabs")} />;
  } else if (screen === "admin") {
    content = isAdmin ? (
      <AdminPage telegramId={telegramId} onBack={() => setScreen("tabs")} />
    ) : (
      <div className="page">
        <section className="card bad">Нет доступа к админке</section>
      </div>
    );
  } else {
    if (tab === "home") {
      content = (
        <HomePage
          homeData={homeData}
          historyItems={history}
          telegramId={telegramId}
          onOpenTopUp={() => setScreen("topup")}
          onOpenSettings={() => setScreen("settings")}
          onOpenPitch={() => setScreen("pitch")}
          onRunDemo={runDemoPayment}
          onResetDemo={resetDemoPayment}
          onOpenHistory={() => setTab("history")}
        />
      );
    }
    if (tab === "history") content = <HistoryPage items={history} />;
    if (tab === "scan") content = <ScanPage telegramId={telegramId} onPaid={loadAll} />;
    if (tab === "services") {
      content = (
        <ServicesPage
          isAdmin={isAdmin}
          onOpenSettings={() => setScreen("settings")}
          onOpenAdmin={() => {
            if (isAdmin) setScreen("admin");
          }}
        />
      );
    }
    if (tab === "profile") content = <ProfilePage profile={profile} />;
  }

  return (
    <div className="app">
      <main className="content">{content}</main>
      {telegramId && screen === "tabs" && <BottomNav tab={tab} setTab={setTab} />}
    </div>
  );
}
