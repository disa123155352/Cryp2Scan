export default function HistoryPage({ items }) {
  return (
    <div className="page">
      <h1>History</h1>

      {!items.length ? (
        <section className="card">No operations yet</section>
      ) : (
        <div className="list">
          {items.map((item) => (
            <section className="card" key={item.id}>
              <p><b>{item.storeName}</b></p>
              <p>{new Date(item.date).toLocaleString()}</p>
              <p>RUB {item.amountRub}</p>
              <p>{item.amountUsdt} USDT</p>
              <p className={item.status === "SUCCESS" ? "ok" : "bad"}>{item.status}</p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
