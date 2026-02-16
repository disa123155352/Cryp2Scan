export default function ProfilePage({ profile }) {
  return (
    <div className="page">
      <h1>Profile</h1>
      <section className="card">
        <p><b>Telegram ID:</b> {profile?.telegramId || "unknown"}</p>
        <p><b>Support:</b> {profile?.support || "@support"}</p>
        <p><b>Legal:</b></p>
        <ul>
          {(profile?.legal || []).map((l) => (
            <li key={l.title}><a href={l.url} target="_blank" rel="noreferrer">{l.title}</a></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
