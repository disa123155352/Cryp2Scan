import { useMemo, useState } from "react";
import { apiPost } from "../api/client";

const paymentMethods = [
  { id: "sbp", title: "СБП", subtitle: "Мгновенно, без комиссии" },
  { id: "card", title: "Банковская карта", subtitle: "Visa / Mastercard / Мир" },
  { id: "wallet", title: "Внутренний кошелек", subtitle: "Перевод из другого кошелька" }
];

const presetValues = [50, 100, 250, 500];

export default function TopUpPage({ telegramId, onBack, onTopUpDone }) {
  const [method, setMethod] = useState("sbp");
  const [amount, setAmount] = useState("100");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", text: "" });

  const amountNumber = useMemo(() => Number(amount), [amount]);
  const canSubmit = Number.isFinite(amountNumber) && amountNumber > 0 && !isLoading;

  const submitTopUp = async () => {
    if (!canSubmit) return;
    try {
      setIsLoading(true);
      setStatus({ type: "label", text: "Выполняем пополнение..." });
      await apiPost("/topup", {
        telegramId,
        amountUsdt: amountNumber
      });
      setStatus({ type: "ok", text: `Успешно: +${amountNumber} USDT` });
      await onTopUpDone?.();
    } catch {
      setStatus({ type: "bad", text: "Не удалось пополнить. Попробуйте снова." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page topup-page">
      <section className="topup-header">
        <button type="button" className="topup-back" onClick={onBack}>← Назад</button>
        <h1>Пополнение</h1>
        <p>Выберите удобный способ и сумму</p>
      </section>

      <section className="card topup-methods">
        <p className="label">Способ оплаты</p>
        <div className="topup-methods-list">
          {paymentMethods.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`topup-method ${method === item.id ? "active" : ""}`}
              onClick={() => setMethod(item.id)}
            >
              <div>
                <p>{item.title}</p>
                <span>{item.subtitle}</span>
              </div>
              <i />
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <p className="label">Сумма (USDT)</p>
        <div className="topup-presets">
          {presetValues.map((value) => (
            <button
              key={value}
              type="button"
              className={Number(amount) === value ? "active" : ""}
              onClick={() => setAmount(String(value))}
            >
              {value}
            </button>
          ))}
        </div>
        <input
          className="input"
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Введите сумму"
        />
        <div className="topup-summary">
          <p>
            <span>Вы выбрали:</span>
            <b>{Number.isFinite(amountNumber) && amountNumber > 0 ? `${amountNumber} USDT` : "—"}</b>
          </p>
          <p>
            <span>Комиссия:</span>
            <b>0 USDT</b>
          </p>
        </div>
        <button type="button" className="primary-btn topup-submit" disabled={!canSubmit} onClick={submitTopUp}>
          {isLoading ? "Обработка..." : "Подтвердить пополнение"}
        </button>
        {status.text && <p className={`home-status ${status.type}`}>{status.text}</p>}
      </section>
    </div>
  );
}
