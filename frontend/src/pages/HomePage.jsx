import { useEffect, useMemo, useRef, useState } from "react";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { apiGet, apiPost } from "../api/client";

export default function HomePage({ homeData, telegramId, onOpenTopUp }) {
  const [activeBalanceCard, setActiveBalanceCard] = useState(0);
  const [walletStatus, setWalletStatus] = useState({ connected: false, loading: true });
  const [walletSyncStatus, setWalletSyncStatus] = useState("");
  const [tonConnectUI] = useTonConnectUI();
  const tonWallet = useTonWallet();
  const previousTonAddress = useRef("");
  const isWalletConnectedInSdk = Boolean(tonWallet?.account?.address);
  const shortId = telegramId?.slice(-6) || "000000";
  const backendBalances = homeData?.balance || {};
  const onchainBalances = walletStatus?.balances || {};

  const balances = useMemo(() => ({
    usdt: (walletStatus.connected || isWalletConnectedInSdk) ? Number(onchainBalances.usdt || 0) : Number(backendBalances.usdt || 0),
    ton: (walletStatus.connected || isWalletConnectedInSdk) ? Number(onchainBalances.ton || 0) : Number(backendBalances.ton || 0),
    btc: Number(backendBalances.btc || 0)
  }), [walletStatus.connected, isWalletConnectedInSdk, onchainBalances.usdt, onchainBalances.ton, backendBalances.usdt, backendBalances.ton, backendBalances.btc]);

  const rateByCode = { USDT: 100, TON: 300, BTC: 9000000 };

  const balanceCards = [
    {
      code: "USDT",
      amount: Number(balances.usdt || 0),
      caption: "Основной баланс"
    },
    {
      code: "TON",
      amount: Number(balances.ton || 0),
      caption: "Вторичный баланс"
    },
    {
      code: "BTC",
      amount: Number(balances.btc || 0),
      caption: "Вторичный баланс"
    }
  ];

  const onBalanceScroll = (event) => {
    const container = event.currentTarget;
    const cardWidth = container.clientWidth;
    if (!cardWidth) return;
    const index = Math.round(container.scrollLeft / cardWidth);
    setActiveBalanceCard(index);
  };

  const formatNumber = (value) =>
    Number(value || 0).toLocaleString("ru-RU", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2
    });

  const loadWalletStatus = async () => {
    try {
      setWalletStatus((previous) => ({ ...previous, loading: true }));
      const data = await apiGet(`/wallet/status?telegramId=${encodeURIComponent(telegramId)}`);
      setWalletStatus({ ...data, loading: false });
      if (data?.warning) {
        setWalletSyncStatus(data.warning);
      }
    } catch {
      setWalletStatus({ connected: false, loading: false });
    }
  };

  useEffect(() => {
    loadWalletStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telegramId]);

  useEffect(() => {
    const syncWalletState = async () => {
      const currentTonAddress = tonWallet?.account?.address || "";
      const previousAddress = previousTonAddress.current;

      if (currentTonAddress && currentTonAddress !== previousAddress) {
        try {
          setWalletSyncStatus("Подключаем кошелек...");
          await apiPost("/wallet/connect", {
            telegramId,
            walletAddress: currentTonAddress,
            network: tonWallet?.account?.chain || "mainnet"
          });
          try {
            await loadWalletStatus();
          } catch {
            // fallback handled below
          }
          setWalletStatus((prev) => ({
            ...prev,
            connected: true,
            walletAddress: currentTonAddress
          }));
          setWalletSyncStatus("Кошелек подключен");
        } catch {
          setWalletSyncStatus("Ошибка подключения кошелька");
        }
      }

      if (!currentTonAddress && previousAddress) {
        try {
          setWalletSyncStatus("Отключаем кошелек...");
          await apiPost("/wallet/disconnect", { telegramId });
          await loadWalletStatus();
          setWalletSyncStatus("Кошелек отключен");
        } catch {
          setWalletSyncStatus("Ошибка отключения кошелька");
        }
      }

      previousTonAddress.current = currentTonAddress;
    };

    syncWalletState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tonWallet?.account?.address, telegramId]);

  const openWalletConnectModal = async () => {
    await tonConnectUI.openModal();
  };

  const disconnectWallet = async () => {
    try {
      setWalletSyncStatus("Отключаем кошелек...");
      await tonConnectUI.disconnect();
      await apiPost("/wallet/disconnect", { telegramId });
      await loadWalletStatus();
      previousTonAddress.current = "";
      setWalletSyncStatus("Кошелек отключен");
    } catch {
      setWalletSyncStatus("Не удалось отключить кошелек");
    }
  };

  return (
    <div className="page">
      <section className="home-profile">
        <div className="home-user">
          <div className="home-avatar">N</div>
          <div>
            <p className="home-name">Владелец счета</p>
            <p className="home-sub">ID {shortId}</p>
          </div>
        </div>
        <div className="home-badge">CRYP2SCAN</div>
      </section>

      <section className="card wallet-connect-card">
        <div>
          <p className="label">Telegram Wallet</p>
          <p className="wallet-connect-title">
            {walletStatus.loading
              ? "Проверяем подключение..."
              : (walletStatus.connected || isWalletConnectedInSdk)
                ? "Кошелек подключен"
                : "Кошелек не подключен"}
          </p>
          {(walletStatus.connected || isWalletConnectedInSdk) && (walletStatus.walletAddress || tonWallet?.account?.address) && (
            <p className="wallet-connect-address">{walletStatus.walletAddress || tonWallet?.account?.address}</p>
          )}
          {walletSyncStatus && <p className="wallet-connect-sync">{walletSyncStatus}</p>}
        </div>
        {(walletStatus.connected || isWalletConnectedInSdk) ? (
          <button type="button" className="secondary-btn wallet-connect-btn" onClick={disconnectWallet}>
            Отключить
          </button>
        ) : (
          <button type="button" className="primary-btn wallet-connect-btn" onClick={openWalletConnectModal}>
            Подключить
          </button>
        )}
      </section>

      <section className="home-mini-cards">
        <article className="mini-card">
          <p>Все операции</p>
          <h3>₽ 0</h3>
          <span>Общие траты за месяц</span>
        </article>
        <article className="mini-card">
          <p>Кэшбэк и бонусы</p>
          <h3>0</h3>
          <span>Пока начислений нет</span>
        </article>
      </section>

      <section className="home-actions">
        <button type="button" className="action-btn action-btn-primary" onClick={onOpenTopUp}>
          <span>＋</span>
          <small>Пополнить</small>
        </button>
        <button type="button" className="action-btn">
          <span>↗</span>
          <small>Перевести</small>
        </button>
        <button type="button" className="action-btn">
          <span>⇄</span>
          <small>Обменять</small>
        </button>
      </section>

      <section className="wallet-slider-wrap">
        <p className="label">Кошелек</p>
        <div className="wallet-slider" onScroll={onBalanceScroll}>
          {balanceCards.map((card) => (
            <article className="wallet-card" key={card.code}>
              <div className="wallet-row">
                <div className="wallet-left">
                  <div>
                    <p className="wallet-card-code">{card.code}</p>
                    <span className="wallet-card-caption">
                      {card.code === "USDT" ? "Основной баланс" : "Дополнительный баланс"}
                    </span>
                  </div>
                </div>
                <div className="wallet-right">
                  <p className="wallet-rub">{formatNumber(card.amount * (rateByCode[card.code] || 0))} ₽</p>
                  <p className="wallet-asset">{formatNumber(card.amount)} {card.code}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="wallet-dots">
          {balanceCards.map((card, index) => (
            <span
              key={card.code}
              className={`wallet-dot ${activeBalanceCard === index ? "active" : ""}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
