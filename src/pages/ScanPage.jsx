import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { api } from "../api/client";

export default function ScanPage({ onPaid }) {
  const videoRef = useRef(null);
  const scannerRef = useRef(null);

  const [quote, setQuote] = useState(null);
  const [scanState, setScanState] = useState("idle"); // idle | scanning | scanned | processing | success | failed
  const [scanError, setScanError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function startScanner() {
      if (!videoRef.current) return;

      try {
        setScanState("scanning");
        setScanError("");

        const scanner = new QrScanner(
          videoRef.current,
          async (result) => {
            if (!mounted) return;
            const raw = result?.data || "";
            // Ожидаем формат: store=CoffeePoint;amount=450
            const parts = Object.fromEntries(raw.split(";").map((p) => p.split("=")));

            if (!parts.store || !parts.amount) {
              setScanError("QR формат неверный");
              return;
            }

            try {
              const res = await api.post("/scan/quote", {
                storeName: parts.store,
                amountRub: Number(parts.amount)
              });
              setQuote(res.data);
              setScanState("scanned");
              scanner.stop(); // остановили камеру после успешного чтения
            } catch {
              setScanError("Не удалось получить расчет");
            }
          },
          {
            highlightScanRegion: true,
            highlightCodeOutline: true
          }
        );

        scannerRef.current = scanner;
        await scanner.start();
      } catch {
        setScanState("failed");
        setScanError("Нет доступа к камере. Разреши доступ в браузере.");
      }
    }

    startScanner();

    return () => {
      mounted = false;
      if (scannerRef.current) scannerRef.current.destroy();
    };
  }, []);

  const pay = async () => {
    if (!quote) return;
    setScanState("processing");

    try {
      const res = await api.post("/pay", {
        telegramId: "demo_user",
        storeName: quote.storeName,
        amountRub: quote.amountRub,
        amountUsdt: quote.amountUsdt,
        feeUsdt: quote.feeUsdt
      });

      if (res.data.status === "SUCCESS") {
        setScanState("success");
      } else {
        setScanState("failed");
      }
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
    if (scannerRef.current) {
      await scannerRef.current.start();
    }
  };

  return (
    <div className="page">
      <h1>Scan</h1>

      {!quote && (
        <section className="card">
          <p className="label">Camera</p>
          <video ref={videoRef} style={{ width: "100%", borderRadius: 12 }} />
          {scanState === "scanning" && <p>Наведи камеру на QR-код</p>}
          {scanError && <p className="bad">{scanError}</p>}
        </section>
      )}

      {quote && (
        <section className="card">
          <p><b>Store:</b> {quote.storeName}</p>
          <p><b>Amount:</b> ₽ {quote.amountRub}</p>
          <p><b>USDT:</b> {quote.amountUsdt}</p>
          <p><b>Rate:</b> {quote.rate}</p>
          <p><b>Fee:</b> {quote.feeUsdt} USDT</p>

          <button className="primary-btn" onClick={pay}>Pay</button>
          <button className="primary-btn" style={{ marginTop: 8, background: "#6b7280" }} onClick={scanAgain}>
            Scan Again
          </button>
        </section>
      )}

      {scanState === "processing" && <section className="card">Processing...</section>}
      {scanState === "success" && <section className="card ok">Success</section>}
      {scanState === "failed" && <section className="card bad">Failed</section>}
    </div>
  );
}
