require("dotenv").config();
const express = require("express");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
const PORT = process.env.PORT || 4000;
const HAS_DATABASE = Boolean(process.env.DATABASE_URL);
const pool = HAS_DATABASE ? require("./db") : null;

app.use(cors());
app.use(express.json());

const RATE_RUB_PER_USDT = 100;
const FEE_PERCENT = 0.01;
const DEFAULT_TELEGRAM_ID = "demo_user";

const memoryState = {
  balance: { usdt: 1250.5, ton: 0, btc: 0 },
  history: []
};

function toNumber(value) {
  return Number(value || 0);
}

function resolveTelegramId(req, body = {}) {
  return body.telegramId || req.query.telegramId || DEFAULT_TELEGRAM_ID;
}

async function ensureUserAndBalance(client, telegramId) {
  await client.query(
    `
      INSERT INTO users (telegram_id)
      VALUES ($1)
      ON CONFLICT (telegram_id) DO NOTHING
    `,
    [telegramId]
  );

  const userResult = await client.query("SELECT id FROM users WHERE telegram_id = $1", [telegramId]);
  const userId = userResult.rows[0]?.id;

  await client.query(
    `
      INSERT INTO balances (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId]
  );

  return userId;
}

async function getHomeFromDb(telegramId) {
  const client = await pool.connect();
  try {
    const userId = await ensureUserAndBalance(client, telegramId);
    const balanceResult = await client.query(
      "SELECT usdt, ton, btc FROM balances WHERE user_id = $1 LIMIT 1",
      [userId]
    );

    const row = balanceResult.rows[0];
    return {
      usdt: toNumber(row?.usdt),
      ton: toNumber(row?.ton),
      btc: toNumber(row?.btc)
    };
  } finally {
    client.release();
  }
}

async function getHistoryFromDb(telegramId) {
  const client = await pool.connect();
  try {
    const userId = await ensureUserAndBalance(client, telegramId);
    const txResult = await client.query(
      `
        SELECT id, store_name, amount_rub, amount_usdt, status, created_at
        FROM transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      [userId]
    );

    return txResult.rows.map((row) => ({
      id: `tx_${row.id}`,
      date: row.created_at,
      storeName: row.store_name,
      amountRub: toNumber(row.amount_rub),
      amountUsdt: toNumber(row.amount_usdt),
      status: row.status
    }));
  } finally {
    client.release();
  }
}

async function initializeDatabaseSchema() {
  if (!HAS_DATABASE) return;

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

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "Cryp2Scan backend",
    storage: HAS_DATABASE ? "postgres" : "memory"
  });
});

app.get("/api/home", async (req, res) => {
  try {
    const telegramId = resolveTelegramId(req);
    const balance = HAS_DATABASE ? await getHomeFromDb(telegramId) : memoryState.balance;

    res.json({
      balance,
      assets: [
        { code: "USDT", active: true },
        { code: "TON", active: false },
        { code: "BTC", active: false }
      ]
    });
  } catch (error) {
    res.status(500).json({ error: "Cannot load home data", details: error.message });
  }
});

app.post("/api/scan/quote", (req, res) => {
  const { storeName, amountRub } = req.body;
  if (!storeName || !amountRub || amountRub <= 0) {
    return res.status(400).json({ error: "Неверные данные QR" });
  }

  const amountUsdt = +(amountRub / RATE_RUB_PER_USDT).toFixed(2);
  const feeUsdt = +(amountUsdt * FEE_PERCENT).toFixed(2);

  res.json({
    storeName,
    amountRub,
    amountUsdt,
    rate: RATE_RUB_PER_USDT,
    feeUsdt,
    totalUsdt: +(amountUsdt + feeUsdt).toFixed(2)
  });
});

