export default function HomePage({ homeData }) {
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

        <button className="primary-btn" type="button">Top Up</button>
      </section>
    </div>
  );
}
