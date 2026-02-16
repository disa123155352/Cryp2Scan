import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { apiPost } from "../api/client";

export default function ScanPage({ telegramId, onPaid }) {
  const videoRef = useRef(null);
  const scannerRef = useRef(null);

  const [quote, setQuote] = useState(null);
  const [scanState, setScanState] = useState("idle");
  const [scanError, setScanError] = useState("");

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
            const parts = Object.fromEntries(raw.split(";").map((p) => p.split("=")));

            if (!parts.store || !parts.amount) {
              setScanError("Неверный формат QR");
              return;
            }

            try {
              const data = await apiPost("/scan/quote", {
                storeName: parts.store,
                amountRub: Number(parts.amount)
              });
              setQuote(data);
              setScanState("scanned");
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
    setScanState("processing");

    try {
      const data = await apiPost("/pay", {
        telegramId,
        storeName: quote.storeName,
        amountRub: quote.amountRub,
        amountUsdt: quote.amountUsdt,
        feeUsdt: quote.feeUsdt
      });

      setScanState(data.status === "SUCCESS" ? "success" : "failed");
      onPaid?.();
    } catch {
      setScanState("failed");
      onPaid?.();
    }
  };

  const scanAgain = async () => {
    setQuote(null);
    setScanError("");
    setScanState("scanning");
    if (scannerRef.current) await scannerRef.current.start();
  };

  return (
    <div className="page">
      <h1>Скан</h1>

      {!quote && (
        <section className="card">
          <p className="label">Камера</p>
          <video ref={videoRef} className="video" />
          {scanState === "scanning" && <p>Наведите камеру на QR-код</p>}
          {scanError && <p className="bad">{scanError}</p>}
        </section>
      )}

      {quote && (
        <section className="card">
          <p><b>Магазин:</b> {quote.storeName}</p>
          <p><b>Сумма:</b> ₽ {quote.amountRub}</p>
          <p><b>USDT:</b> {quote.amountUsdt}</p>
          <p><b>Курс:</b> {quote.rate}</p>
          <p><b>Комиссия:</b> {quote.feeUsdt} USDT</p>

          <button className="primary-btn" type="button" onClick={pay}>Оплатить</button>
          <button className="secondary-btn" type="button" onClick={scanAgain}>Сканировать снова</button>
        </section>
      )}

      {scanState === "processing" && <section className="card">Обработка...</section>}
      {scanState === "success" && <section className="card ok">Успешно</section>}
      {scanState === "failed" && <section className="card bad">Ошибка</section>}
    </div>
  );
}
