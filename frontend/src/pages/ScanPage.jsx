import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { apiPost } from "../api/client";

function parseQrPayload(raw) {
  if (!raw) return null;

  // Format 1: store=Coffee;amount=450
  if (raw.includes("store=") && raw.includes("amount=")) {
    const parts = Object.fromEntries(raw.split(";").map((p) => p.split("=")));
    if (parts.store && parts.amount) {
      return {
        store: parts.store,
        amount: Number(parts.amount),
        wallet: parts.wallet || parts.address || parts.tonWallet || ""
      };
    }
  }

  // Format 2: JSON {"store":"Coffee","amount":450}
  try {
    const data = JSON.parse(raw);
    const store = data.store || data.merchant || data.shop;
    const amount = Number(data.amount || data.sum || data.total);
    if (store && Number.isFinite(amount) && amount > 0) {
      return {
        store,
        amount,
        wallet: data.wallet || data.walletAddress || data.address || data.tonWallet || ""
      };
    }
  } catch {
    // ignore invalid JSON
  }

  // Format 3: URL with params ?store=Coffee&amount=450
  try {
    const url = new URL(raw);
    const store = url.searchParams.get("store") || url.searchParams.get("merchant");
    const amount = Number(url.searchParams.get("amount") || url.searchParams.get("sum"));
    if (store && Number.isFinite(amount) && amount > 0) {
      return {
        store,
        amount,
        wallet: url.searchParams.get("wallet") ||
          url.searchParams.get("address") ||
          url.searchParams.get("tonWallet") ||
          ""
      };
    }
  } catch {
    // ignore invalid URL
  }

  return null;
}

function toNanoString(tonAmount) {
  const value = Number(tonAmount || 0);
  const nano = Math.round(value * 1e9);
  if (!Number.isFinite(nano) || nano <= 0) {
    throw new Error("Некорректная сумма TON");
  }
  return String(nano);
}

