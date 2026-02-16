export default function ProfilePage({ profile }) {
  return (
    <div className="page">
      <section className="card profile-card">
        <p><b>ID Telegram:</b> {profile?.telegramId || "неизвестно"}</p>
        <p><b>Поддержка:</b> {profile?.support || "@support"}</p>
        <p><b>Юридическая информация:</b></p>
        <ul>
          {(profile?.legal || []).map((item) => (
            <li key={item.title}>
              <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
