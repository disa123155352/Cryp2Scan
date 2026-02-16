export default function HistoryPage({ items }) {
  const toStatus = (status) => {
    if (status === "SUCCESS") return "Успешно";
    if (status === "FAILED") return "Ошибка";
    return status;
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
              <p className={item.status === "SUCCESS" ? "ok" : "bad"}>{toStatus(item.status)}</p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
