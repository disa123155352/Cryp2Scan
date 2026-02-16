import { useState } from "react";
import { apiPost } from "../api/client";

export default function HomePage({ homeData, telegramId, onTopUpDone }) {
  const [amount, setAmount] = useState("100");
  const [status, setStatus] = useState({ type: "", text: "" });
  const [activeBalanceCard, setActiveBalanceCard] = useState(0);
  const shortId = telegramId?.slice(-6) || "000000";
  const balances = homeData?.balance || {};

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

      <section className="home-search">Поиск по операциям</section>

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
        <button type="button" className="action-btn">
          <span>⌗</span>
          <small>Скан</small>
        </button>
      </section>

      <section className="wallet-slider-wrap">
        <p className="label">Кошелек</p>
        <div className="wallet-slider" onScroll={onBalanceScroll}>
          {balanceCards.map((card) => (
            <article className="wallet-card" key={card.code}>
              <p className="wallet-card-code">{card.code}</p>
              <h2 className="wallet-card-value">{card.amount} {card.code}</h2>
              <span className="wallet-card-caption">{card.caption}</span>
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
