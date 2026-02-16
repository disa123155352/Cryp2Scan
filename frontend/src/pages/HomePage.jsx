import { useEffect, useMemo, useRef, useState } from "react";
import { useTonWallet } from "@tonconnect/ui-react";
import { apiGet } from "../api/client";

export default function HomePage({ homeData, telegramId, onOpenTopUp }) {
  const [activeBalanceCard, setActiveBalanceCard] = useState(0);
  const [walletStatus, setWalletStatus] = useState({ connected: false, balances: { usdt: 0, ton: 0 } });
  const tonWallet = useTonWallet();
  const isWalletConnectedInSdk = Boolean(tonWallet?.account?.address);
  const shortId = telegramId?.slice(-6) || "000000";
  const onchainBalances = walletStatus?.balances || {};
  const previousTonAddress = useRef("");

  const balances = useMemo(() => ({
    usdt: (walletStatus.connected || isWalletConnectedInSdk) ? Number(onchainBalances.usdt || 0) : 0,
    ton: (walletStatus.connected || isWalletConnectedInSdk) ? Number(onchainBalances.ton || 0) : 0,
    btc: 0
  }), [walletStatus.connected, isWalletConnectedInSdk, onchainBalances.usdt, onchainBalances.ton]);

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
      const data = await apiGet(`/wallet/status?telegramId=${encodeURIComponent(telegramId)}`);
      setWalletStatus({
        connected: Boolean(data?.connected),
        balances: data?.balances || { usdt: 0, ton: 0 }
      });
    } catch {
      setWalletStatus({ connected: false, balances: { usdt: 0, ton: 0 } });
    }
  };

  useEffect(() => {
    loadWalletStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telegramId]);

  useEffect(() => {
    const currentTonAddress = tonWallet?.account?.address || "";
    const previousAddress = previousTonAddress.current;
    if (currentTonAddress !== previousAddress) {
      loadWalletStatus();
    }
    previousTonAddress.current = currentTonAddress;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tonWallet?.account?.address]);

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
