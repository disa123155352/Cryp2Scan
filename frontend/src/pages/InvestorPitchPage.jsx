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

  const flow = [
    {
      title: "Клиент сканирует QR",
      text: "Покупатель подтверждает оплату в приложении одним нажатием."
    },
    {
      title: "Списание криптовалюты",
      text: "USDT или TON списываются с кошелька клиента по курсу момента."
    },
    {
      title: "Конвертация в рубли",
      text: "Сумма автоматически пересчитывается в ₽ через партнера."
    },
    {
      title: "Выплата магазину",
      text: "Магазин получает рубли по СБП как обычный платеж."
    }
  ];

  return (
    <div className="page pitch-page">
      <button type="button" className="topup-back" onClick={onBack}>← Назад</button>
      <h1>Презентация для инвестора</h1>

      <section className="card pitch-hero">
        <div className="pitch-hero-top">
          <p className="label pitch-hero-label">Cryp2Scan • Инвест-демо</p>
          <span className="pitch-hero-chip">Прототип</span>
        </div>
        <p className="label">Ключевая ценность</p>
        <h2>Клиент платит криптой, магазин получает рубли</h2>
        <p>
          Мы убираем барьер между криптой и обычной кассой: платеж проходит в привычных ₽, без изменения процессов магазина.
        </p>
        <div className="pitch-tags">
          <span>USDT / TON</span>
          <span>Онлайн-конвертация</span>
          <span>Выплата по СБП</span>
        </div>
      </section>

      <section className="card pitch-flow">
        <p className="label">Платежная цепочка</p>
        <div className="pitch-flow-grid">
          {flow.map((item, index) => (
            <article key={item.title} className="pitch-flow-item">
              <span className="pitch-flow-step">{index + 1}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="pitch-grid">
        <article className="card pitch-item">
          <p className="label">Проблема</p>
          <h3>Крипту сложно тратить в быту</h3>
          <p>У держателей крипты мало сценариев оплаты в офлайн-ритейле.</p>
        </article>
        <article className="card pitch-item">
          <p className="label">Решение</p>
          <h3>Единый QR-сценарий</h3>
          <p>Списываем USDT/TON, конвертируем и отправляем магазину ₽ по СБП.</p>
        </article>
        <article className="card pitch-item">
          <p className="label">Модель дохода</p>
          <h3>Комиссия + сервис</h3>
          <p>Зарабатываем на каждой операции и на B2B-тарифах для мерчантов.</p>
        </article>
        <article className="card pitch-item">
          <p className="label">Для кого</p>
          <h3>Ритейл с частыми чеками</h3>
          <p>Сети магазинов, АЗС, кофейни и e-commerce с большим потоком оплат.</p>
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
