import { useEffect, useMemo, useRef, useState } from "react";
import { useTonWallet } from "@tonconnect/ui-react";
import { apiGet } from "../api/client";

async function fetchBalancesFromTonApi(address) {
  if (!address) return { ton: 0, usdt: 0 };

  const accountRes = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}`);
  if (!accountRes.ok) throw new Error("ton_balance_unavailable");
  const accountData = await accountRes.json();
  const ton = Number(accountData?.balance || 0) / 1e9;

  const jettonsRes = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}/jettons`);
  if (!jettonsRes.ok) throw new Error("usdt_balance_unavailable");
  const jettonsData = await jettonsRes.json();
  const balances = Array.isArray(jettonsData?.balances) ? jettonsData.balances : [];
  const usdtRow = balances.find((item) => {
    const symbol = String(item?.jetton?.symbol || "").toUpperCase();
    return symbol === "USDT" || symbol === "USD₮";
  });
  const rawUsdt = Number(usdtRow?.balance || 0);
  const decimals = Number(usdtRow?.jetton?.decimals || 6);
  const usdt = rawUsdt / 10 ** decimals;

  return {
    ton: Number.isFinite(ton) ? +ton.toFixed(6) : 0,
    usdt: Number.isFinite(usdt) ? +usdt.toFixed(6) : 0
  };
}

export default function HomePage({ homeData, telegramId, onOpenTopUp, onOpenSettings }) {
  const [activeBalanceCard, setActiveBalanceCard] = useState(0);
  const [walletStatus, setWalletStatus] = useState({ connected: false, balances: { usdt: 0, ton: 0 }, loading: true });
  const [walletHint, setWalletHint] = useState("");
  const tonWallet = useTonWallet();
  const isWalletConnectedInSdk = Boolean(tonWallet?.account?.address);
  const isWalletConnected = walletStatus.connected || isWalletConnectedInSdk;
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
      setWalletStatus((prev) => ({ ...prev, loading: true }));
      const data = await apiGet(`/wallet/status?telegramId=${encodeURIComponent(telegramId)}`);
      setWalletStatus({
        connected: Boolean(data?.connected),
        balances: data?.balances || { usdt: 0, ton: 0 },
        loading: false
      });
      setWalletHint(data?.warning || "");
    } catch {
      setWalletStatus({ connected: false, balances: { usdt: 0, ton: 0 }, loading: false });
      setWalletHint("");
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

  useEffect(() => {
    const syncDirectBalance = async () => {
      const walletAddress = tonWallet?.account?.address;
      if (!walletAddress) return;
      try {
        const liveBalances = await fetchBalancesFromTonApi(walletAddress);
        setWalletStatus((prev) => ({
          ...prev,
          connected: true,
          loading: false,
          balances: liveBalances
        }));
        setWalletHint("");
      } catch {
        if (!walletHint) {
          setWalletHint("Баланс временно недоступен");
        }
      }
    };

    syncDirectBalance();
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

      {!isWalletConnected && (
        <section className="card home-wallet-prompt">
          <div>
            <p className="label">Кошелек</p>
            <p className="home-wallet-prompt-title">Подключите Telegram Wallet</p>
            <p className="home-wallet-prompt-sub">Чтобы видеть реальный TON/USDT баланс</p>
          </div>
          <button type="button" className="primary-btn home-wallet-prompt-btn" onClick={onOpenSettings}>
            Подключить
          </button>
        </section>
      )}

      {isWalletConnected && walletHint && <p className="home-status">{walletHint}</p>}
      {isWalletConnected && walletStatus.loading && <p className="home-status">Обновляем баланс...</p>}

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
