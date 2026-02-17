export default function ServicesPage({ isAdmin, onOpenPitch, onOpenSettings, onOpenAdmin }) {
  return (
    <div className="page">
      <section className="card services-card">
        <h2>Сервисы</h2>
        <p>Управление приложением и подключениями</p>

        <div className="services-main-actions">
          <button type="button" className="primary-btn services-btn" onClick={onOpenPitch}>
            Открыть презентацию
          </button>
          <button type="button" className="primary-btn services-btn" onClick={onOpenSettings}>
            Настройки
          </button>
        </div>

        {isAdmin && (
          <div className="services-admin-wrap">
            <p className="services-admin-title">Служебный раздел</p>
            <button type="button" className="secondary-btn services-btn services-admin-btn" onClick={onOpenAdmin}>
              Админка
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
