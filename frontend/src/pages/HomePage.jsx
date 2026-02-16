import { useState } from "react";
import { apiPost } from "../api/client";

export default function HomePage({ homeData, telegramId, onTopUpDone }) {
  const [amount, setAmount] = useState("100");
  const [status, setStatus] = useState({ type: "", text: "" });
  const [activeBalanceCard, setActiveBalanceCard] = useState(0);
  const shortId = telegramId?.slice(-6) || "000000";
  const balances = homeData?.balance || {};
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

  const topUp = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setStatus({ type: "bad", text: "Введите корректную сумму" });
      return;
    }

    try {
      setStatus({ type: "label", text: "Пополнение..." });
      await apiPost("/topup", { telegramId, amountUsdt: value });
      setStatus({ type: "ok", text: "Баланс успешно пополнен" });
      onTopUpDone?.();
    } catch {
      setStatus({ type: "bad", text: "Ошибка пополнения" });
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

      <section className="home-actions">
        <button type="button" className="action-btn" onClick={topUp}>
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
                  <div className={`wallet-coin ${card.code.toLowerCase()}`}>{card.code.slice(0, 1)}</div>
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

      <section className="card">
        <p className="label">Пополнение (USDT)</p>
        <input
          className="input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="Сумма"
        />
        <button className="primary-btn" type="button" onClick={topUp}>Пополнить</button>
        {status.text && <p className={status.type}>{status.text}</p>}
      </section>
    </div>
  );
}