app.post("/api/pay", async (req, res) => {
  const { telegramId, storeName, amountRub, amountUsdt, feeUsdt = 0 } = req.body;
  if (!telegramId || !storeName || !amountRub || !amountUsdt) {
    return res.status(400).json({ error: "Не хватает данных для оплаты" });
  }

  const totalUsdt = +(amountUsdt + feeUsdt).toFixed(2);

  if (!HAS_DATABASE) {
    if (memoryState.balance.usdt < totalUsdt) {
      memoryState.history.unshift({
        id: `tx_${Date.now()}`,
        date: new Date().toISOString(),
        storeName,
        amountRub,
        amountUsdt,
        status: "FAILED"
      });
      return res.status(402).json({ status: "FAILED", message: "Недостаточно баланса" });
    }

    await new Promise((r) => setTimeout(r, 1200));
    memoryState.balance.usdt = +(memoryState.balance.usdt - totalUsdt).toFixed(2);

    const tx = {
      id: `tx_${Date.now()}`,
      date: new Date().toISOString(),
      storeName,
      amountRub,
      amountUsdt,
      status: "SUCCESS"
    };
    memoryState.history.unshift(tx);

    return res.json({
      status: "SUCCESS",
      transaction: tx,
      newBalanceUsdt: memoryState.balance.usdt
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userId = await ensureUserAndBalance(client, telegramId);

    const balanceResult = await client.query(
      "SELECT usdt FROM balances WHERE user_id = $1 FOR UPDATE",
      [userId]
    );
    const currentUsdt = toNumber(balanceResult.rows[0]?.usdt);

    if (currentUsdt < totalUsdt) {
      await client.query(
        `
          INSERT INTO transactions (user_id, store_name, amount_rub, amount_usdt, status)
          VALUES ($1, $2, $3, $4, 'FAILED')
        `,
        [userId, storeName, amountRub, amountUsdt]
      );
      await client.query("COMMIT");
      return res.status(402).json({ status: "FAILED", message: "Недостаточно баланса" });
    }

    await new Promise((r) => setTimeout(r, 1200));

    const updatedBalanceResult = await client.query(
      `
        UPDATE balances
        SET usdt = usdt - $1, updated_at = NOW()
        WHERE user_id = $2
        RETURNING usdt
      `,
      [totalUsdt, userId]
    );

    const txResult = await client.query(
      `
        INSERT INTO transactions (user_id, store_name, amount_rub, amount_usdt, status)
        VALUES ($1, $2, $3, $4, 'SUCCESS')
        RETURNING id, created_at
      `,
      [userId, storeName, amountRub, amountUsdt]
    );

    await client.query("COMMIT");

    const tx = {
      id: `tx_${txResult.rows[0].id}`,
      date: txResult.rows[0].created_at,
      storeName,
      amountRub: toNumber(amountRub),
      amountUsdt: toNumber(amountUsdt),
      status: "SUCCESS"
    };

    res.json({
      status: "SUCCESS",
      transaction: tx,
      newBalanceUsdt: toNumber(updatedBalanceResult.rows[0].usdt)
    });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Payment error", details: error.message });
  } finally {
    client.release();
  }
});

app.get("/api/history", async (req, res) => {
  try {
    const telegramId = resolveTelegramId(req);
    const items = HAS_DATABASE ? await getHistoryFromDb(telegramId) : memoryState.history;
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: "Cannot load history", details: error.message });
  }
});

app.get("/api/profile", (req, res) => {
  const telegramId = req.query.telegramId || "unknown";
  res.json({
    telegramId,
    support: "@cryp2scan_support",
    legal: [
      { title: "Terms", url: "https://example.com/terms" },
      { title: "Privacy", url: "https://example.com/privacy" }
    ]
  });
});

async function startServer() {
  if (HAS_DATABASE) {
    try {
      await initializeDatabaseSchema();
      console.log("Postgres schema ready");
    } catch (error) {
      console.error("Postgres init failed:", error.message);
      process.exit(1);
    }
  } else {
    console.log("DATABASE_URL is missing, using memory storage");
  }

  app.listen(PORT, () => {
    console.log(`Backend started on http://localhost:${PORT}`);
  });
}

startServer();

const BOT_TOKEN = process.env.BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL || "https://example.com";

if (BOT_TOKEN) {
  const bot = new TelegramBot(BOT_TOKEN, { polling: true });

  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Добро пожаловать в Cryp2Scan", {
      reply_markup: {
        inline_keyboard: [[{ text: "Open Cryp2Scan", web_app: { url: MINI_APP_URL } }]]
      }
    });
  });

  console.log("Telegram bot polling started");
} else {
  console.log("BOT_TOKEN не задан. Бот не запущен.");
}
