export default function ServicesPage({ onOpenSettings }) {
  return (
    <div className="page">
      <section className="card services-card">
        <h2>Сервисы</h2>
        <p>Управление приложением и подключениями</p>
        <button type="button" className="primary-btn services-btn" onClick={onOpenSettings}>
          Настройки
        </button>
      </section>
    </div>
  );
}
