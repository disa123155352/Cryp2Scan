export default function HistoryPage({ items }) {
  const shortHash = (value) => {
    const hash = String(value || "");
    if (!hash) return "";
    if (hash.length < 22) return hash;
    return `${hash.slice(0, 10)}...${hash.slice(-10)}`;
  };

  const toStatus = (status) => {
    if (status === "SUCCESS") return "Успешно";
    if (status === "FAILED") return "Ошибка";
    if (status === "PROCESSING") return "В процессе";
    return status;
  };

  const statusClass = (status) => {
    if (status === "SUCCESS") return "ok";
    if (status === "FAILED") return "bad";
    return "label";
  };

  const toCryptoStatus = (value) => {
    if (value === "CONFIRMED") return "Подтверждена";
    if (value === "FAILED") return "Ошибка";
    if (value === "PROCESSING") return "В процессе";
    return value || "—";
  };

  const toPayoutStatus = (value) => {
    if (value === "SUCCESS") return "Отправлена";
    if (value === "FAILED") return "Ошибка";
    if (value === "PROCESSING") return "В обработке";
    return value || "—";
  };

  return (
    <div className="page">
      {!items.length ? (
        <section className="card">Операций пока нет</section>
      ) : (
        <div className="list history-list">
          {items.map((item) => (
            <section className="card history-card" key={item.id}>
              <p><b>{item.storeName}</b></p>
              <p>{new Date(item.date).toLocaleString("ru-RU")}</p>
              <p>{Number(item.amountRub) > 0 ? `₽ ${item.amountRub}` : "Без суммы в ₽"}</p>
              <p>{item.storeName === "Пополнение баланса" ? `+${item.amountUsdt} USDT` : `${item.amountUsdt} USDT`}</p>
              {item.paymentMethod === "crypto_vasp" && <p><b>TON:</b> {item.amountTon}</p>}
              {item.paymentMethod === "crypto_vasp" && <p><b>Крипто-этап:</b> {toCryptoStatus(item.cryptoStatus)}</p>}
              {item.paymentMethod === "crypto_vasp" && <p><b>Выплата ₽ (СБП):</b> {toPayoutStatus(item.payoutStatus)}</p>}
              {item.payoutReference && <p><b>SBP Ref:</b> {item.payoutReference}</p>}
              {item.txHash && <p className="history-tx-hash"><b>Hash:</b> {shortHash(item.txHash)}</p>}
              <p className={statusClass(item.status)}>{toStatus(item.status)}</p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
