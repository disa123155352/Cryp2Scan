import { useEffect, useRef, useState } from "react";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { apiGet, apiPost } from "../api/client";

export default function SettingsPage({ telegramId, onBack }) {
  const [tonConnectUI] = useTonConnectUI();
  const tonWallet = useTonWallet();
  const prevAddressRef = useRef("");
  const [status, setStatus] = useState({ connected: false, loading: true, walletAddress: "" });
  const [infoText, setInfoText] = useState("");

  const loadStatus = async () => {
    try {
      setStatus((prev) => ({ ...prev, loading: true }));
      const data = await apiGet(`/wallet/status?telegramId=${encodeURIComponent(telegramId)}`);
      setStatus({
        connected: Boolean(data?.connected),
        loading: false,
        walletAddress: data?.walletAddress || ""
      });
    } catch {
      setStatus({ connected: false, loading: false, walletAddress: "" });
    }
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telegramId]);

  useEffect(() => {
    const syncAddress = async () => {
      const currentAddress = tonWallet?.account?.address || "";
      const prevAddress = prevAddressRef.current;
      if (!currentAddress || currentAddress === prevAddress) return;
      try {
        await apiPost("/wallet/connect", {
          telegramId,
          walletAddress: currentAddress,
          network: tonWallet?.account?.chain || "mainnet"
        });
        setInfoText("Кошелек подключен");
      } catch {
        setInfoText("Кошелек подключен, но синхронизация с сервером не удалась");
      }
      prevAddressRef.current = currentAddress;
      await loadStatus();
    };

    syncAddress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tonWallet?.account?.address, telegramId]);

  const connectWallet = async () => {
    try {
      setInfoText("");
      await tonConnectUI.openModal();
    } catch {
      setInfoText("Ошибка подключения. Попробуйте снова.");
    }
  };

  const disconnectWallet = async () => {
    try {
      setInfoText("");
      // Disconnect in UI provider can fail in some clients. In that case we still clean backend binding.
      try {
        await tonConnectUI.disconnect();
      } catch {
        // ignore provider disconnect error
      }
      await apiPost("/wallet/disconnect", { telegramId });
      prevAddressRef.current = "";
      setStatus({ connected: false, loading: false, walletAddress: "" });
      setInfoText("Кошелек отключен");
    } catch {
      setInfoText("Ошибка отключения. Попробуйте снова.");
    }
  };

  return (
    <div className="page settings-page">
      <button type="button" className="topup-back" onClick={onBack}>← Назад</button>
      <h1>Настройки</h1>

      <section className="card settings-card">
        <p className="label">Кошелек Telegram</p>
        {status.loading ? (
          <p className="settings-line">Проверяем статус...</p>
        ) : (
          <>
            <p className="settings-line">
              {status.connected ? "Подключен" : "Не подключен"}
            </p>
            {status.walletAddress && <p className="wallet-connect-address">{status.walletAddress}</p>}
          </>
        )}

        {status.connected ? (
          <button type="button" className="secondary-btn settings-btn" onClick={disconnectWallet}>
            Отключить кошелек
          </button>
        ) : (
          <button type="button" className="primary-btn settings-btn" onClick={connectWallet}>
            Подключить кошелек
          </button>
        )}

        {infoText && <p className="wallet-connect-sync">{infoText}</p>}
      </section>
    </div>
  );
}
