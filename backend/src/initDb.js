require("dotenv").config();
const pool = require("./db");

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS balances (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      usdt NUMERIC(18,2) NOT NULL DEFAULT 1250.50,
      ton NUMERIC(18,6) NOT NULL DEFAULT 0,
      btc NUMERIC(18,8) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      store_name TEXT NOT NULL,
      amount_rub NUMERIC(18,2) NOT NULL,
      amount_usdt NUMERIC(18,2) NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

initDb()
  .then(() => {
    console.log("DB initialized");
    process.exit(0);
  })
  .catch((error) => {
    console.error("DB init error:", error.message);
    process.exit(1);
  });
