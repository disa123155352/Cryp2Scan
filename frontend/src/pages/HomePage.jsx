import { useState } from "react";
import { apiPost } from "../api/client";

export default function HomePage({ homeData, telegramId, onTopUpDone }) {
  const [amount, setAmount] = useState("50");
  const [status, setStatus] = useState({ type: "", text: "" });

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
      <h1>Cryp2Scan</h1>

      <section className="card balance-card">
        <p className="label">Основной кошелек</p>
        <h2 className="balance-value">{homeData?.balance?.usdt ?? 0} USDT</h2>

        <div className="assets">
          <div className="asset">
            <span>TON</span>
            <span>Неактивно</span>
          </div>
          <div className="asset">
            <span>BTC</span>
            <span>Неактивно</span>
          </div>
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
