import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api/client";

function shortValue(value = "", start = 8, end = 8) {
  const text = String(value || "");
  if (!text) return "—";
  if (text.length <= start + end + 3) return text;
  return `${text.slice(0, start)}...${text.slice(-end)}`;
}

function toDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU");
}

function toStatusLabel(value) {
  if (value === "SUCCESS") return "Успешно";
  if (value === "FAILED") return "Ошибка";
  if (value === "PROCESSING") return "В процессе";
  if (!value) return "—";
  return value;
}

export default function AdminPage({ telegramId, onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);

  const [draftFilters, setDraftFilters] = useState({
    merchantId: "",
    status: "",
    payoutStatus: ""
  });
  const [filters, setFilters] = useState({
    merchantId: "",
    status: "",
    payoutStatus: ""
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ telegramId });
    if (filters.merchantId) params.set("merchantId", filters.merchantId);
    if (filters.status) params.set("status", filters.status);
    if (filters.payoutStatus) params.set("payoutStatus", filters.payoutStatus);
    params.set("limit", "200");
    return params.toString();
  }, [telegramId, filters]);

  const loadAdminData = async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryRes, txRes] = await Promise.all([
        apiGet(`/admin/summary?${queryString}`),
        apiGet(`/admin/transactions?${queryString}`)
      ]);
      setSummary(summaryRes.summary || null);
      setItems(txRes.items || []);
    } catch (requestError) {
      const message = String(requestError?.message || "");
      if (message.includes("403")) {
        setError("Доступ в админку запрещен. Добавьте ваш ID Telegram в переменную ADMIN_TELEGRAM_IDS на Render.");
      } else {
        setError("Не удалось загрузить админку");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!telegramId) return;
    loadAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telegramId, queryString]);

  const applyFilters = () => {
    setFilters({ ...draftFilters });
  };

  const resetFilters = () => {
    const empty = { merchantId: "", status: "", payoutStatus: "" };
    setDraftFilters(empty);
    setFilters(empty);
  };

  return (
    <div className="page admin-page">
      <button type="button" className="topup-back" onClick={onBack}>← Назад</button>
      <h1>Админка</h1>

      <section className="card admin-filters-card">
        <p className="label">Фильтры</p>
        <input
          className="input"
          placeholder="ID магазина (например m_001)"
          value={draftFilters.merchantId}
          onChange={(event) => setDraftFilters((prev) => ({ ...prev, merchantId: event.target.value }))}
        />
        <div className="admin-filters-row">
          <select
            className="input admin-select"
            value={draftFilters.status}
            onChange={(event) => setDraftFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="">Статус (любой)</option>
            <option value="SUCCESS">Успешно</option>
            <option value="PROCESSING">В процессе</option>
            <option value="FAILED">Ошибка</option>
          </select>
          <select
            className="input admin-select"
            value={draftFilters.payoutStatus}
            onChange={(event) => setDraftFilters((prev) => ({ ...prev, payoutStatus: event.target.value }))}
          >
            <option value="">СБП (любой)</option>
            <option value="SUCCESS">Отправлено</option>
            <option value="PROCESSING">В обработке</option>
            <option value="FAILED">Ошибка</option>
          </select>
        </div>
        <div className="admin-filters-actions">
          <button type="button" className="primary-btn" onClick={applyFilters}>Применить</button>
          <button type="button" className="secondary-btn" onClick={resetFilters}>Сбросить</button>
        </div>
      </section>

      {loading && <section className="card">Загрузка админки...</section>}
      {error && <section className="card bad">{error}</section>}

      {!loading && !error && summary && (
        <section className="card">
          <p className="label">Сводка</p>
          <div className="admin-summary-grid">
            <article className="admin-summary-item">
              <span>Платежей</span>
              <b>{summary.totalTransactions}</b>
            </article>
            <article className="admin-summary-item">
              <span>Оборот ₽</span>
              <b>{summary.totalRub}</b>
            </article>
            <article className="admin-summary-item">
              <span>Оборот USDT</span>
              <b>{summary.totalUsdt}</b>
            </article>
            <article className="admin-summary-item">
              <span>Оборот TON</span>
              <b>{summary.totalTon}</b>
            </article>
            <article className="admin-summary-item">
              <span>Успешно</span>
              <b>{summary.successCount}</b>
            </article>
            <article className="admin-summary-item">
              <span>СБП отправлено</span>
              <b>{summary.payoutSuccessCount}</b>
            </article>
          </div>
        </section>
      )}

      {!loading && !error && (
        <section className="card admin-list-card">
          <p className="label">Транзакции</p>
          {!items.length ? (
            <p>Нет данных</p>
          ) : (
            <div className="admin-list">
              {items.map((item) => (
                <article className="admin-item" key={item.id}>
                  <p><b>{item.storeName || "Магазин"}</b></p>
                  <p>{toDate(item.date)}</p>
                  <p><b>ID магазина:</b> {item.merchantId || "—"} | <b>ID заказа:</b> {item.orderId || "—"}</p>
                  <p><b>Клиент Telegram:</b> {item.customerTelegramId || "—"}</p>
                  <p><b>Сумма:</b> ₽ {item.amountRub} | {item.amountUsdt} USDT | {item.amountTon} TON</p>
                  <p><b>Крипто:</b> {toStatusLabel(item.cryptoStatus)} | <b>СБП:</b> {toStatusLabel(item.payoutStatus)}</p>
                  <p><b>Общий статус:</b> {toStatusLabel(item.status)}</p>
                  <p><b>Хэш транзакции:</b> {shortValue(item.txHash, 10, 10)}</p>
                  <p><b>ID выплаты СБП:</b> {item.payoutReference || "—"}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
