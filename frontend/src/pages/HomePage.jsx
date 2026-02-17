import { useEffect, useMemo, useRef, useState } from "react";
import { useTonWallet } from "@tonconnect/ui-react";
import { apiGet } from "../api/client";

async function fetchBalancesFromTonApi(address) {
  if (!address) return { ton: 0, usdt: 0 };

  const accountRes = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}`);
  if (!accountRes.ok) throw new Error("ton_balance_unavailable");
  const accountData = await accountRes.json();
  const ton = Number(accountData?.balance || 0) / 1e9;

  const jettonsRes = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(address)}/jettons`);
  if (!jettonsRes.ok) throw new Error("usdt_balance_unavailable");
  const jettonsData = await jettonsRes.json();
  const balances = Array.isArray(jettonsData?.balances) ? jettonsData.balances : [];
  const usdtRow = balances.find((item) => {
    const symbol = String(item?.jetton?.symbol || "").toUpperCase();
    return symbol === "USDT" || symbol === "USD₮";
  });
  const rawUsdt = Number(usdtRow?.balance || 0);
  const decimals = Number(usdtRow?.jetton?.decimals || 6);
  const usdt = rawUsdt / 10 ** decimals;

  return {
    ton: Number.isFinite(ton) ? +ton.toFixed(6) : 0,
    usdt: Number.isFinite(usdt) ? +usdt.toFixed(6) : 0
  };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBalancesWithRetry(address, retries = 2) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchBalancesFromTonApi(address);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(450 * (attempt + 1));
      }
    }
  }
  throw lastError || new Error("balance_unavailable");
}

