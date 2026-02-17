require("dotenv").config();
const express = require("express");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");
const fetch = require("node-fetch");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 4000;
const HAS_DATABASE = Boolean(process.env.DATABASE_URL);
const pool = HAS_DATABASE ? require("./db") : null;

app.use(cors());
app.use(express.json());

const RATE_RUB_PER_USDT = 100;
const RATE_RUB_PER_TON = Number(process.env.RATE_RUB_PER_TON || 300);
const FEE_PERCENT = 0.01;
const MERCHANT_WALLET_ADDRESS = String(process.env.MERCHANT_WALLET_ADDRESS || "").trim();
const TON_PAYMENT_NETWORK = String(process.env.TON_PAYMENT_NETWORK || "mainnet").trim() || "mainnet";

const memoryState = {
  balance: { usdt: 1250.5, ton: 0, btc: 0 },
  history: [],
  wallets: {}
};

function toNumber(value) {
  return Number(value || 0);
}

function resolveTelegramId(req, body = {}) {
  return body.telegramId || req.query.telegramId || null;
}

function buildTxHashFromBoc(txBoc) {
  const rawBoc = String(txBoc || "").trim();
  if (!rawBoc) return "";

  try {
    const buffer = Buffer.from(rawBoc, "base64");
    return crypto.createHash("sha256").update(buffer).digest("hex");
  } catch {
    return crypto.createHash("sha256").update(rawBoc).digest("hex");
  }
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
        SELECT id, store_name, amount_rub, amount_usdt, amount_ton, tx_hash, payment_method, status, created_at
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
      amountTon: toNumber(row.amount_ton),
      txHash: row.tx_hash || "",
      paymentMethod: row.payment_method || "internal",
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

  await pool.query(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'internal';
  `);

  await pool.query(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS amount_ton NUMERIC(18,6) NOT NULL DEFAULT 0;
  `);

  await pool.query(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS tx_hash TEXT;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_wallets (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      wallet_address TEXT NOT NULL,
      network TEXT DEFAULT 'mainnet',
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function getWalletLinkFromDb(telegramId) {
  const client = await pool.connect();
  try {
    const userId = await ensureUserAndBalance(client, telegramId);
    const result = await client.query(
      `
        SELECT wallet_address, network, updated_at
        FROM user_wallets
        WHERE user_id = $1
        LIMIT 1
      `,
      [userId]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

async function saveWalletLinkToDb(telegramId, walletAddress, network = "mainnet") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userId = await ensureUserAndBalance(client, telegramId);
    await client.query(
      `
        INSERT INTO user_wallets (user_id, wallet_address, network, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET wallet_address = EXCLUDED.wallet_address, network = EXCLUDED.network, updated_at = NOW()
      `,
      [userId, walletAddress, network]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteWalletLinkFromDb(telegramId) {
  const client = await pool.connect();
  try {
    const userId = await ensureUserAndBalance(client, telegramId);
    await client.query("DELETE FROM user_wallets WHERE user_id = $1", [userId]);
  } finally {
    client.release();
  }
}

async function fetchTonAccountTonBalance(address) {
  const response = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}`);
  if (!response.ok) throw new Error("Не удалось получить баланс TON");
  const data = await response.json();
  const nanoTon = Number(data?.balance || 0);
  return +(nanoTon / 1e9).toFixed(6);
}

async function fetchTonAccountUsdtBalance(address) {
  const response = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}/jettons`);
  if (!response.ok) throw new Error("Не удалось получить баланс USDT");

  const data = await response.json();
  const balances = Array.isArray(data?.balances) ? data.balances : [];
  const usdtRow = balances.find((item) => {
    const symbol = String(item?.jetton?.symbol || "").toUpperCase();
    return symbol === "USDT" || symbol === "USD₮";
  });

  if (!usdtRow) return 0;

  const rawBalance = Number(usdtRow.balance || 0);
  const decimals = Number(usdtRow?.jetton?.decimals || 6);
  return +(rawBalance / 10 ** decimals).toFixed(6);
}

async function fetchOnchainBalances(address) {
  const [ton, usdt] = await Promise.all([
    fetchTonAccountTonBalance(address),
    fetchTonAccountUsdtBalance(address)
  ]);
  return { ton, usdt };
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
    if (!telegramId) {
      return res.status(400).json({ error: "telegramId is required" });
    }
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
  const merchantWalletAddress = String(req.body?.merchantWalletAddress || MERCHANT_WALLET_ADDRESS || "").trim();
  if (!storeName || !amountRub || amountRub <= 0) {
    return res.status(400).json({ error: "Неверные данные QR" });
  }

  const amountUsdt = +(amountRub / RATE_RUB_PER_USDT).toFixed(2);
  const feeUsdt = +(amountUsdt * FEE_PERCENT).toFixed(2);
  const totalUsdt = +(amountUsdt + feeUsdt).toFixed(2);
  const totalRub = +(totalUsdt * RATE_RUB_PER_USDT).toFixed(2);
  const amountTon = +(amountRub / RATE_RUB_PER_TON).toFixed(6);
  const totalTon = +(totalRub / RATE_RUB_PER_TON).toFixed(6);

  res.json({
    storeName,
    amountRub,
    amountUsdt,
    rate: RATE_RUB_PER_USDT,
    feeUsdt,
    totalUsdt,
    tonRate: RATE_RUB_PER_TON,
    amountTon,
    totalTon,
    merchantWalletAddress,
    paymentNetwork: TON_PAYMENT_NETWORK,
    onchainAvailable: Boolean(merchantWalletAddress)
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
        amountTon: 0,
        paymentMethod: "internal",
        txHash: "",
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
      amountTon: 0,
      paymentMethod: "internal",
      txHash: "",
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
          INSERT INTO transactions (user_id, store_name, amount_rub, amount_usdt, amount_ton, payment_method, tx_hash, status)
          VALUES ($1, $2, $3, $4, 0, 'internal', '', 'FAILED')
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
        INSERT INTO transactions (user_id, store_name, amount_rub, amount_usdt, amount_ton, payment_method, tx_hash, status)
        VALUES ($1, $2, $3, $4, 0, 'internal', '', 'SUCCESS')
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
      amountTon: 0,
      paymentMethod: "internal",
      txHash: "",
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

app.post("/api/pay/onchain", async (req, res) => {
  const {
    telegramId,
    storeName,
    amountRub,
    amountUsdt,
    amountTon,
    txBoc,
    senderWalletAddress = "",
    merchantWalletAddress = ""
  } = req.body || {};

  if (!telegramId || !storeName || !amountRub || !amountUsdt || !amountTon || !txBoc) {
    return res.status(400).json({ error: "Не хватает данных для on-chain оплаты" });
  }

  const txHash = buildTxHashFromBoc(txBoc);
  const safeSenderWallet = String(senderWalletAddress || "").trim();
  const safeMerchantWallet = String(merchantWalletAddress || "").trim();
  const fullStoreName = safeMerchantWallet
    ? `${storeName} [TON ${safeMerchantWallet.slice(0, 6)}...${safeMerchantWallet.slice(-6)}]`
    : storeName;

  if (!HAS_DATABASE) {
    const tx = {
      id: `tx_${Date.now()}`,
      date: new Date().toISOString(),
      storeName: fullStoreName,
      amountRub: toNumber(amountRub),
      amountUsdt: toNumber(amountUsdt),
      amountTon: toNumber(amountTon),
      txHash,
      paymentMethod: "ton_wallet",
      senderWalletAddress: safeSenderWallet,
      status: "SUCCESS"
    };
    memoryState.history.unshift(tx);
    return res.json({ status: "SUCCESS", txHash, transaction: tx });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userId = await ensureUserAndBalance(client, telegramId);

    const txResult = await client.query(
      `
        INSERT INTO transactions (user_id, store_name, amount_rub, amount_usdt, amount_ton, payment_method, tx_hash, status)
        VALUES ($1, $2, $3, $4, $5, 'ton_wallet', $6, 'SUCCESS')
        RETURNING id, created_at
      `,
      [userId, fullStoreName, amountRub, amountUsdt, amountTon, txHash]
    );

    await client.query("COMMIT");

    return res.json({
      status: "SUCCESS",
      txHash,
      transaction: {
        id: `tx_${txResult.rows[0].id}`,
        date: txResult.rows[0].created_at,
        storeName: fullStoreName,
        amountRub: toNumber(amountRub),
        amountUsdt: toNumber(amountUsdt),
        amountTon: toNumber(amountTon),
        txHash,
        paymentMethod: "ton_wallet",
        senderWalletAddress: safeSenderWallet,
        status: "SUCCESS"
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "On-chain payment save error", details: error.message });
  } finally {
    client.release();
  }
});

app.post("/api/topup", async (req, res) => {
  const telegramId = resolveTelegramId(req, req.body || {});
  const amountUsdt = Number(req.body?.amountUsdt || 0);

  if (!telegramId || !Number.isFinite(amountUsdt) || amountUsdt <= 0) {
    return res.status(400).json({ error: "Неверные данные пополнения" });
  }

  if (!HAS_DATABASE) {
    memoryState.balance.usdt = +(memoryState.balance.usdt + amountUsdt).toFixed(2);
    memoryState.history.unshift({
      id: `tx_${Date.now()}`,
      date: new Date().toISOString(),
      storeName: "Пополнение баланса",
      amountRub: 0,
      amountUsdt,
      amountTon: 0,
      paymentMethod: "topup",
      txHash: "",
      status: "SUCCESS"
    });
    return res.json({
      status: "SUCCESS",
      newBalanceUsdt: memoryState.balance.usdt
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userId = await ensureUserAndBalance(client, telegramId);
    const balanceResult = await client.query(
      `
        UPDATE balances
        SET usdt = usdt + $1, updated_at = NOW()
        WHERE user_id = $2
        RETURNING usdt
      `,
      [amountUsdt, userId]
    );

    await client.query(
      `
        INSERT INTO transactions (user_id, store_name, amount_rub, amount_usdt, amount_ton, payment_method, tx_hash, status)
        VALUES ($1, $2, $3, $4, 0, 'topup', '', 'SUCCESS')
      `,
      [userId, "Пополнение баланса", 0, amountUsdt]
    );

    await client.query("COMMIT");

    res.json({
      status: "SUCCESS",
      newBalanceUsdt: toNumber(balanceResult.rows[0]?.usdt)
    });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Top up error", details: error.message });
  } finally {
    client.release();
  }
});

app.get("/api/history", async (req, res) => {
  try {
    const telegramId = resolveTelegramId(req);
    if (!telegramId) {
      return res.status(400).json({ error: "telegramId is required" });
    }
    const items = HAS_DATABASE ? await getHistoryFromDb(telegramId) : memoryState.history;
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: "Cannot load history", details: error.message });
  }
});

app.get("/api/profile", (req, res) => {
  const telegramId = resolveTelegramId(req);
  if (!telegramId) {
    return res.status(400).json({ error: "telegramId is required" });
  }
  res.json({
    telegramId,
    support: "@cryp2scan_support",
    legal: [
      { title: "Пользовательское соглашение", url: "https://example.com/terms" },
      { title: "Политика конфиденциальности", url: "https://example.com/privacy" }
    ]
  });
});

app.post("/api/wallet/connect", async (req, res) => {
  const telegramId = resolveTelegramId(req, req.body || {});
  const walletAddress = String(req.body?.walletAddress || "").trim();
  const network = String(req.body?.network || "mainnet").trim() || "mainnet";

  if (!telegramId || !walletAddress) {
    return res.status(400).json({ error: "Нужны telegramId и walletAddress" });
  }

  try {
    if (HAS_DATABASE) {
      await saveWalletLinkToDb(telegramId, walletAddress, network);
    } else {
      memoryState.wallets[telegramId] = {
        wallet_address: walletAddress,
        network,
        updated_at: new Date().toISOString()
      };
    }

    res.json({
      status: "CONNECTED",
      walletAddress,
      network
    });
  } catch (error) {
    res.status(500).json({ error: "Не удалось сохранить подключение", details: error.message });
  }
});

app.post("/api/wallet/disconnect", async (req, res) => {
  const telegramId = resolveTelegramId(req, req.body || {});
  if (!telegramId) {
    return res.status(400).json({ error: "Нужен telegramId" });
  }

  try {
    if (HAS_DATABASE) {
      await deleteWalletLinkFromDb(telegramId);
    } else {
      delete memoryState.wallets[telegramId];
    }
    res.json({ status: "DISCONNECTED" });
  } catch (error) {
    res.status(500).json({ error: "Не удалось отвязать кошелек", details: error.message });
  }
});

app.get("/api/wallet/status", async (req, res) => {
  const telegramId = resolveTelegramId(req);
  if (!telegramId) {
    return res.status(400).json({ error: "Нужен telegramId" });
  }

  try {
    const link = HAS_DATABASE ? await getWalletLinkFromDb(telegramId) : memoryState.wallets[telegramId] || null;
    if (!link?.wallet_address) {
      return res.json({ connected: false });
    }

    let balances = null;
    let warning = "";
    try {
      balances = await fetchOnchainBalances(link.wallet_address);
    } catch (error) {
      warning = "Кошелек подключен, но баланс временно недоступен";
      balances = { ton: 0, usdt: 0 };
    }

    res.json({
      connected: true,
      walletAddress: link.wallet_address,
      network: link.network || "mainnet",
      balances,
      updatedAt: link.updated_at || new Date().toISOString(),
      warning
    });
  } catch (error) {
    res.status(500).json({ error: "Не удалось загрузить баланс кошелька", details: error.message });
  }
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

function buildMiniAppUrl(baseUrl, telegramId) {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}tg_id=${encodeURIComponent(String(telegramId))}`;
}

if (BOT_TOKEN) {
  const bot = new TelegramBot(BOT_TOKEN, { polling: true });

  bot.onText(/\/start/, (msg) => {
    const webAppUrl = buildMiniAppUrl(MINI_APP_URL, msg.from?.id || msg.chat?.id || "");
    bot.sendMessage(msg.chat.id, "Добро пожаловать в Cryp2Scan", {
      reply_markup: {
        inline_keyboard: [[{ text: "Open Cryp2Scan", web_app: { url: webAppUrl } }]]
      }
    });
  });

  console.log("Telegram bot polling started");
} else {
  console.log("BOT_TOKEN не задан. Бот не запущен.");
}
