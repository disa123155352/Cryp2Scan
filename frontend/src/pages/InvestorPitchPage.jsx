import { useMemo } from "react";

function toMoney(value) {
  return Number(value || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function toPercent(value) {
  return Number(value || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

export default function InvestorPitchPage({ historyItems = [], onBack }) {
  const metrics = useMemo(() => {
    const paid = historyItems.filter((item) => {
      const ok = String(item?.status || "") === "SUCCESS";
      const rub = Number(item?.amountRub || 0);
      const method = String(item?.paymentMethod || "");
      return ok && rub > 0 && method !== "topup";
    });

    const totalRub = paid.reduce((sum, item) => sum + Number(item?.amountRub || 0), 0);
    const cryptoCount = paid.filter((item) => String(item?.paymentMethod || "") === "crypto_vasp").length;
    const avgCheck = paid.length ? totalRub / paid.length : 0;
    const cryptoShare = paid.length ? (cryptoCount / paid.length) * 100 : 0;

    return {
      totalRub,
      totalCount: paid.length,
      avgCheck,
      cryptoShare
    };
  }, [historyItems]);

  return (
    <div className="page pitch-page">
      <button type="button" className="topup-back" onClick={onBack}>← Назад</button>
      <h1>Презентация для инвестора</h1>

      <section className="card pitch-hero">
        <p className="label">Ключевая ценность</p>
        <h2>Клиент платит криптой, магазин получает рубли</h2>
        <p>
          Мы убираем барьер между криптой и обычной кассой: платеж проходит в привычных ₽, без изменения процессов магазина.
        </p>
      </section>

      <section className="pitch-grid">
        <article className="card pitch-item">
          <p className="label">Проблема</p>
          <p>У держателей крипты сложно потратить активы в офлайн-ритейле.</p>
        </article>
        <article className="card pitch-item">
          <p className="label">Решение</p>
          <p>QR-оплата: списываем USDT/TON, конвертируем, отправляем магазину ₽ по СБП.</p>
        </article>
        <article className="card pitch-item">
          <p className="label">Модель дохода</p>
          <p>Комиссия с каждой операции и сервисные тарифы для мерчантов.</p>
        </article>
        <article className="card pitch-item">
          <p className="label">Для кого</p>
          <p>Сети магазинов, АЗС, кофейни и онлайн-мерчанты с высоким потоком чеков.</p>
        </article>
      </section>

      <section className="card pitch-metrics">
        <p className="label">Текущие демо-показатели</p>
        <div className="pitch-metrics-grid">
          <article>
            <span>Оборот</span>
            <b>₽ {toMoney(metrics.totalRub)}</b>
          </article>
          <article>
            <span>Операций</span>
            <b>{metrics.totalCount}</b>
          </article>
          <article>
            <span>Средний чек</span>
            <b>₽ {toMoney(metrics.avgCheck)}</b>
          </article>
          <article>
            <span>Доля крипто-оплат</span>
            <b>{toPercent(metrics.cryptoShare)}%</b>
          </article>
        </div>
      </section>

    </div>
  );
}
