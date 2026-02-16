import { useState } from "react";
import { apiPost } from "../api/client";

export default function HomePage({ homeData, telegramId, onTopUpDone }) {
  const [amount, setAmount] = useState("50");
  const [status, setStatus] = useState("");

  const topUp = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setStatus("Enter valid amount");
      return;
    }

    try {
      setStatus("Processing...");
      await apiPost("/topup", { telegramId, amountUsdt: value });
      setStatus("Top up success");
      onTopUpDone?.();
    } catch {
      setStatus("Top up failed");
    }
  };

  return (
    <div className="page">
      <h1>Cryp2Scan</h1>

      <section className="card">
        <p className="label">Main Balance</p>
        <h2>{homeData?.balance?.usdt ?? 0} USDT</h2>

        <div className="assets">
          <div className="asset">
            <span>TON</span>
            <span>Inactive</span>
          </div>
          <div className="asset">
            <span>BTC</span>
            <span>Inactive</span>
          </div>
        </div>

        <p className="label">Top Up (USDT)</p>
        <input
          className="input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="Amount"
        />
        <button className="primary-btn" type="button" onClick={topUp}>Top Up</button>
        {status && <p className={status.includes("success") ? "ok" : status.includes("failed") ? "bad" : ""}>{status}</p>}
      </section>
    </div>
  );
}
