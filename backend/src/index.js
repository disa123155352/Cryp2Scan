require("dotenv").config();
const express = require("express");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const RATE_RUB_PER_USDT = 100;
const FEE_PERCENT = 0.01;

const state = {
  balance: { usdt: 1250.5, ton: 0, btc: 0 },
  history: []
};

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "Cryp2Scan backend" });
});

app.get("/api/home", (req, res) => {
  res.json({
    balance: state.balance,
    assets: [
      { code: "USDT", active: true },
      { code: "TON", active: false },
      { code: "BTC", active: false }
    ]
  });
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

  if (state.balance.usdt < totalUsdt) {
    state.history.unshift({
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

  state.balance.usdt = +(state.balance.usdt - totalUsdt).toFixed(2);

  const tx = {
    id: `tx_${Date.now()}`,
    date: new Date().toISOString(),
    storeName,
    amountRub,
    amountUsdt,
    status: "SUCCESS"
  };
  state.history.unshift(tx);

  res.json({
    status: "SUCCESS",
    transaction: tx,
    newBalanceUsdt: state.balance.usdt
  });
});

app.get("/api/history", (req, res) => {
  res.json({ items: state.history });
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

app.listen(PORT, () => {
  console.log(`Backend started on http://localhost:${PORT}`);
});

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
