export default function ProfilePage({ profile }) {
  return (
    <div className="page">
      <h1>Profile</h1>

      <section className="card">
        <p><b>Telegram ID:</b> {profile?.telegramId || "unknown"}</p>
        <p><b>Support:</b> {profile?.support || "@support"}</p>
        <p><b>Legal:</b></p>
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