function shortenAddress(value = "") {
  const address = String(value || "");
  if (!address) return "";
  if (address.length < 18) return address;
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

export default function ScanPage({ telegramId, onPaid }) {
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const [tonConnectUI] = useTonConnectUI();
  const tonWallet = useTonWallet();

  const [quote, setQuote] = useState(null);
  const [scanState, setScanState] = useState("idle");
  const [scanError, setScanError] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [lastTxHash, setLastTxHash] = useState("");

  useEffect(() => {
    let active = true;

    async function startScanner() {
      if (!videoRef.current) return;
      try {
        setScanState("scanning");
        setScanError("");

        const scanner = new QrScanner(
          videoRef.current,
          async (result) => {
            if (!active) return;

            // qr-scanner in different environments can return either:
            // 1) string (decoded text) or 2) object with .data
            const raw =
              typeof result === "string"
                ? result
                : typeof result?.data === "string"
                  ? result.data
                  : "";

            if (!raw) return;
            const parsed = parseQrPayload(raw);

            if (!parsed) {
              setScanError("Неверный формат QR");
              return;
            }

            try {
              const data = await apiPost("/scan/quote", {
                storeName: parsed.store,
                amountRub: parsed.amount,
                merchantWalletAddress: parsed.wallet || undefined
              });
              setQuote(data);
              setScanState("scanned");
              setScanError("");
              setPaymentMessage("");
              setLastTxHash("");
              scanner.stop();
            } catch {
              setScanError("Ошибка расчета");
            }
          },
          {
            preferredCamera: "environment",
            maxScansPerSecond: 25,
            highlightScanRegion: true,
            highlightCodeOutline: true
          }
        );

        scannerRef.current = scanner;
        await scanner.start();
        await scanner.setInversionMode("both");
      } catch {
        setScanState("failed");
        setScanError("Нет доступа к камере. Разреши доступ в браузере.");
      }
    }

    startScanner();

    return () => {
      active = false;
      if (scannerRef.current) scannerRef.current.destroy();
    };
  }, []);

  const pay = async () => {
    if (!quote) return;
    if (!quote.onchainAvailable || !quote.merchantWalletAddress) {
      setScanError("Кошелек магазина не настроен. Оплата временно недоступна.");
      return;
    }

    if (!tonWallet?.account?.address) {
      setScanError("Подключите кошелек в Сервисы → Настройки");
      return;
    }

    setScanState("processing");
    setScanError("");
    setPaymentMessage("Подтвердите платеж в кошельке...");

    try {
      const tonAmount = Number(quote.totalTon || quote.amountTon || 0);
      const txResult = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 10 * 60,
        messages: [
          {
            address: quote.merchantWalletAddress,
            amount: toNanoString(tonAmount)
          }
        ]
      });

      setPaymentMessage("Сохраняем транзакцию...");

      const data = await apiPost("/pay/onchain", {
        telegramId,
        storeName: quote.storeName,
        amountRub: quote.amountRub,
        amountUsdt: quote.amountUsdt,
        amountTon: tonAmount,
        txBoc: txResult?.boc || "",
        senderWalletAddress: tonWallet.account.address,
        merchantWalletAddress: quote.merchantWalletAddress
      });

      setLastTxHash(data?.txHash || "");
      setPaymentMessage("Оплата подтверждена");
      setScanState(data.status === "SUCCESS" ? "success" : "failed");
      onPaid?.();
    } catch (error) {
      const text = String(error?.message || "").toLowerCase();
      if (text.includes("reject") || text.includes("cancel")) {
        setScanError("Платеж отменен в кошельке");
      } else {
        setScanError("Не удалось выполнить on-chain оплату");
      }
      setPaymentMessage("");
      setScanState("failed");
      onPaid?.();
    }
  };

  const scanAgain = async () => {
    setQuote(null);
    setScanError("");
    setPaymentMessage("");
    setLastTxHash("");
    setScanState("scanning");
    if (scannerRef.current) await scannerRef.current.start();
  };

  return (
    <div className="page">
      {!quote && (
        <section className="card scan-card">
          <p className="label">Камера</p>
          <video ref={videoRef} className="video" />
          {scanState === "scanning" && <p>Наведите камеру на QR-код</p>}
          {scanError && <p className="bad">{scanError}</p>}
        </section>
      )}

      {quote && (
        <section className="card scan-result-card">
          <p><b>Магазин:</b> {quote.storeName}</p>
          <p><b>Сумма:</b> ₽ {quote.amountRub}</p>
          <p><b>USDT:</b> {quote.amountUsdt}</p>
          <p><b>Курс:</b> {quote.rate}</p>
          <p><b>Комиссия:</b> {quote.feeUsdt} USDT</p>
          <p><b>К оплате TON:</b> {quote.totalTon}</p>
          <p><b>Кошелек магазина:</b> {shortenAddress(quote.merchantWalletAddress)}</p>
          <p><b>Сеть:</b> {quote.paymentNetwork || "mainnet"}</p>
          {!quote.onchainAvailable && <p className="bad">Кошелек магазина не настроен</p>}
          {!tonWallet?.account?.address && quote.onchainAvailable && (
            <p className="label">Для оплаты подключите кошелек в Сервисы → Настройки</p>
          )}

          <button className="primary-btn" type="button" onClick={pay} disabled={!quote.onchainAvailable}>
            {quote.onchainAvailable ? "Оплатить через Wallet" : "Оплата недоступна"}
          </button>
          <button className="secondary-btn" type="button" onClick={scanAgain}>Сканировать снова</button>
        </section>
      )}

      {scanState === "processing" && <section className="card">{paymentMessage || "Обработка..."}</section>}
      {scanState === "success" && (
        <section className="card ok">
          <p>Успешно</p>
          {lastTxHash && <p className="scan-tx-hash">Hash: {lastTxHash}</p>}
        </section>
      )}
      {scanState === "failed" && <section className="card bad">Ошибка</section>}
    </div>
  );
}