export default function HomePage({
  homeData,
  telegramId,
  onOpenTopUp,
  onOpenSettings,
  onRunDemo,
  onResetDemo,
  onOpenHistory
}) {
  const [activeBalanceCard, setActiveBalanceCard] = useState(0);
  const [walletStatus, setWalletStatus] = useState({ connected: false, balances: { usdt: 0, ton: 0 }, loading: true });
  const [walletHint, setWalletHint] = useState("");
  const [investorOpen, setInvestorOpen] = useState(false);
  const [investorLoading, setInvestorLoading] = useState(false);
  const [investorStep, setInvestorStep] = useState(-1);
  const [investorError, setInvestorError] = useState("");
  const [investorResult, setInvestorResult] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetInfo, setResetInfo] = useState("");
  const [selectedScenarioKey, setSelectedScenarioKey] = useState("supermarket");
  const tonWallet = useTonWallet();
  const isWalletConnectedInSdk = Boolean(tonWallet?.account?.address);
  const isWalletConnected = walletStatus.connected || isWalletConnectedInSdk;
  const shortId = telegramId?.slice(-6) || "000000";
  const onchainBalances = walletStatus?.balances || {};
  const previousTonAddress = useRef("");

  const balances = useMemo(() => ({
    usdt: (walletStatus.connected || isWalletConnectedInSdk) ? Number(onchainBalances.usdt || 0) : 0,
    ton: (walletStatus.connected || isWalletConnectedInSdk) ? Number(onchainBalances.ton || 0) : 0,
    btc: 0
  }), [walletStatus.connected, isWalletConnectedInSdk, onchainBalances.usdt, onchainBalances.ton]);

  const rateByCode = { USDT: 100, TON: 300, BTC: 9000000 };

  const balanceCards = [
    {
      code: "USDT",
      amount: Number(balances.usdt || 0),
      caption: "Основной баланс"
    },
    {
      code: "TON",
      amount: Number(balances.ton || 0),
      caption: "Вторичный баланс"
    },
    {
      code: "BTC",
      amount: Number(balances.btc || 0),
      caption: "Вторичный баланс"
    }
  ];

  const onBalanceScroll = (event) => {
    const container = event.currentTarget;
    const cardWidth = container.clientWidth;
    if (!cardWidth) return;
    const index = Math.round(container.scrollLeft / cardWidth);
    setActiveBalanceCard(index);
  };

  const formatNumber = (value) =>
    Number(value || 0).toLocaleString("ru-RU", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2
    });

  const formatPercent = (value) =>
    Number(value || 0).toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const demoScenarios = [
    {
      key: "supermarket",
      title: "Супермаркет",
      subtitle: "Пятёрочка",
      storeName: "Пятёрочка",
      amountRub: 1890,
      merchantId: "m_demo_market",
      stepDelayMs: 520
    },
    {
      key: "coffee",
      title: "Кофейня",
      subtitle: "Ежедневная покупка",
      storeName: "Кофейня",
      amountRub: 390,
      merchantId: "m_demo_coffee",
      stepDelayMs: 260
    },
    {
      key: "fuel",
      title: "АЗС",
      subtitle: "Оплата топлива",
      storeName: "АЗС",
      amountRub: 3250,
      merchantId: "m_demo_fuel",
      stepDelayMs: 760
    }
  ];

  const selectedScenario =
    demoScenarios.find((item) => item.key === selectedScenarioKey) || demoScenarios[0];

  const investorSteps = [
    { key: "scan", title: "Сканируем QR покупки" },
    { key: "crypto", title: "Списываем криптовалюту клиента" },
    { key: "convert", title: "Конвертируем в рубли" },
    { key: "payout", title: "Переводим рубли магазину по СБП" }
  ];

  const investorProgress = investorStep < 0
    ? 0
    : Math.min(((investorStep + 1) / investorSteps.length) * 100, 100);

  const runInvestorDemo = async () => {
    if (investorLoading) return;
    setInvestorOpen(true);
    setInvestorLoading(true);
    setInvestorError("");
    setInvestorResult(null);
    setResetInfo("");
    const uiStepDelay = Math.min(Math.max(Number(selectedScenario?.stepDelayMs || 500), 220), 900);
    const startedAt = Date.now();

    try {
      setInvestorStep(0);
      await sleep(uiStepDelay);

      setInvestorStep(1);
      await sleep(uiStepDelay);

      setInvestorStep(2);
      const data = await onRunDemo?.({
        scenario: selectedScenario.key,
        storeName: selectedScenario.storeName,
        merchantId: selectedScenario.merchantId,
        amountRub: selectedScenario.amountRub,
        stepDelayMs: selectedScenario.stepDelayMs
      });
      if (!data?.ok) {
        setInvestorError(data?.message || "Не удалось запустить demo");
        return;
      }

      const quote = data?.result?.quote || {};
      const economics = data?.result?.economics || {};
      const scenario = data?.result?.scenario || {};
      setInvestorStep(3);
      await sleep(uiStepDelay);

      setInvestorResult({
        scenarioTitle: scenario.title || selectedScenario.title,
        storeName: quote.storeName || selectedScenario.title || "Магазин",
        amountRub: Number(quote.amountRub || 0),
        amountUsdt: Number(quote.amountUsdt || 0),
        totalUsdt: Number(quote.totalUsdt || quote.amountUsdt || 0),
        feeUsdt: Number(quote.feeUsdt || 0),
        feeRub: Number(economics.feeRub || 0),
        merchantPayoutRub: Number(economics.merchantPayoutRub || quote.amountRub || 0),
        serviceMarginRub: Number(economics.serviceMarginRub || economics.feeRub || 0),
        grossMarginPercent: Number(economics.grossMarginPercent || 0),
        effectiveFeePercent: Number(economics.effectiveFeePercent || 0),
        durationSec: ((Date.now() - startedAt) / 1000).toFixed(1)
      });
    } catch {
      setInvestorError("Ошибка запуска demo");
    } finally {
      setInvestorLoading(false);
    }
  };

  const resetInvestorDemo = async () => {
    if (resetLoading || investorLoading) return;
    setResetLoading(true);
    setResetInfo("");
    setInvestorError("");
    try {
      const data = await onResetDemo?.();
      if (!data?.ok) {
        setResetInfo(data?.message || "Не удалось сбросить demo");
      } else {
        const deleted = Number(data?.result?.deleted || 0);
        setResetInfo(`Demo очищен. Удалено операций: ${deleted}`);
        setInvestorResult(null);
        setInvestorStep(-1);
      }
    } catch {
      setResetInfo("Не удалось сбросить demo");
    } finally {
      setResetLoading(false);
    }
  };

  const loadWalletStatus = async () => {
    try {
      setWalletStatus((prev) => ({ ...prev, loading: true }));
      const data = await apiGet(`/wallet/status?telegramId=${encodeURIComponent(telegramId)}`);
      setWalletStatus({
        connected: Boolean(data?.connected),
        balances: data?.balances || { usdt: 0, ton: 0 },
        loading: false
      });
      setWalletHint("");
    } catch {
      setWalletStatus({ connected: false, balances: { usdt: 0, ton: 0 }, loading: false });
      setWalletHint("");
    }
  };

  useEffect(() => {
    loadWalletStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telegramId]);

  useEffect(() => {
    const currentTonAddress = tonWallet?.account?.address || "";
    const previousAddress = previousTonAddress.current;
    if (currentTonAddress !== previousAddress) {
      loadWalletStatus();
    }
    previousTonAddress.current = currentTonAddress;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tonWallet?.account?.address]);

  useEffect(() => {
    const syncDirectBalance = async () => {
      const walletAddress = tonWallet?.account?.address;
      if (!walletAddress) return;
      try {
        const liveBalances = await fetchBalancesWithRetry(walletAddress, 2);
        setWalletStatus((prev) => ({
          ...prev,
          connected: true,
          loading: false,
          balances: liveBalances
        }));
        setWalletHint("");
      } catch {
        const hasAnyBalance = Number(onchainBalances.usdt || 0) > 0 || Number(onchainBalances.ton || 0) > 0;
        if (!hasAnyBalance) {
          setWalletHint("Обновим баланс через пару секунд...");
        }
      }
    };

    syncDirectBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tonWallet?.account?.address, onchainBalances.usdt, onchainBalances.ton]);

  return (
    <div className="page">
      <section className="home-profile">
        <div className="home-user">
          <div className="home-avatar">N</div>
          <div>
            <p className="home-name">Владелец счета</p>
            <p className="home-sub">ID {shortId}</p>
          </div>
        </div>
        <div className="home-badge">CRYP2SCAN</div>
      </section>

      {!isWalletConnected && (
        <section className="card home-wallet-prompt">
          <div>
            <p className="label">Кошелек</p>
            <p className="home-wallet-prompt-title">Подключите Telegram Wallet</p>
            <p className="home-wallet-prompt-sub">Чтобы видеть реальный TON/USDT баланс</p>
          </div>
          <button type="button" className="primary-btn home-wallet-prompt-btn" onClick={onOpenSettings}>
            Подключить
          </button>
        </section>
      )}

      {isWalletConnected && walletHint && <p className="home-status">{walletHint}</p>}
      {isWalletConnected && walletStatus.loading && <p className="home-status">Обновляем баланс...</p>}

      <section className="home-mini-cards">
        <article className="mini-card">
          <p>Все операции</p>
          <h3>₽ 0</h3>
          <span>Общие траты за месяц</span>
        </article>
        <article className="mini-card">
          <p>Кэшбэк и бонусы</p>
          <h3>0</h3>
          <span>Пока начислений нет</span>
        </article>
      </section>

      <section className="home-actions">
        <button type="button" className="action-btn action-btn-primary" onClick={onOpenTopUp}>
          <span>＋</span>
          <small>Пополнить</small>
        </button>
        <button type="button" className="action-btn">
          <span>↗</span>
          <small>Перевести</small>
        </button>
        <button type="button" className="action-btn">
          <span>⇄</span>
          <small>Обменять</small>
        </button>
      </section>

      <section className="card demo-card">
        <p className="label">Investor Demo</p>
        <p className="demo-card-sub">Сценарий для презентации: клиент платит криптой, магазин получает рубли</p>
        <div className="demo-scenarios">
          {demoScenarios.map((scenario) => (
            <button
              key={scenario.key}
              type="button"
              className={`demo-scenario-btn ${selectedScenarioKey === scenario.key ? "active" : ""}`}
              onClick={() => setSelectedScenarioKey(scenario.key)}
              disabled={investorLoading || resetLoading}
            >
              <b>{scenario.title}</b>
              <span>{scenario.subtitle}</span>
              <i>Чек: ₽ {formatNumber(scenario.amountRub)}</i>
            </button>
          ))}
        </div>
        <div className="demo-card-actions">
          <button
            type="button"
            className="secondary-btn demo-run-btn"
            onClick={runInvestorDemo}
            disabled={investorLoading}
          >
            {investorLoading ? "Идет Investor Demo..." : "Запустить Investor Demo"}
          </button>
          <button
            type="button"
            className="secondary-btn demo-reset-btn"
            onClick={resetInvestorDemo}
            disabled={resetLoading || investorLoading}
          >
            {resetLoading ? "Сбрасываем..." : "Сбросить demo"}
          </button>
        </div>
        {resetInfo && <p className="home-status">{resetInfo}</p>}
      </section>

      {investorOpen && (
        <section className="investor-overlay">
          <div className="card investor-modal">
            <div className="investor-head">
              <p className="label">Investor Demo</p>
              <button
                type="button"
                className="topup-back"
                onClick={() => setInvestorOpen(false)}
                disabled={investorLoading}
              >
                Закрыть
              </button>
            </div>

            <h3 className="investor-title">Клиент платит криптой, магазин получает рубли</h3>
            <p className="home-status">Сценарий: {selectedScenario.title}</p>

            <div className="investor-progress">
              <div style={{ width: `${investorProgress}%` }} />
            </div>

            <div className="investor-steps">
              {investorSteps.map((step, index) => (
                <article
                  className={`investor-step ${index <= investorStep ? "active" : ""}`}
                  key={step.key}
                >
                  <span>{index + 1}</span>
                  <p>{step.title}</p>
                </article>
              ))}
            </div>

            {investorLoading && <p className="home-status">Выполняем демонстрационный платеж...</p>}
            {investorError && <p className="bad">{investorError}</p>}

            {investorResult && (
              <>
                <section className="investor-summary">
                  <article>
                    <span>Сценарий</span>
                    <b>{investorResult.scenarioTitle}</b>
                  </article>
                  <article>
                    <span>Сумма покупки</span>
                    <b>₽ {formatNumber(investorResult.amountRub)}</b>
                  </article>
                  <article>
                    <span>Списано у клиента</span>
                    <b>{formatNumber(investorResult.totalUsdt)} USDT</b>
                  </article>
                  <article>
                    <span>Время сделки</span>
                    <b>{investorResult.durationSec} сек</b>
                  </article>
                </section>

                <section className="investor-economics">
                  <p className="label">Юнит-экономика сделки</p>
                  <div className="investor-economics-grid">
                    <article>
                      <span>Выплата магазину</span>
                      <b>₽ {formatNumber(investorResult.merchantPayoutRub)}</b>
                    </article>
                    <article>
                      <span>Комиссия сервиса</span>
                      <b>₽ {formatNumber(investorResult.feeRub)}</b>
                      <small>{formatNumber(investorResult.feeUsdt)} USDT</small>
                    </article>
                    <article>
                      <span>Маржа сервиса</span>
                      <b>₽ {formatNumber(investorResult.serviceMarginRub)}</b>
                    </article>
                    <article>
                      <span>Маржа от чека</span>
                      <b>{formatPercent(investorResult.grossMarginPercent)}%</b>
                      <small>Эфф. комиссия {formatPercent(investorResult.effectiveFeePercent)}%</small>
                    </article>
                  </div>
                </section>
              </>
            )}

            <div className="investor-actions">
              <button type="button" className="primary-btn" onClick={runInvestorDemo} disabled={investorLoading}>
                Запустить снова
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  setInvestorOpen(false);
                  onOpenHistory?.();
                }}
                disabled={investorLoading}
              >
                Открыть историю
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="wallet-slider-wrap">
        <p className="label">Кошелек</p>
        <div className="wallet-slider" onScroll={onBalanceScroll}>
          {balanceCards.map((card) => (
            <article className="wallet-card" key={card.code}>
              <div className="wallet-row">
                <div className="wallet-left">
                  <div>
                    <p className="wallet-card-code">{card.code}</p>
                    <span className="wallet-card-caption">
                      {card.code === "USDT" ? "Основной баланс" : "Дополнительный баланс"}
                    </span>
                  </div>
                </div>
                <div className="wallet-right">
                  <p className="wallet-rub">{formatNumber(card.amount * (rateByCode[card.code] || 0))} ₽</p>
                  <p className="wallet-asset">{formatNumber(card.amount)} {card.code}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="wallet-dots">
          {balanceCards.map((card, index) => (
            <span
              key={card.code}
              className={`wallet-dot ${activeBalanceCard === index ? "active" : ""}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
