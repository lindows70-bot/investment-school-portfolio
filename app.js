const MARKET_SYMBOLS = [
  { symbol: "AAPL", name: "Apple Inc.", type: "US Stock", currency: "USD" },
  { symbol: "TSLA", name: "Tesla", type: "US Stock", currency: "USD" },
  { symbol: "005930.KS", name: "Samsung Electronics", type: "KR Stock", currency: "KRW" },
  { symbol: "035720.KQ", name: "Kakao", type: "KR Stock", currency: "KRW" },
  { symbol: "BTC-USD", name: "Bitcoin", type: "Crypto", currency: "USD" },
  { symbol: "XRP-USD", name: "XRP", type: "Crypto", currency: "USD" },
];

const STORAGE_KEY = "portfolio-pulse-holdings";
const WATCHLIST_KEY = "portfolio-pulse-watchlist";
const TRANSACTIONS_KEY = "portfolio-pulse-transactions";
const SNAPSHOTS_KEY = "portfolio-pulse-snapshots";
const quoteCache = new Map();
const financialCache = new Map();
let fxRate = { usdKrw: 1350, updatedAt: null, source: "fallback" };

let selectedSymbol = "AAPL";
let selectedRange = { range: "1d", interval: "5m" };
let researchRange = { range: "1d", interval: "5m" };
let holdings = loadHoldings();
let watchlistItems = loadWatchlist();
let transactions = loadTransactions();
let assetSnapshots = loadSnapshots();

const el = {
  clock: document.querySelector("#clock"),
  connectionState: document.querySelector("#connectionState"),
  topFxRate: document.querySelector("#topFxRate"),
  watchlist: document.querySelector("#watchlist"),
  watchlistForm: document.querySelector("#watchlistForm"),
  watchSymbol: document.querySelector("#watchSymbol"),
  watchName: document.querySelector("#watchName"),
  selectedType: document.querySelector("#selectedType"),
  selectedName: document.querySelector("#selectedName"),
  selectedSymbol: document.querySelector("#selectedSymbol"),
  selectedPrice: document.querySelector("#selectedPrice"),
  selectedChange: document.querySelector("#selectedChange"),
  chart: document.querySelector("#priceChart"),
  financialUpdated: document.querySelector("#financialUpdated"),
  metricEps: document.querySelector("#metricEps"),
  metricBps: document.querySelector("#metricBps"),
  metricPbr: document.querySelector("#metricPbr"),
  metricPer: document.querySelector("#metricPer"),
  metricMarketCap: document.querySelector("#metricMarketCap"),
  metricCurrency: document.querySelector("#metricCurrency"),
  dataNotice: document.querySelector("#dataNotice"),
  averagePriceBadge: document.querySelector("#averagePriceBadge"),
  totalValue: document.querySelector("#totalValue"),
  totalCost: document.querySelector("#totalCost"),
  totalProfit: document.querySelector("#totalProfit"),
  totalReturn: document.querySelector("#totalReturn"),
  fxRate: document.querySelector("#fxRate"),
  dashboardTotalValue: document.querySelector("#dashboardTotalValue"),
  dashboardTotalProfit: document.querySelector("#dashboardTotalProfit"),
  dashboardTotalReturn: document.querySelector("#dashboardTotalReturn"),
  dashboardPositionCount: document.querySelector("#dashboardPositionCount"),
  dashboardUsdWeight: document.querySelector("#dashboardUsdWeight"),
  dashboardKrwWeight: document.querySelector("#dashboardKrwWeight"),
  dashboardCryptoWeight: document.querySelector("#dashboardCryptoWeight"),
  dashboardBest: document.querySelector("#dashboardBest"),
  dashboardWorst: document.querySelector("#dashboardWorst"),
  dashboardAllocationChart: document.querySelector("#dashboardAllocationChart"),
  dashboardPerformanceChart: document.querySelector("#dashboardPerformanceChart"),
  dashboardLeaders: document.querySelector("#dashboardLeaders"),
  dashboardHeatmap: document.querySelector("#dashboardHeatmap"),
  dashboardMiniCharts: document.querySelector("#dashboardMiniCharts"),
  dashboardMix: document.querySelector("#dashboardMix"),
  dashboardBrief: document.querySelector("#dashboardBrief"),
  portfolioRows: document.querySelector("#portfolioRows"),
  transactionForm: document.querySelector("#transactionForm"),
  transactionRows: document.querySelector("#transactionRows"),
  flowTotalAssets: document.querySelector("#flowTotalAssets"),
  flowRealizedPnl: document.querySelector("#flowRealizedPnl"),
  flowSellAmount: document.querySelector("#flowSellAmount"),
  flowTradeCount: document.querySelector("#flowTradeCount"),
  assetFlowChart: document.querySelector("#assetFlowChart"),
  realizedPnlChart: document.querySelector("#realizedPnlChart"),
  monthlyFlowRows: document.querySelector("#monthlyFlowRows"),
  yearlyFlowRows: document.querySelector("#yearlyFlowRows"),
  lynchCount: document.querySelector("#lynchCount"),
  lynchAvgPeg: document.querySelector("#lynchAvgPeg"),
  lynchGoodPeg: document.querySelector("#lynchGoodPeg"),
  lynchGrowthCoverage: document.querySelector("#lynchGrowthCoverage"),
  lynchUpdated: document.querySelector("#lynchUpdated"),
  lynchCards: document.querySelector("#lynchCards"),
  lynchRows: document.querySelector("#lynchRows"),
  lynchHealthRows: document.querySelector("#lynchHealthRows"),
  lynchCategoryGrid: document.querySelector("#lynchCategoryGrid"),
  pegChart: document.querySelector("#pegChart"),
  buffettCount: document.querySelector("#buffettCount"),
  buffettAvgScore: document.querySelector("#buffettAvgScore"),
  buffettQualityCount: document.querySelector("#buffettQualityCount"),
  buffettSellCount: document.querySelector("#buffettSellCount"),
  buffettUpdated: document.querySelector("#buffettUpdated"),
  buffettRows: document.querySelector("#buffettRows"),
  buffettChart: document.querySelector("#buffettChart"),
  researchType: document.querySelector("#researchType"),
  researchName: document.querySelector("#researchName"),
  researchSymbol: document.querySelector("#researchSymbol"),
  researchPrice: document.querySelector("#researchPrice"),
  researchChange: document.querySelector("#researchChange"),
  researchChart: document.querySelector("#researchChart"),
  researchChartPeriod: document.querySelector("#researchChartPeriod"),
  researchRangeTabs: document.querySelector("#researchRangeTabs"),
  researchUpdated: document.querySelector("#researchUpdated"),
  researchPer: document.querySelector("#researchPer"),
  researchPbr: document.querySelector("#researchPbr"),
  researchEps: document.querySelector("#researchEps"),
  researchGrowth: document.querySelector("#researchGrowth"),
  researchForwardEps: document.querySelector("#researchForwardEps"),
  researchPeg: document.querySelector("#researchPeg"),
  researchMarketCap: document.querySelector("#researchMarketCap"),
  researchNotes: document.querySelector("#researchNotes"),
};

const LYNCH_CATEGORIES = {
  slow: {
    title: "Slow Grower",
    subtitle: "완만한 성장주",
    summary: "연 2~4% 성장. 성숙한 대기업.",
    peg: "PEG: 성장 미약, 배당률로 판단",
  },
  stalwart: {
    title: "Stalwart",
    subtitle: "우량 성장주",
    summary: "연 10~12% 안정 성장. 대형 우량주.",
    peg: "PEG 1.0~1.5 적정",
  },
  fast: {
    title: "Fast Grower",
    subtitle: "고성장주",
    summary: "연 20%+ 고성장. 린치의 최애 유형.",
    peg: "PEG 0.5~1.0 이상적",
  },
  cyclical: {
    title: "Cyclical",
    subtitle: "경기민감주",
    summary: "경기 사이클에 따라 실적이 크게 변동.",
    peg: "PEG보다 사이클 국면이 더 중요",
  },
  turnaround: {
    title: "Turnaround",
    subtitle: "회생주",
    summary: "부진했으나 회복 중인 기업.",
    peg: "흑자 전환 여부가 핵심",
  },
  asset: {
    title: "Asset Play",
    subtitle: "자산주",
    summary: "주가에 반영 안 된 숨겨진 자산 보유.",
    peg: "자산가치/주가 비율이 핵심",
  },
};

function loadHoldings() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    const legacySample = parsed.length === 3 && parsed.some((item) => item.symbol === "AAPL") && parsed.some((item) => item.symbol === "005930.KS") && parsed.some((item) => item.symbol === "BTC-USD");
    if (legacySample) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

function saveHoldings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
}

function loadWatchlist() {
  const saved = localStorage.getItem(WATCHLIST_KEY);
  if (!saved) return MARKET_SYMBOLS;
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length ? parsed : MARKET_SYMBOLS;
  } catch {
    return MARKET_SYMBOLS;
  }
}

function saveWatchlist() {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlistItems));
}

function loadTransactions() {
  const saved = localStorage.getItem(TRANSACTIONS_KEY);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

function loadSnapshots() {
  const saved = localStorage.getItem(SNAPSHOTS_KEY);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSnapshots() {
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(assetSnapshots.slice(-240)));
}

function getKnownSymbol(symbol) {
  const normalized = normalizeSymbol(symbol);
  return (
    watchlistItems.find((item) => normalizeSymbol(item.symbol) === normalized) ||
    MARKET_SYMBOLS.find((item) => normalizeSymbol(item.symbol) === normalized)
  );
}

function formatMoney(value, currency = "USD") {
  const locale = currency === "KRW" ? "ko-KR" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatCompact(value, currency = "USD") {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat(currency === "KRW" ? "ko-KR" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: digits }).format(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayHoldingName(row) {
  return row?.name || row?.quote?.name || row?.holding?.name || row?.symbol || "-";
}

function normalizeSymbol(symbol) {
  const normalized = symbol.trim().toUpperCase();
  if (["BTC", "XRP", "ETH", "SOL", "DOGE"].includes(normalized)) return `${normalized}-USD`;
  if (normalized.startsWith("KRW-")) return `${normalized.replace("KRW-", "")}-USD`;
  return normalized;
}

function getHoldingAveragePrice(symbol) {
  const normalized = normalizeSymbol(symbol);
  const matching = holdings.filter((holding) => normalizeSymbol(holding.symbol) === normalized && holding.qty > 0);
  const totalQty = matching.reduce((sum, holding) => sum + Number(holding.qty || 0), 0);
  if (!totalQty) return null;
  const totalCost = matching.reduce((sum, holding) => sum + Number(holding.qty || 0) * Number(holding.avgPrice || 0), 0);
  return totalCost / totalQty;
}

async function fetchYahooChart(symbol, range = "1d", interval = "5m") {
  const url = `/api/chart?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`시세 요청 실패: ${response.status}`);
  const data = await response.json();
  const isUpbit = data.source === "upbit";
  const result = data.chart?.result?.[0];
  if (!result) throw new Error(data.chart?.error?.description || "시세 데이터가 없습니다.");

  const meta = result.meta;
  const quote = result.indicators?.quote?.[0] || {};
  const timestamps = result.timestamp || [];
  const closes = (quote.close || [])
    .map((price, index) => ({
      time: timestamps[index] * 1000,
      open: Number(quote.open?.[index]),
      high: Number(quote.high?.[index]),
      low: Number(quote.low?.[index]),
      close: Number(price),
      price,
      volume: Number(quote.volume?.[index]),
    }))
    .filter((point) => Number.isFinite(point.close));

  const previous = Number(meta.chartPreviousClose ?? closes[0]?.price ?? meta.regularMarketPrice);
  const current = Number(meta.regularMarketPrice ?? closes.at(-1)?.price ?? 0);
  const changePercent = previous ? ((current - previous) / previous) * 100 : 0;

  return {
    symbol,
    name: isUpbit ? `${symbol.replace("-USD", "")} 원화` : meta.longName || meta.shortName || symbol,
    type: classifySymbol(symbol),
    currency: meta.currency || guessCurrency(symbol),
    price: current,
    previous,
    changePercent,
    marketTime: meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now(),
    points: closes,
    source: isUpbit ? "upbit" : "live",
  };
}

async function fetchFinancials(symbol) {
  const url = `/api/financials?symbol=${encodeURIComponent(symbol)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`재무정보 요청 실패: ${response.status}`);
  const data = await response.json();
  const result = data.quoteSummary?.result?.[0];
  if (!result) throw new Error("재무정보가 없습니다.");

  const stats = result.defaultKeyStatistics || {};
  const summary = result.summaryDetail || {};
  const financial = result.financialData || {};
  const price = result.price || {};
  const bookValue = raw(stats.bookValue);
  const currentPrice = raw(price.regularMarketPrice);
  const pbr = raw(stats.priceToBook) || (bookValue && currentPrice ? currentPrice / bookValue : null);

  return {
    eps: raw(stats.trailingEps) ?? raw(financial.epsTrailingTwelveMonths),
    bps: bookValue,
    pbr,
    per: raw(summary.trailingPE),
    earningsGrowth: raw(financial.earningsGrowth),
    forwardEps: raw(financial.forwardEps) ?? raw(stats.forwardEps),
    totalCash: raw(financial.totalCash),
    totalDebt: raw(financial.totalDebt),
    debtToEquity: raw(financial.debtToEquity),
    returnOnEquity: raw(financial.returnOnEquity),
    profitMargins: raw(financial.profitMargins),
    freeCashflow: raw(financial.freeCashflow),
    currentRatio: raw(financial.currentRatio),
    marketCap: raw(price.marketCap),
    currency: price.currency || guessCurrency(symbol),
  };
}

function raw(value) {
  return value?.raw ?? value ?? null;
}

function classifySymbol(symbol) {
  if (symbol.endsWith("-USD")) return "Crypto";
  if (symbol.endsWith(".KS") || symbol.endsWith(".KQ")) return "KR Stock";
  return "US Stock";
}

function isEtfHolding(rowOrHolding) {
  const symbol = normalizeSymbol(rowOrHolding?.symbol || rowOrHolding?.holding?.symbol || "");
  const name = String(rowOrHolding?.name || rowOrHolding?.holding?.name || rowOrHolding?.quote?.name || "").toLowerCase();
  const compactName = name.replace(/\s+/g, "");
  return (
    symbol.includes("ETF") ||
    name.includes("etf") ||
    name.includes("tiger") ||
    name.includes("kodex") ||
    name.includes("ace") ||
    name.includes("plus") ||
    compactName.includes("1q") ||
    compactName.includes("sol") ||
    compactName.includes("hanaro") ||
    compactName.includes("kbstar") ||
    compactName.includes("arirang") ||
    compactName.includes("히어로즈") ||
    compactName.includes("마이티") ||
    compactName.includes("액티브") ||
    compactName.includes("인덱스") ||
    compactName.includes("레버리지") ||
    compactName.includes("인버스") ||
    compactName.includes("선물") ||
    name.includes("s&p") ||
    name.includes("200")
  );
}

function isBuffettEligible(rowOrHolding) {
  const symbol = normalizeSymbol(rowOrHolding?.symbol || rowOrHolding?.holding?.symbol || "");
  return !isEtfHolding(rowOrHolding) && !symbol.endsWith("-USD");
}

function guessCurrency(symbol) {
  return symbol.endsWith(".KS") || symbol.endsWith(".KQ") ? "KRW" : "USD";
}

async function fetchFxRate() {
  try {
    const response = await fetch("/api/fx?pair=USDKRW%3DX");
    if (!response.ok) throw new Error(`환율 요청 실패: ${response.status}`);
    const data = await response.json();
    if (!Number.isFinite(data.rate)) throw new Error("환율 데이터가 없습니다.");
    fxRate = { usdKrw: data.rate, updatedAt: data.updatedAt || Date.now(), source: "live" };
  } catch (error) {
    console.warn(error);
    fxRate = { usdKrw: fxRate.usdKrw || 1350, updatedAt: Date.now(), source: "fallback" };
  }
  if (el.fxRate) {
    el.fxRate.textContent = `${formatNumber(fxRate.usdKrw, 2)}원`;
  }
  if (el.topFxRate) {
    el.topFxRate.textContent = `USD/KRW ${formatNumber(fxRate.usdKrw, 2)}`;
  }
  return fxRate.usdKrw;
}

function getFxMultiplier(currency) {
  return currency === "USD" ? fxRate.usdKrw : 1;
}

function convertAmount(value, fromCurrency = "USD", toCurrency = "KRW") {
  if (!Number.isFinite(value)) return 0;
  if (fromCurrency === toCurrency) return value;
  if (fromCurrency === "USD" && toCurrency === "KRW") return value * fxRate.usdKrw;
  if (fromCurrency === "KRW" && toCurrency === "USD") return value / fxRate.usdKrw;
  return value;
}

function todayKey() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function monthKey(dateValue) {
  return String(dateValue || todayKey()).slice(0, 7);
}

function yearKey(dateValue) {
  return String(dateValue || todayKey()).slice(0, 4);
}

function findHoldingIndex(symbol) {
  const normalized = normalizeSymbol(symbol);
  return holdings.findIndex((holding) => normalizeSymbol(holding.symbol) === normalized);
}

function getHoldingCostBasis(symbol, fallbackCurrency = "KRW") {
  const index = findHoldingIndex(symbol);
  const holding = index >= 0 ? holdings[index] : null;
  const isCrypto = classifySymbol(symbol) === "Crypto";
  return {
    index,
    holding,
    qty: Number(holding?.qty || 0),
    avgPrice: Number(holding?.avgPrice || 0),
    currency: isCrypto ? "KRW" : holding?.currency || fallbackCurrency,
  };
}

function getHoldingCurrency(holding, quote) {
  if (classifySymbol(holding.symbol) === "Crypto") return "KRW";
  return holding.currency || quote?.currency || guessCurrency(holding.symbol);
}

function getDisplayQuotePrice(quote, holdingCurrency) {
  return convertAmount(Number(quote.price || 0), quote.currency || guessCurrency(quote.symbol), holdingCurrency);
}

function getPortfolioRowMetrics(holding, quote) {
  const currency = getHoldingCurrency(holding, quote);
  const qty = Number(holding.qty || 0);
  const avgPrice = Number(holding.avgPrice || 0);
  const currentPrice = getDisplayQuotePrice(quote, currency);
  const cost = qty * avgPrice;
  const value = qty * currentPrice;
  const profit = value - cost;
  const profitPercent = cost ? (profit / cost) * 100 : 0;
  return {
    currency,
    qty,
    avgPrice,
    currentPrice,
    cost,
    value,
    profit,
    profitPercent,
    costKrw: convertAmount(cost, currency, "KRW"),
    valueKrw: convertAmount(value, currency, "KRW"),
    profitKrw: convertAmount(profit, currency, "KRW"),
  };
}

function fallbackQuote(symbol) {
  const seed = [...symbol].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const currency = guessCurrency(symbol);
  const base = currency === "KRW" ? 45000 + seed * 80 : 80 + seed / 2;
  const points = Array.from({ length: 80 }, (_, index) => {
    const wave = Math.sin(index / 6) * base * 0.018;
    const drift = (index - 40) * base * 0.0008;
    return {
      time: Date.now() - (80 - index) * 60 * 1000,
      price: Math.max(1, base + wave + drift),
    };
  });
  const price = points.at(-1).price;
  const previous = points[0].price;
  return {
    symbol,
    name: getKnownSymbol(symbol)?.name || symbol,
    type: classifySymbol(symbol),
    currency,
    price,
    previous,
    changePercent: ((price - previous) / previous) * 100,
    marketTime: Date.now(),
    points,
    source: "fallback",
  };
}

async function getQuote(symbol, range = selectedRange.range, interval = selectedRange.interval) {
  const cacheKey = `${symbol}:${range}:${interval}`;
  const cached = quoteCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < 12_000) return cached.data;

  try {
    const quote = await fetchYahooChart(symbol, range, interval);
    quoteCache.set(cacheKey, { data: quote, fetchedAt: Date.now() });
    setStatus("실시간 연결", "ok");
    return quote;
  } catch (error) {
    console.warn(error);
    const quote = fallbackQuote(symbol);
    quoteCache.set(cacheKey, { data: quote, fetchedAt: Date.now() });
    setStatus("샘플 데이터", "warn");
    return quote;
  }
}

async function getFinancials(symbol) {
  const normalized = normalizeSymbol(symbol);
  const cached = financialCache.get(normalized);
  if (cached && Date.now() - cached.fetchedAt < 60_000) return cached.data;

  try {
    const financials = await fetchFinancials(normalized);
    financialCache.set(normalized, { data: financials, fetchedAt: Date.now() });
    return financials;
  } catch (error) {
    console.warn(error);
    const fallback = {
      eps: null,
      bps: null,
      pbr: null,
      per: null,
      earningsGrowth: null,
      forwardEps: null,
      totalCash: null,
      totalDebt: null,
      debtToEquity: null,
      returnOnEquity: null,
      profitMargins: null,
      freeCashflow: null,
      currentRatio: null,
      marketCap: null,
      currency: guessCurrency(normalized),
    };
    financialCache.set(normalized, { data: fallback, fetchedAt: Date.now() });
    return fallback;
  }
}

function setStatus(text, state = "idle") {
  el.connectionState.textContent = text;
  el.connectionState.style.borderColor =
    state === "ok" ? "rgba(117, 211, 123, 0.8)" : state === "warn" ? "rgba(245, 195, 91, 0.8)" : "var(--line)";
}

function renderWatchlist(quotes = []) {
  el.watchlist.innerHTML = "";
  if (!watchlistItems.length) {
    el.watchlist.innerHTML = `<p class="empty-note">관심 종목을 추가해보세요.</p>`;
    return;
  }
  watchlistItems.forEach((item) => {
    const quote = quotes.find((candidate) => candidate.symbol === item.symbol);
    const button = document.createElement("button");
    button.className = `watch-item ${item.symbol === selectedSymbol ? "active" : ""}`;
    button.dataset.symbol = item.symbol;
    button.innerHTML = `
      <div class="watch-meta"><strong>${item.symbol}</strong><span>${item.name}</span></div>
      <div class="watch-quote">
        <strong>${quote ? formatMoney(quote.price, quote.currency) : "-"}</strong>
        <span class="${quote ? changeClass(quote.changePercent) : "change neutral"}">${quote ? quote.changePercent.toFixed(2) : "0.00"}%</span>
      </div>
      <span class="remove-watch" data-symbol="${item.symbol}" title="관심종목 삭제">×</span>
    `;
    button.addEventListener("click", (event) => {
      if (event.target.closest(".remove-watch")) return;
      selectSymbol(item.symbol);
    });
    el.watchlist.append(button);
  });
}

function changeClass(value) {
  if (value > 0) return "change up";
  if (value < 0) return "change down";
  return "change neutral";
}

async function selectSymbol(symbol) {
  selectedSymbol = normalizeSymbol(symbol);
  document.querySelector("#symbolInput").value = selectedSymbol;
  renderWatchlist([...quoteCache.values()].map((entry) => entry.data));
  await renderSelectedQuote();
}

async function renderSelectedQuote() {
  setStatus("조회 중", "idle");
  const quote = await getQuote(selectedSymbol);
  const financials = await getFinancials(selectedSymbol);

  el.selectedType.textContent = quote.type;
  el.selectedName.textContent = quote.name;
  el.selectedSymbol.textContent = quote.symbol;
  el.selectedPrice.textContent = formatMoney(quote.price, quote.currency);
  el.selectedChange.textContent = `${quote.changePercent.toFixed(2)}%`;
  el.selectedChange.className = changeClass(quote.changePercent);
  el.metricEps.textContent = formatNumber(financials.eps);
  el.metricBps.textContent = formatNumber(financials.bps);
  el.metricPbr.textContent = formatNumber(financials.pbr);
  el.metricPer.textContent = formatNumber(financials.per);
  el.metricMarketCap.textContent = financials.marketCap ? formatCompact(financials.marketCap, financials.currency) : "-";
  el.metricCurrency.textContent = financials.currency || quote.currency;
  el.financialUpdated.textContent = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  el.dataNotice.textContent =
    quote.source === "live"
      ? "서버 프록시를 통해 최신 시세와 차트를 가져왔습니다. 화면은 15초마다 자동 갱신됩니다."
      : "브라우저 네트워크 또는 CORS 제한으로 샘플 데이터가 표시 중입니다. 백엔드 프록시/API 키를 연결하면 실시간성을 강화할 수 있습니다.";

  const averagePrice = getHoldingAveragePrice(quote.symbol);
  renderAveragePriceBadge(averagePrice, quote.currency);
  drawChart(quote.points, quote.currency);
  const researchQuote = await getQuote(selectedSymbol, researchRange.range, researchRange.interval);
  renderResearchDetail(researchQuote, financials);
  renderWatchlist([...quoteCache.values()].map((entry) => entry.data));
  await renderPortfolio();
}

function renderAveragePriceBadge(averagePrice, currency) {
  if (Number.isFinite(averagePrice) && averagePrice > 0) {
    el.averagePriceBadge.hidden = false;
    el.averagePriceBadge.textContent = `내 평균단가 ${formatMoney(averagePrice, currency)}`;
    return;
  }
  el.averagePriceBadge.hidden = true;
  el.averagePriceBadge.textContent = "평균단가 -";
}

function drawChart(points, currency, canvas = el.chart) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  if (!points.length) {
    ctx.fillStyle = "#9ba89d";
    ctx.fillText("차트 데이터가 없습니다.", 24, 40);
    return;
  }

  const hasOhlc = points.some((point) => Number.isFinite(point.open) && Number.isFinite(point.high) && Number.isFinite(point.low) && Number.isFinite(point.close));
  const prices = points.flatMap((point) =>
    hasOhlc ? [point.high, point.low].filter(Number.isFinite) : [point.price].filter(Number.isFinite),
  );
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const padX = 78;
  const padTop = 24;
  const padBottom = hasOhlc ? 82 : 28;
  const priceHeight = height - padTop - padBottom;
  const volumeTop = height - 52;
  const range = max - min || 1;

  ctx.fillStyle = "#f8fbf8";
  ctx.fillRect(padX, padTop, width - padX * 2, priceHeight);
  if (hasOhlc) ctx.fillRect(padX, volumeTop, width - padX * 2, 34);

  ctx.strokeStyle = "rgba(20, 32, 25, 0.10)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = padTop + (priceHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(width - padX, y);
    ctx.stroke();
  }

  const xFor = (index) => padX + (index / Math.max(points.length - 1, 1)) * (width - padX * 2);
  const yFor = (price) => padTop + priceHeight - ((price - min) / range) * priceHeight;
  const isUp = points.at(-1).price >= points[0].price;

  if (hasOhlc) {
    const candleWidth = Math.max(3, Math.min(12, ((width - padX * 2) / Math.max(points.length, 1)) * 0.58));
    const maxVolume = Math.max(1, ...points.map((point) => Number(point.volume) || 0));
    points.forEach((point, index) => {
      const x = xFor(index);
      const up = point.close >= point.open;
      const color = up ? "#e14141" : "#2f8cff";
      const yHigh = yFor(point.high);
      const yLow = yFor(point.low);
      const yOpen = yFor(point.open);
      const yClose = yFor(point.close);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillRect(x - candleWidth / 2, Math.min(yOpen, yClose), candleWidth, Math.max(2, Math.abs(yClose - yOpen)));
      const volumeHeight = ((Number(point.volume) || 0) / maxVolume) * 30;
      ctx.fillStyle = up ? "rgba(225, 65, 65, 0.28)" : "rgba(47, 140, 255, 0.28)";
      ctx.fillRect(x - candleWidth / 2, volumeTop + 34 - volumeHeight, candleWidth, volumeHeight);
    });
    const ma = (count) =>
      points.map((_, index) => {
        const slice = points.slice(Math.max(0, index - count + 1), index + 1);
        return slice.reduce((sum, point) => sum + point.close, 0) / slice.length;
      });
    [
      { values: ma(5), color: "rgba(245, 176, 65, 0.95)" },
      { values: ma(20), color: "rgba(103, 126, 234, 0.85)" },
    ].forEach((line) => {
      ctx.beginPath();
      line.values.forEach((value, index) => {
        const x = xFor(index);
        const y = yFor(value);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    });
  } else {
    ctx.beginPath();
    points.forEach((point, index) => {
      const x = xFor(index);
      const y = yFor(point.price);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = isUp ? "#75d37b" : "#ff6b6b";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.fillStyle = "#415047";
  ctx.font = "12px system-ui";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 5; i += 1) {
    const value = max - (range / 4) * i;
    const y = padTop + (priceHeight / 4) * i;
    const label = formatMoney(value, currency);
    ctx.textAlign = "left";
    ctx.fillText(label, 10, y);
    ctx.textAlign = "right";
    ctx.fillText(label, width - 10, y);
  }
}

function percentile(values, ratio) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))];
}

function drawChart(points, currency, canvas = el.chart) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  if (!points.length) {
    ctx.fillStyle = "#9ba89d";
    ctx.fillText("차트 데이터가 없습니다.", 24, 40);
    return;
  }

  const candlePoints = points.filter(
    (point) =>
      Number.isFinite(point.open) &&
      Number.isFinite(point.high) &&
      Number.isFinite(point.low) &&
      Number.isFinite(point.close),
  );
  const hasOhlc = candlePoints.length >= Math.min(8, points.length);
  const basePoints = hasOhlc ? candlePoints : points;
  const rawPrices = basePoints
    .flatMap((point) => (hasOhlc ? [point.open, point.high, point.low, point.close] : [point.price]))
    .filter(Number.isFinite);
  const centerPrices = basePoints
    .flatMap((point) => (hasOhlc ? [point.open, point.close] : [point.price]))
    .filter(Number.isFinite);
  const qLow = percentile(rawPrices, 0.03);
  const qHigh = percentile(rawPrices, 0.97);
  const centerMin = Math.min(...centerPrices);
  const centerMax = Math.max(...centerPrices);
  const spread = Math.max((qHigh ?? centerMax) - (qLow ?? centerMin), centerMax * 0.01, 1);
  const min = Math.min(centerMin, qLow ?? centerMin) - spread * 0.08;
  const max = Math.max(centerMax, qHigh ?? centerMax) + spread * 0.08;
  const padX = 78;
  const padTop = 24;
  const padBottom = hasOhlc ? 82 : 28;
  const priceHeight = height - padTop - padBottom;
  const volumeTop = height - 52;
  const range = max - min || 1;

  const bg = ctx.createLinearGradient(0, padTop, 0, height);
  bg.addColorStop(0, "rgba(32, 39, 32, 0.98)");
  bg.addColorStop(1, "rgba(17, 21, 19, 0.98)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(238, 244, 238, 0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = padTop + (priceHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(width - padX, y);
    ctx.stroke();
  }

  const xFor = (index) => padX + (index / Math.max(basePoints.length - 1, 1)) * (width - padX * 2);
  const yFor = (price) => {
    const clamped = Math.min(max, Math.max(min, price));
    return padTop + priceHeight - ((clamped - min) / range) * priceHeight;
  };
  const isUp = basePoints.at(-1).price >= basePoints[0].price;

  if (hasOhlc) {
    const candleWidth = Math.max(2, Math.min(10, ((width - padX * 2) / Math.max(basePoints.length, 1)) * 0.54));
    const maxVolume = Math.max(1, ...basePoints.map((point) => Number(point.volume) || 0));
    basePoints.forEach((point, index) => {
      const x = xFor(index);
      const up = point.close >= point.open;
      const color = up ? "#e05f5f" : "#57a3ff";
      const yHigh = yFor(point.high);
      const yLow = yFor(point.low);
      const yOpen = yFor(point.open);
      const yClose = yFor(point.close);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillRect(x - candleWidth / 2, Math.min(yOpen, yClose), candleWidth, Math.max(2, Math.abs(yClose - yOpen)));
      const volumeHeight = ((Number(point.volume) || 0) / maxVolume) * 30;
      ctx.fillStyle = up ? "rgba(224, 95, 95, 0.28)" : "rgba(87, 163, 255, 0.28)";
      ctx.fillRect(x - candleWidth / 2, volumeTop + 34 - volumeHeight, candleWidth, volumeHeight);
    });

    const ma = (count) =>
      basePoints.map((_, index) => {
        const slice = basePoints.slice(Math.max(0, index - count + 1), index + 1);
        return slice.reduce((sum, point) => sum + point.close, 0) / slice.length;
      });

    [
      { values: ma(5), color: "rgba(245, 195, 91, 0.95)" },
      { values: ma(20), color: "rgba(137, 154, 255, 0.85)" },
    ].forEach((line) => {
      ctx.beginPath();
      line.values.forEach((value, index) => {
        const x = xFor(index);
        const y = yFor(value);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    });
  } else {
    ctx.beginPath();
    basePoints.forEach((point, index) => {
      const x = xFor(index);
      const y = yFor(point.price);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = isUp ? "#75d37b" : "#ff6b6b";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.fillStyle = "#9ba89d";
  ctx.font = "12px system-ui";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 5; i += 1) {
    const value = max - (range / 4) * i;
    const y = padTop + (priceHeight / 4) * i;
    const label = formatMoney(value, currency);
    ctx.textAlign = "left";
    ctx.fillText(label, 10, y);
    ctx.textAlign = "right";
    ctx.fillText(label, width - 10, y);
  }
}

function buildResearchNotes(quote, financials) {
  const growthPercent = getGrowthPercent(financials);
  const peg = financials.per && growthPercent && growthPercent > 0 ? financials.per / growthPercent : null;
  const category = classifyLynchCategory({
    holding: { symbol: quote.symbol, name: quote.name },
    quote,
    financials,
    growthPercent,
  });
  const opinion = getPegOpinion(peg, growthPercent);
  const notes = [
    {
      label: "피터린치 분류",
      value: LYNCH_CATEGORIES[category]?.title || "-",
      detail: LYNCH_CATEGORIES[category]?.summary || "분류에 필요한 데이터가 부족합니다.",
    },
    {
      label: "PEG 해석",
      value: Number.isFinite(peg) ? peg.toFixed(2) : "-",
      detail: opinion.label,
    },
    {
      label: "선택 기간 가격흐름",
      value: `${quote.changePercent.toFixed(2)}%`,
      detail:
        selectedRange.range === "1d"
          ? "당일 기준가 대비 현재가 변화율입니다."
          : `현재 선택한 ${selectedRange.range.toUpperCase()} 차트 구간의 기준가 대비 변화율입니다.`,
    },
    {
      label: "Forward EPS",
      value: Number.isFinite(financials.forwardEps) ? formatNumber(financials.forwardEps) : "-",
      detail: Number.isFinite(financials.forwardEps)
        ? "애널리스트 예상 이익 기준 EPS입니다."
        : "제공처에서 예상 EPS를 제공하지 않는 종목입니다.",
    },
  ];

  if (!Number.isFinite(growthPercent)) {
    notes.push({
      label: "데이터 주의",
      value: "성장률 없음",
      detail: "EPS 성장률 데이터가 제공되지 않아 PEG 판단을 보수적으로 봐야 합니다.",
    });
  }

  return notes;
}

function drawSparklineChart(points, currency, canvas) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const closes = points.map((point) => ({ ...point, price: Number(point.close ?? point.price) })).filter((point) => Number.isFinite(point.price));
  if (!closes.length) {
    ctx.fillStyle = "#9ba89d";
    ctx.fillText("차트 데이터가 없습니다.", 24, 40);
    return;
  }

  const prices = closes.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const padX = 78;
  const padY = 30;
  const range = max - min || 1;
  const xFor = (index) => padX + (index / Math.max(closes.length - 1, 1)) * (width - padX * 2);
  const yFor = (price) => height - padY - ((price - min) / range) * (height - padY * 2);
  const isUp = closes.at(-1).price >= closes[0].price;

  ctx.strokeStyle = "rgba(238, 244, 238, 0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = padY + ((height - padY * 2) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(width - padX, y);
    ctx.stroke();
  }

  const gradient = ctx.createLinearGradient(0, padY, 0, height - padY);
  gradient.addColorStop(0, isUp ? "rgba(117, 211, 123, 0.28)" : "rgba(255, 107, 107, 0.24)");
  gradient.addColorStop(1, "rgba(24, 29, 26, 0)");
  ctx.beginPath();
  closes.forEach((point, index) => {
    const x = xFor(index);
    const y = yFor(point.price);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(width - padX, height - padY);
  ctx.lineTo(padX, height - padY);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  closes.forEach((point, index) => {
    const x = xFor(index);
    const y = yFor(point.price);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = isUp ? "#75d37b" : "#ff6b6b";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#9ba89d";
  ctx.font = "12px system-ui";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 5; i += 1) {
    const value = max - (range / 4) * i;
    const y = padY + ((height - padY * 2) / 4) * i;
    const label = formatMoney(value, currency);
    ctx.textAlign = "left";
    ctx.fillText(label, 10, y);
    ctx.textAlign = "right";
    ctx.fillText(label, width - 10, y);
  }
}

function renderResearchDetail(quote, financials) {
  if (!el.researchChart) return;
  const growthPercent = getGrowthPercent(financials);
  const peg = financials.per && growthPercent && growthPercent > 0 ? financials.per / growthPercent : null;

  el.researchType.textContent = quote.type;
  el.researchName.textContent = quote.name;
  el.researchSymbol.textContent = quote.symbol;
  el.researchPrice.textContent = formatMoney(quote.price, quote.currency);
  el.researchChange.textContent = `${quote.changePercent.toFixed(2)}%`;
  el.researchChange.className = changeClass(quote.changePercent);
  el.researchUpdated.textContent = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  el.researchPer.textContent = formatNumber(financials.per);
  el.researchPbr.textContent = formatNumber(financials.pbr);
  el.researchEps.textContent = formatNumber(financials.eps);
  el.researchGrowth.textContent = formatPercent(growthPercent);
  el.researchForwardEps.textContent = formatNumber(financials.forwardEps);
  el.researchPeg.textContent = Number.isFinite(peg) ? peg.toFixed(2) : "-";
  el.researchMarketCap.textContent = financials.marketCap ? formatCompact(financials.marketCap, financials.currency) : "-";
  setText(el.researchChartPeriod, `${rangeLabel(researchRange.range)} 차트`);

  drawSparklineChart(quote.points, quote.currency, el.researchChart);
  el.researchNotes.innerHTML = buildResearchNotes(quote, financials)
    .map(
      (note) => `
        <article>
          <span>${escapeHtml(note.label)}</span>
          <strong>${escapeHtml(note.value)}</strong>
          <p>${escapeHtml(note.detail)}</p>
        </article>
      `,
    )
    .join("");
}

async function renderPortfolio() {
  await fetchFxRate();
  const quoteResults = await Promise.all(holdings.map((holding) => getQuote(holding.symbol, "1d", "5m")));
  let totalCostKrw = 0;
  let totalValueKrw = 0;
  el.portfolioRows.innerHTML = "";

  holdings.forEach((holding, index) => {
    const quote = quoteResults[index] || fallbackQuote(holding.symbol);
    const metrics = getPortfolioRowMetrics(holding, quote);
    totalCostKrw += metrics.costKrw;
    totalValueKrw += metrics.valueKrw;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(holding.name || quote.name)}</strong><br><span class="muted">${escapeHtml(holding.symbol)}</span></td>
      <td>
        <input class="portfolio-edit" data-index="${index}" data-field="qty" type="number" min="0" step="0.000001" value="${holding.qty}" title="수량 수정" />
      </td>
      <td>
        <input class="portfolio-edit" data-index="${index}" data-field="avgPrice" type="number" min="0" step="0.01" value="${holding.avgPrice}" title="평균단가 수정" />
      </td>
      <td>
        <strong>${formatMoney(metrics.currentPrice, metrics.currency)}</strong>
        ${quote.currency !== metrics.currency ? `<br><span class="muted">${formatMoney(quote.price, quote.currency)} 환산</span>` : ""}
      </td>
      <td>${formatMoney(metrics.value, metrics.currency)}</td>
      <td><span class="${changeClass(metrics.profit)}">${formatMoney(metrics.profit, metrics.currency)} (${metrics.profitPercent.toFixed(2)}%)</span></td>
      <td>
        <div class="row-actions">
          <button class="move-row" data-index="${index}" data-direction="up" title="위로" ${index === 0 ? "disabled" : ""}>↑</button>
          <button class="move-row" data-index="${index}" data-direction="down" title="아래로" ${index === holdings.length - 1 ? "disabled" : ""}>↓</button>
          <button class="delete-row" data-index="${index}" title="삭제">×</button>
        </div>
      </td>
    `;
    el.portfolioRows.append(row);
  });

  const totalProfit = totalValueKrw - totalCostKrw;
  const totalReturn = totalCostKrw ? (totalProfit / totalCostKrw) * 100 : 0;
  el.totalValue.textContent = formatMoney(totalValueKrw, "KRW");
  el.totalCost.textContent = formatMoney(totalCostKrw, "KRW");
  el.totalProfit.textContent = formatMoney(totalProfit, "KRW");
  el.totalProfit.className = totalProfit >= 0 ? "up-text" : "down-text";
  el.totalReturn.textContent = `${totalReturn.toFixed(2)}%`;
  el.totalReturn.className = totalReturn >= 0 ? "up-text" : "down-text";
  renderPortfolioDashboard(quoteResults);
  recordPortfolioSnapshot(buildPortfolioMetrics(quoteResults));
  renderFlowDashboard();
}

function buildPortfolioMetrics(quoteResults = []) {
  const rows = holdings.map((holding, index) => {
    const quote = quoteResults[index] || fallbackQuote(holding.symbol);
    const metrics = getPortfolioRowMetrics(holding, quote);
    const assetType = classifySymbol(holding.symbol);
    return {
      holding,
      quote,
      metrics,
      assetType,
      symbol: holding.symbol,
      name: holding.name || quote.name,
    };
  });
  const totalCostKrw = rows.reduce((sum, row) => sum + row.metrics.costKrw, 0);
  const totalValueKrw = rows.reduce((sum, row) => sum + row.metrics.valueKrw, 0);
  const totalProfitKrw = totalValueKrw - totalCostKrw;
  return {
    rows: rows.map((row) => ({
      ...row,
      weight: totalValueKrw ? (row.metrics.valueKrw / totalValueKrw) * 100 : 0,
    })),
    totalCostKrw,
    totalValueKrw,
    totalProfitKrw,
    totalReturn: totalCostKrw ? (totalProfitKrw / totalCostKrw) * 100 : 0,
  };
}

function sumWeight(rows, predicate) {
  return rows.filter(predicate).reduce((sum, row) => sum + row.weight, 0);
}

function summarizeRows(rows) {
  const cost = rows.reduce((sum, row) => sum + row.metrics.costKrw, 0);
  const value = rows.reduce((sum, row) => sum + row.metrics.valueKrw, 0);
  const profit = value - cost;
  return {
    cost,
    value,
    profit,
    returnPercent: cost ? (profit / cost) * 100 : 0,
  };
}

function assetLabel(type) {
  return {
    "US Stock": "미국주식",
    "KR Stock": "한국주식",
    Crypto: "암호화폐",
  }[type] || type;
}

function setText(node, value) {
  if (node) node.textContent = value;
}

function getGrowthPercent(financials) {
  const trailingGrowth = Number.isFinite(financials.earningsGrowth) ? financials.earningsGrowth * 100 : null;
  const forwardGrowth =
    Number.isFinite(financials.forwardEps) && Number.isFinite(financials.eps) && financials.eps > 0
      ? ((financials.forwardEps - financials.eps) / financials.eps) * 100
      : null;
  if (Number.isFinite(forwardGrowth) && forwardGrowth > 0) return forwardGrowth;
  return trailingGrowth;
}

function renderPortfolioDashboard(quoteResults = []) {
  if (!el.dashboardTotalValue) return;
  const summary = buildPortfolioMetrics(quoteResults);
  const rows = summary.rows;
  const winners = rows.slice().sort((a, b) => b.metrics.profitPercent - a.metrics.profitPercent);
  const best = winners[0];
  const worst = winners.at(-1);
  const usdWeight = sumWeight(rows, (row) => row.metrics.currency === "USD");
  const krwWeight = sumWeight(rows, (row) => row.metrics.currency === "KRW");
  const cryptoWeight = sumWeight(rows, (row) => row.assetType === "Crypto");

  setText(el.dashboardTotalValue, formatMoney(summary.totalValueKrw, "KRW"));
  setText(el.dashboardTotalProfit, formatMoney(summary.totalProfitKrw, "KRW"));
  setText(el.dashboardTotalReturn, `${summary.totalReturn.toFixed(2)}%`);
  setText(el.dashboardPositionCount, `${rows.length}개`);
  setText(el.dashboardUsdWeight, `${usdWeight.toFixed(1)}%`);
  setText(el.dashboardKrwWeight, `${krwWeight.toFixed(1)}%`);
  setText(el.dashboardCryptoWeight, `${cryptoWeight.toFixed(1)}%`);
  setText(el.dashboardBest, best ? `최고 ${displayHoldingName(best)} ${best.metrics.profitPercent.toFixed(1)}%` : "-");
  setText(el.dashboardWorst, worst ? `최저 ${displayHoldingName(worst)} ${worst.metrics.profitPercent.toFixed(1)}%` : "-");
  el.dashboardTotalProfit?.classList.toggle("down-text", summary.totalProfitKrw < 0);
  el.dashboardTotalProfit?.classList.toggle("up-text", summary.totalProfitKrw >= 0);
  el.dashboardTotalReturn?.classList.toggle("down-text", summary.totalReturn < 0);
  el.dashboardTotalReturn?.classList.toggle("up-text", summary.totalReturn >= 0);

  renderDashboardLeadersAll(rows);
  renderDashboardHeatmapSplit(rows);
  renderDashboardMiniChartsByAsset(rows);
  renderDashboardMix(rows);
  drawAllocationChart(rows);
  drawPerformanceChart(rows);
  renderDashboardBriefByAsset(summary);
}

function renderDashboardLeaders(rows) {
  if (!el.dashboardLeaders) return;
  if (!rows.length) {
    el.dashboardLeaders.innerHTML = `<p class="empty-note">포트폴리오 종목을 추가하면 손익 순위가 표시됩니다.</p>`;
    return;
  }
  el.dashboardLeaders.innerHTML = rows
    .slice()
    .sort((a, b) => b.metrics.profitKrw - a.metrics.profitKrw)
    .map(
      (row) => `
        <article class="dashboard-row">
          <div><strong>${escapeHtml(displayHoldingName(row))}</strong><span>${escapeHtml(row.symbol)}</span></div>
          <div>
            <strong class="${row.metrics.profitKrw >= 0 ? "up-text" : "down-text"}">${formatMoney(row.metrics.profit, row.metrics.currency)}</strong>
            <span>${row.metrics.profitPercent.toFixed(2)}% · 비중 ${row.weight.toFixed(1)}%</span>
          </div>
        </article>
      `,
    )
    .join("") || `<p class="empty-note">현재 플러스 수익 종목이 없습니다.</p>`;
}

function renderDashboardMiniCharts(rows) {
  if (!el.dashboardMiniCharts) return;
  if (!rows.length) {
    el.dashboardMiniCharts.innerHTML = `<p class="empty-note">포트폴리오 종목을 추가하면 미니차트가 표시됩니다.</p>`;
    return;
  }
  el.dashboardMiniCharts.innerHTML = rows
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .map((row, index) => {
      const points = (row.quote.points || []).slice(-36);
      const values = points.map((point) => point.price).filter(Number.isFinite);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min || 1;
      const path = values
        .map((value, pointIndex) => {
          const x = values.length <= 1 ? 0 : (pointIndex / (values.length - 1)) * 100;
          const y = 30 - ((value - min) / range) * 28;
          return `${pointIndex ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
      return `
        <article class="mini-chart-row">
          <div class="mini-chart-rank">${index + 1}</div>
          <div class="mini-chart-name">
            <strong>${escapeHtml(displayHoldingName(row))}</strong>
            <span>${escapeHtml(row.symbol)} · 비중 ${row.weight.toFixed(1)}%</span>
          </div>
          <svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
            <path d="${path}" class="${row.quote.changePercent >= 0 ? "mini-up" : "mini-down"}"></path>
          </svg>
          <div class="mini-chart-period">${rangeLabel("1d")}</div>
          <div class="mini-chart-return">
            <strong class="${row.metrics.profitKrw >= 0 ? "up-text" : "down-text"}">${row.metrics.profitPercent.toFixed(1)}%</strong>
            <span>${formatMoney(row.metrics.value, row.metrics.currency)}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderDashboardMix(rows) {
  if (!el.dashboardMix) return;
  const groups = [
    { label: "미국주식", value: sumWeight(rows, (row) => row.assetType === "US Stock") },
    { label: "한국주식", value: sumWeight(rows, (row) => row.assetType === "KR Stock") },
    { label: "암호화폐", value: sumWeight(rows, (row) => row.assetType === "Crypto") },
  ];
  el.dashboardMix.innerHTML = groups
    .map(
      (group) => `
        <div class="mix-row">
          <span>${group.label}</span>
          <strong>${group.value.toFixed(1)}%</strong>
          <i style="--bar:${Math.max(group.value, 1)}%"></i>
        </div>
      `,
    )
    .join("");
}

function renderDashboardBrief(summary) {
  if (!el.dashboardBrief) return;
  const largest = summary.rows.slice().sort((a, b) => b.weight - a.weight)[0];
  const cashTone = summary.totalProfitKrw >= 0 ? "수익 구간" : "손실 구간";
  const concentration =
    largest && largest.weight >= 35
      ? `${displayHoldingName(largest)} 비중이 ${largest.weight.toFixed(1)}%로 큽니다.`
      : "단일 종목 집중도는 과하지 않습니다.";
  el.dashboardBrief.innerHTML = `
    <article><strong>${cashTone}</strong><span>총 수익률 ${summary.totalReturn.toFixed(2)}%, 평가손익 ${formatMoney(summary.totalProfitKrw, "KRW")}</span></article>
    <article><strong>집중도</strong><span>${concentration}</span></article>
    <article><strong>환율</strong><span>USD/KRW ${formatNumber(fxRate.usdKrw, 2)} 기준으로 원화 평가금액을 계산했습니다.</span></article>
  `;
}

function renderDashboardLeadersAll(rows) {
  if (!el.dashboardLeaders) return;
  if (!rows.length) {
    el.dashboardLeaders.innerHTML = `<p class="empty-note">포트폴리오 종목을 추가하면 전체 손익 순위가 표시됩니다.</p>`;
    return;
  }
  el.dashboardLeaders.innerHTML = rows
    .slice()
    .sort((a, b) => b.metrics.profitKrw - a.metrics.profitKrw)
    .map(
      (row) => `
        <article class="dashboard-row">
          <div><strong>${escapeHtml(displayHoldingName(row))}</strong><span>${escapeHtml(row.symbol)}</span></div>
          <div>
            <strong class="${row.metrics.profitKrw >= 0 ? "up-text" : "down-text"}">${formatMoney(row.metrics.profit, row.metrics.currency)}</strong>
            <span>${row.metrics.profitPercent.toFixed(2)}% · 비중 ${row.weight.toFixed(1)}%</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function heatmapColor(percent) {
  if (!Number.isFinite(percent) || Math.abs(percent) < 0.2) return "rgba(75, 82, 78, 0.92)";
  const strength = Math.min(Math.abs(percent) / 28, 1);
  if (percent > 0) {
    const green = Math.round(92 + strength * 68);
    return `rgb(${Math.round(24 + strength * 6)}, ${green}, ${Math.round(78 + strength * 12)})`;
  }
  const red = Math.round(122 + strength * 76);
  return `rgb(${red}, ${Math.round(34 + strength * 12)}, ${Math.round(48 + strength * 8)})`;
}

function renderDashboardHeatmap(rows) {
  if (!el.dashboardHeatmap) return;
  if (!rows.length) {
    el.dashboardHeatmap.innerHTML = `<p class="empty-note">포트폴리오 종목을 추가하면 히트맵이 표시됩니다.</p>`;
    return;
  }
  const groups = ["US Stock", "KR Stock", "Crypto"]
    .map((type) => ({
      type,
      rows: rows.filter((row) => row.assetType === type).sort((a, b) => b.metrics.valueKrw - a.metrics.valueKrw),
    }))
    .filter((group) => group.rows.length);
  el.dashboardHeatmap.innerHTML = groups
    .map(
      (group) => `
        <section class="heatmap-group">
          <header><strong>${assetLabel(group.type)}</strong><span>${group.rows.length}종목</span></header>
          <div class="heatmap-tiles">
            ${group.rows
              .map((row) => {
                const weight = Math.max(row.weight, 2);
                const tileClass = weight >= 18 ? "large" : weight >= 8 ? "medium" : weight >= 4 ? "small" : "tiny";
                const tileSize = Math.max(tileClass === "tiny" ? 70 : 92, weight * 20);
                const height = Math.max(tileClass === "tiny" ? 64 : 76, Math.min(170, 64 + Math.sqrt(weight) * 22));
                const initial = (displayHoldingName(row) || row.symbol).slice(0, 1).toUpperCase();
                return `
                  <article
                    class="heatmap-tile ${tileClass}"
                    style="--tile-size:${tileSize}; --tile-height:${height}px; --heat-color:${heatmapColor(row.metrics.profitPercent)}"
                    title="${escapeHtml(displayHoldingName(row))} ${row.metrics.profitPercent.toFixed(2)}%"
                  >
                    <span class="heatmap-symbol"><i>${escapeHtml(initial)}</i>${escapeHtml(row.symbol)}</span>
                    <strong>${escapeHtml(displayHoldingName(row))}</strong>
                    <em class="${row.metrics.profitPercent >= 0 ? "up" : "down"}">${row.metrics.profitPercent >= 0 ? "+" : ""}${row.metrics.profitPercent.toFixed(2)}%</em>
                    <small>비중 ${row.weight.toFixed(1)}% · ${formatMoney(row.metrics.value, row.metrics.currency)}</small>
                  </article>
                `;
              })
              .join("")}
          </div>
        </section>
      `,
    )
    .join("");
}

function renderDashboardHeatmapUnified(rows) {
  if (!el.dashboardHeatmap) return;
  if (!rows.length) {
    el.dashboardHeatmap.innerHTML = `<p class="empty-note">포트폴리오 종목을 추가하면 히트맵이 표시됩니다.</p>`;
    return;
  }
  const sortedRows = rows.slice().sort((a, b) => b.metrics.valueKrw - a.metrics.valueKrw);
  el.dashboardHeatmap.innerHTML = `
    <div class="heatmap-tiles">
      ${sortedRows
        .map((row) => {
          const weight = Math.max(row.weight, 2);
          const tileClass = weight >= 18 ? "large" : weight >= 8 ? "medium" : weight >= 4 ? "small" : "tiny";
          const tileSize = Math.max(tileClass === "tiny" ? 70 : 92, weight * 20);
          const height = Math.max(tileClass === "tiny" ? 64 : 76, Math.min(170, 64 + Math.sqrt(weight) * 22));
          const initial = (displayHoldingName(row) || row.symbol).slice(0, 1).toUpperCase();
          return `
            <article
              class="heatmap-tile ${tileClass}"
              style="--tile-size:${tileSize}; --tile-height:${height}px; --heat-color:${heatmapColor(row.metrics.profitPercent)}"
              title="${escapeHtml(displayHoldingName(row))} ${row.metrics.profitPercent.toFixed(2)}%"
            >
              <span class="heatmap-symbol"><i>${escapeHtml(initial)}</i>${escapeHtml(row.symbol)}</span>
              <strong>${escapeHtml(displayHoldingName(row))}</strong>
              <em class="${row.metrics.profitPercent >= 0 ? "up" : "down"}">${row.metrics.profitPercent >= 0 ? "+" : ""}${row.metrics.profitPercent.toFixed(2)}%</em>
              <small>평가비중 ${row.weight.toFixed(1)}% · ${formatMoney(row.metrics.value, row.metrics.currency)}</small>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function shortHeatmapName(row) {
  const name = displayHoldingName(row) || row.symbol;
  return name.length > 13 ? `${name.slice(0, 12)}…` : name;
}

function heatmapSize(weight) {
  if (weight >= 25) return { bucket: 10, cols: 6, rows: 6 };
  if (weight >= 18) return { bucket: 9, cols: 5, rows: 5 };
  if (weight >= 13) return { bucket: 8, cols: 5, rows: 4 };
  if (weight >= 9) return { bucket: 7, cols: 4, rows: 4 };
  if (weight >= 6) return { bucket: 6, cols: 4, rows: 3 };
  if (weight >= 4) return { bucket: 5, cols: 3, rows: 3 };
  if (weight >= 2.5) return { bucket: 4, cols: 3, rows: 2 };
  if (weight >= 1.5) return { bucket: 3, cols: 2, rows: 2 };
  if (weight >= 0.8) return { bucket: 2, cols: 2, rows: 1 };
  return { bucket: 1, cols: 1, rows: 1 };
}

function renderDashboardHeatmapTreemap(rows) {
  if (!el.dashboardHeatmap) return;
  if (!rows.length) {
    el.dashboardHeatmap.innerHTML = `<p class="empty-note">포트폴리오 종목을 추가하면 히트맵이 표시됩니다.</p>`;
    return;
  }
  const sortedRows = rows.slice().sort((a, b) => b.metrics.valueKrw - a.metrics.valueKrw);
  el.dashboardHeatmap.innerHTML = `
    <div class="heatmap-tiles treemap-tiles">
      ${sortedRows
        .map((row) => {
          const weight = Math.max(row.weight, 0);
          const size = heatmapSize(weight);
          const compact = size.bucket <= 2 ? "tiny" : size.bucket <= 4 ? "small" : size.bucket <= 6 ? "medium" : "large";
          const name = shortHeatmapName(row);
          return `
            <article
              class="heatmap-tile treemap-tile ${compact} size-${size.bucket}"
              style="--col-span:${size.cols}; --row-span:${size.rows}; --heat-color:${heatmapColor(row.metrics.profitPercent)}"
              title="${escapeHtml(displayHoldingName(row))} · 평가비중 ${row.weight.toFixed(2)}% · 수익률 ${row.metrics.profitPercent.toFixed(2)}%"
            >
              <strong>${escapeHtml(name)}</strong>
              <em class="${row.metrics.profitPercent >= 0 ? "up" : "down"}">${row.metrics.profitPercent >= 0 ? "+" : ""}${row.metrics.profitPercent.toFixed(2)}%</em>
              <small>${row.weight.toFixed(1)}% · ${formatMoney(row.metrics.value, row.metrics.currency)}</small>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderDashboardHeatmapGrouped(rows) {
  if (!el.dashboardHeatmap) return;
  if (!rows.length) {
    el.dashboardHeatmap.innerHTML = `<p class="empty-note">포트폴리오 종목을 추가하면 히트맵이 표시됩니다.</p>`;
    return;
  }
  const groups = ["US Stock", "KR Stock", "Crypto"]
    .map((type) => {
      const groupRows = rows.filter((row) => row.assetType === type).sort((a, b) => b.metrics.valueKrw - a.metrics.valueKrw);
      return {
        type,
        rows: groupRows,
        weight: groupRows.reduce((sum, row) => sum + row.weight, 0),
      };
    })
    .filter((group) => group.rows.length);
  el.dashboardHeatmap.innerHTML = `
    <div class="heatmap-board">
      ${groups
        .map(
          (group) => `
            <section class="heatmap-sector" style="--sector-weight:${Math.max(group.weight, 8)}">
              <header><strong>${assetLabel(group.type)}</strong><span>${group.weight.toFixed(1)}%</span></header>
              <div class="heatmap-tiles treemap-tiles">
                ${group.rows
                  .map((row) => {
                    const weight = Math.max(row.weight, 0);
                    const size = heatmapSize(weight);
                    const compact = size.bucket <= 2 ? "tiny" : size.bucket <= 4 ? "small" : size.bucket <= 6 ? "medium" : "large";
                    const fullName = displayHoldingName(row) || row.symbol;
                    const name = fullName.length > 13 ? `${fullName.slice(0, 12)}…` : fullName;
                    return `
                      <article
                        class="heatmap-tile treemap-tile ${compact} size-${size.bucket}"
                        style="--col-span:${size.cols}; --row-span:${size.rows}; --heat-color:${heatmapColor(row.metrics.profitPercent)}"
                        title="${escapeHtml(fullName)} · 평가비중 ${row.weight.toFixed(2)}% · 수익률 ${row.metrics.profitPercent.toFixed(2)}%"
                      >
                        <strong>${escapeHtml(name)}</strong>
                        <em class="${row.metrics.profitPercent >= 0 ? "up" : "down"}">${row.metrics.profitPercent >= 0 ? "+" : ""}${row.metrics.profitPercent.toFixed(2)}%</em>
                        <small>${row.weight.toFixed(1)}% · ${formatMoney(row.metrics.value, row.metrics.currency)}</small>
                      </article>
                    `;
                  })
                  .join("")}
              </div>
            </section>
          `,
        )
        .join("")}
    </div>
  `;
}

function treemapSplit(items, rect) {
  if (!items.length) return [];
  if (items.length === 1) return [{ ...items[0], rect }];
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  let running = 0;
  let splitIndex = 1;
  for (let index = 0; index < items.length - 1; index += 1) {
    const next = running + items[index].value;
    if (Math.abs(total / 2 - next) <= Math.abs(total / 2 - running)) {
      running = next;
      splitIndex = index + 1;
    } else {
      break;
    }
  }
  const first = items.slice(0, splitIndex);
  const second = items.slice(splitIndex);
  const firstTotal = first.reduce((sum, item) => sum + item.value, 0);
  const ratio = firstTotal / total;
  if (rect.w >= rect.h) {
    const firstRect = { x: rect.x, y: rect.y, w: rect.w * ratio, h: rect.h };
    const secondRect = { x: rect.x + firstRect.w, y: rect.y, w: rect.w - firstRect.w, h: rect.h };
    return treemapSplit(first, firstRect).concat(treemapSplit(second, secondRect));
  }
  const firstRect = { x: rect.x, y: rect.y, w: rect.w, h: rect.h * ratio };
  const secondRect = { x: rect.x, y: rect.y + firstRect.h, w: rect.w, h: rect.h - firstRect.h };
  return treemapSplit(first, firstRect).concat(treemapSplit(second, secondRect));
}

function heatmapAreaClass(rect) {
  const area = rect.w * rect.h;
  if (area >= 900) return "large";
  if (area >= 420) return "medium";
  if (area >= 170) return "small";
  return "tiny";
}

function rectStyle(rect, inset = 0.18) {
  const x = rect.x + inset;
  const y = rect.y + inset;
  const w = Math.max(0, rect.w - inset * 2);
  const h = Math.max(0, rect.h - inset * 2);
  return `left:${x.toFixed(3)}%; top:${y.toFixed(3)}%; width:${w.toFixed(3)}%; height:${h.toFixed(3)}%;`;
}

function renderDashboardHeatmapPacked(rows) {
  if (!el.dashboardHeatmap) return;
  if (!rows.length) {
    el.dashboardHeatmap.innerHTML = `<p class="empty-note">포트폴리오 종목을 추가하면 히트맵이 표시됩니다.</p>`;
    return;
  }
  const groupItems = ["US Stock", "KR Stock", "Crypto"]
    .map((type) => {
      const groupRows = rows.filter((row) => row.assetType === type).sort((a, b) => b.metrics.valueKrw - a.metrics.valueKrw);
      return {
        type,
        value: groupRows.reduce((sum, row) => sum + Math.max(row.metrics.valueKrw, 0), 0),
        rows: groupRows,
      };
    })
    .filter((group) => group.rows.length && group.value > 0)
    .sort((a, b) => b.value - a.value);
  const groupLayout = treemapSplit(groupItems, { x: 0, y: 0, w: 100, h: 100 });
  el.dashboardHeatmap.innerHTML = `
    <div class="heatmap-board packed-heatmap">
      ${groupLayout
        .map((group) => {
          const header = Math.min(4.8, Math.max(3.2, group.rect.h * 0.16));
          const childRect = { x: 0, y: header, w: 100, h: Math.max(1, 100 - header) };
          const childItems = group.rows.map((row) => ({ row, value: Math.max(row.metrics.valueKrw, 0.0001) }));
          const childLayout = treemapSplit(childItems, childRect);
          const groupWeight = group.rows.reduce((sum, row) => sum + row.weight, 0);
          return `
            <section class="packed-sector" style="${rectStyle(group.rect, 0.12)}">
              <header>${assetLabel(group.type)} <span>${groupWeight.toFixed(1)}%</span></header>
              ${childLayout
                .map((item) => {
                  const row = item.row;
                  const fullName = displayHoldingName(row) || row.symbol;
                  const compact = heatmapAreaClass(item.rect);
                  const name = fullName.length > 13 ? `${fullName.slice(0, 12)}…` : fullName;
                  return `
                    <article
                      class="packed-tile ${compact}"
                      style="${rectStyle(item.rect, 0.24)} --heat-color:${heatmapColor(row.metrics.profitPercent)}"
                      title="${escapeHtml(fullName)} · 평가비중 ${row.weight.toFixed(2)}% · 수익률 ${row.metrics.profitPercent.toFixed(2)}%"
                    >
                      <strong>${escapeHtml(name)}</strong>
                      <em>${row.metrics.profitPercent >= 0 ? "+" : ""}${row.metrics.profitPercent.toFixed(2)}%</em>
                      <small>${row.weight.toFixed(1)}%</small>
                    </article>
                  `;
                })
                .join("")}
            </section>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderAssetClassMap(rows) {
  const groups = ["US Stock", "KR Stock", "Crypto"]
    .map((type) => {
      const groupRows = rows.filter((row) => row.assetType === type);
      const value = groupRows.reduce((sum, row) => sum + row.metrics.valueKrw, 0);
      const profit = groupRows.reduce((sum, row) => sum + row.metrics.profitKrw, 0);
      const cost = groupRows.reduce((sum, row) => sum + row.metrics.costKrw, 0);
      return { type, value, profit, returnPercent: cost ? (profit / cost) * 100 : 0, rows: groupRows };
    })
    .filter((group) => group.rows.length && group.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = groups.reduce((sum, group) => sum + group.value, 0) || 1;
  return `
    <section class="heatmap-split-block">
      <header><strong>자산군 요약</strong><span>전체 평가금액 기준</span></header>
      <div class="asset-class-map">
        ${groups
          .map((group) => {
            const weight = (group.value / total) * 100;
            return `
              <article style="--asset-weight:${Math.max(weight, 8)}; --heat-color:${heatmapColor(group.returnPercent)}">
                <strong>${assetLabel(group.type)}</strong>
                <em>${weight.toFixed(1)}%</em>
                <span>${group.returnPercent >= 0 ? "+" : ""}${group.returnPercent.toFixed(2)}%</span>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderStockTreemap(rows) {
  const stockRows = rows.filter((row) => row.assetType !== "Crypto" && row.metrics.valueKrw > 0);
  if (!stockRows.length) return "";
  const items = stockRows
    .slice()
    .sort((a, b) => b.metrics.valueKrw - a.metrics.valueKrw)
    .map((row) => ({ row, value: row.metrics.valueKrw }));
  const layout = treemapSplit(items, { x: 0, y: 0, w: 100, h: 100 });
  const total = stockRows.reduce((sum, row) => sum + row.metrics.valueKrw, 0) || 1;
  return `
    <section class="heatmap-split-block">
      <header><strong>주식 종목 히트맵</strong><span>미국주식 + 한국주식 내부 비중</span></header>
      <div class="heatmap-board packed-heatmap stock-heatmap">
        ${layout
          .map((item) => {
            const row = item.row;
            const fullName = displayHoldingName(row) || row.symbol;
            const compact = heatmapAreaClass(item.rect);
            const name = fullName.length > 13 ? `${fullName.slice(0, 12)}…` : fullName;
            const stockWeight = (row.metrics.valueKrw / total) * 100;
            return `
              <article
                class="packed-tile ${compact}"
                style="${rectStyle(item.rect, 0.18)} --heat-color:${heatmapColor(row.metrics.profitPercent)}"
                title="${escapeHtml(fullName)} · 주식 내 비중 ${stockWeight.toFixed(2)}% · 전체 비중 ${row.weight.toFixed(2)}% · 수익률 ${row.metrics.profitPercent.toFixed(2)}%"
              >
                <strong>${escapeHtml(name)}</strong>
                <em>${row.metrics.profitPercent >= 0 ? "+" : ""}${row.metrics.profitPercent.toFixed(2)}%</em>
                <small>${stockWeight.toFixed(1)}%</small>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderCryptoCards(rows) {
  const cryptoRows = rows.filter((row) => row.assetType === "Crypto").sort((a, b) => b.metrics.valueKrw - a.metrics.valueKrw);
  if (!cryptoRows.length) return "";
  return `
    <section class="heatmap-split-block">
      <header><strong>암호화폐 포지션</strong><span>업비트 원화 시세 기준</span></header>
      <div class="crypto-position-grid">
        ${cryptoRows
          .map((row) => {
            const fullName = displayHoldingName(row) || row.symbol;
            return `
              <article style="--heat-color:${heatmapColor(row.metrics.profitPercent)}">
                <span>${escapeHtml(fullName)}</span>
                <strong>${formatMoney(row.metrics.value, row.metrics.currency)}</strong>
                <em>${row.metrics.profitPercent >= 0 ? "+" : ""}${row.metrics.profitPercent.toFixed(2)}%</em>
                <small>전체 비중 ${row.weight.toFixed(1)}% · 손익 ${formatMoney(row.metrics.profit, row.metrics.currency)}</small>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderDashboardHeatmapSplit(rows) {
  if (!el.dashboardHeatmap) return;
  if (!rows.length) {
    el.dashboardHeatmap.innerHTML = `<p class="empty-note">포트폴리오 종목을 추가하면 히트맵이 표시됩니다.</p>`;
    return;
  }
  el.dashboardHeatmap.innerHTML = `
    <div class="heatmap-split">
      ${renderAssetClassMap(rows)}
      ${renderStockTreemap(rows)}
      ${renderCryptoCards(rows)}
    </div>
  `;
}

function renderDashboardMiniChartsByAsset(rows) {
  if (!el.dashboardMiniCharts) return;
  if (!rows.length) {
    el.dashboardMiniCharts.innerHTML = `<p class="empty-note">포트폴리오 종목을 추가하면 자산군별 미니차트가 표시됩니다.</p>`;
    return;
  }
  const renderRow = (row, index) => {
    const points = (row.quote.points || []).slice(-36);
    const values = points.map((point) => point.price).filter(Number.isFinite);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const path = values
      .map((value, pointIndex) => {
        const x = values.length <= 1 ? 0 : (pointIndex / (values.length - 1)) * 100;
        const y = 30 - ((value - min) / range) * 28;
        return `${pointIndex ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return `
      <article class="mini-chart-row">
        <div class="mini-chart-rank">${index + 1}</div>
        <div class="mini-chart-name">
          <strong>${escapeHtml(displayHoldingName(row))}</strong>
          <span>${escapeHtml(row.symbol)} · 비중 ${row.weight.toFixed(1)}%</span>
        </div>
        <svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
          <path d="${path}" class="${row.quote.changePercent >= 0 ? "mini-up" : "mini-down"}"></path>
        </svg>
        <div class="mini-chart-period">${rangeLabel("1d")}</div>
        <div class="mini-chart-return">
          <strong class="${row.metrics.profitKrw >= 0 ? "up-text" : "down-text"}">${row.metrics.profitPercent.toFixed(1)}%</strong>
          <span>${formatMoney(row.metrics.value, row.metrics.currency)}</span>
        </div>
      </article>
    `;
  };
  const groups = ["US Stock", "KR Stock", "Crypto"]
    .map((type) => ({
      type,
      rows: rows.filter((row) => row.assetType === type).sort((a, b) => b.weight - a.weight),
    }))
    .filter((group) => group.rows.length);
  el.dashboardMiniCharts.innerHTML = groups
    .map(
      (group) => `
        <section class="mini-chart-group">
          <header><strong>${assetLabel(group.type)}</strong><span>${group.rows.length}종목</span></header>
          ${group.rows.map((row, index) => renderRow(row, index)).join("")}
        </section>
      `,
    )
    .join("");
}

function renderDashboardBriefByAsset(summary) {
  if (!el.dashboardBrief) return;
  const largest = summary.rows.slice().sort((a, b) => b.weight - a.weight)[0];
  const cashTone = summary.totalProfitKrw >= 0 ? "수익 구간" : "손실 구간";
  const concentration =
    largest && largest.weight >= 35
      ? `${displayHoldingName(largest)} 비중이 ${largest.weight.toFixed(1)}%로 큽니다.`
      : "단일 종목 집중도는 과하지 않습니다.";
  const assetSummaries = ["US Stock", "KR Stock", "Crypto"]
    .map((type) => {
      const groupRows = summary.rows.filter((row) => row.assetType === type);
      return { type, groupRows, ...summarizeRows(groupRows) };
    })
    .filter((group) => group.groupRows.length);
  el.dashboardBrief.innerHTML = `
    <article><strong>${cashTone}</strong><span>전체 수익률 ${summary.totalReturn.toFixed(2)}%, 평가손익 ${formatMoney(summary.totalProfitKrw, "KRW")}</span></article>
    ${assetSummaries
      .map(
        (group) => `
          <article class="brief-asset">
            <strong>${assetLabel(group.type)}</strong>
            <span class="${group.profit >= 0 ? "up-text" : "down-text"}">${group.returnPercent.toFixed(2)}%, ${formatMoney(group.profit, "KRW")}</span>
          </article>
        `,
      )
      .join("")}
    <article><strong>집중도</strong><span>${concentration}</span></article>
    <article><strong>환율</strong><span>USD/KRW ${formatNumber(fxRate.usdKrw, 2)} 기준으로 원화 평가금액을 계산했습니다.</span></article>
  `;
}

function recordPortfolioSnapshot(summary) {
  if (!summary) return;
  const date = todayKey();
  const snapshot = {
    date,
    totalValueKrw: Number(summary.totalValueKrw || 0),
    totalCostKrw: Number(summary.totalCostKrw || 0),
    totalProfitKrw: Number(summary.totalProfitKrw || 0),
    totalReturn: Number(summary.totalReturn || 0),
    positionCount: Number(summary.rows?.length || 0),
  };
  assetSnapshots = assetSnapshots.filter((item) => item.date !== date).concat(snapshot).slice(-240);
  saveSnapshots();
}

function groupTransactions(period = "month") {
  const groups = new Map();
  transactions.forEach((tx) => {
    const key = period === "year" ? yearKey(tx.date) : monthKey(tx.date);
    const current =
      groups.get(key) || {
        key,
        buyKrw: 0,
        sellKrw: 0,
        realizedProfitKrw: 0,
        count: 0,
      };
    if (tx.type === "buy") current.buyKrw += Number(tx.grossKrw || 0);
    if (tx.type === "sell") current.sellKrw += Number(tx.grossKrw || 0);
    current.realizedProfitKrw += Number(tx.realizedProfitKrw || 0);
    current.count += 1;
    groups.set(key, current);
  });
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function latestSnapshotsByMonth() {
  const groups = new Map();
  assetSnapshots.forEach((snapshot) => {
    const key = monthKey(snapshot.date);
    const current = groups.get(key);
    if (!current || snapshot.date >= current.date) groups.set(key, snapshot);
  });
  return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function latestSnapshotsByYear() {
  const groups = new Map();
  assetSnapshots.forEach((snapshot) => {
    const key = yearKey(snapshot.date);
    const current = groups.get(key);
    if (!current || snapshot.date >= current.date) groups.set(key, snapshot);
  });
  return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function renderFlowDashboard() {
  if (!el.flowTotalAssets) return;
  const latest = assetSnapshots.at(-1);
  const realizedTotal = transactions.reduce((sum, tx) => sum + Number(tx.realizedProfitKrw || 0), 0);
  const sellTotal = transactions.filter((tx) => tx.type === "sell").reduce((sum, tx) => sum + Number(tx.grossKrw || 0), 0);
  setText(el.flowTotalAssets, formatMoney(latest?.totalValueKrw || 0, "KRW"));
  setText(el.flowRealizedPnl, formatMoney(realizedTotal, "KRW"));
  setText(el.flowSellAmount, formatMoney(sellTotal, "KRW"));
  setText(el.flowTradeCount, `${transactions.length}건`);
  el.flowRealizedPnl.className = realizedTotal >= 0 ? "up-text" : "down-text";
  drawAssetFlowChart();
  drawRealizedPnlChart();
  renderFlowTables();
  renderTransactions();
}

function renderFlowTables() {
  const renderRows = (items, snapshots, emptyText) => {
    if (!items.length && !snapshots.length) {
      return `<tr><td colspan="6" class="muted">${emptyText}</td></tr>`;
    }
    const snapshotMap = new Map(snapshots.map((snapshot) => [snapshot.date.length === 10 ? monthKey(snapshot.date) : snapshot.date, snapshot]));
    const keys = [...new Set([...items.map((item) => item.key), ...snapshots.map((snapshot) => (snapshot.date.length === 10 ? monthKey(snapshot.date) : snapshot.date))])].sort();
    return keys
      .map((key) => {
        const flow = items.find((item) => item.key === key) || { buyKrw: 0, sellKrw: 0, realizedProfitKrw: 0, count: 0 };
        const snapshot = snapshotMap.get(key);
        return `
          <tr>
            <td>${escapeHtml(key)}</td>
            <td>${formatMoney(flow.buyKrw, "KRW")}</td>
            <td>${formatMoney(flow.sellKrw, "KRW")}</td>
            <td><span class="${flow.realizedProfitKrw >= 0 ? "up-text" : "down-text"}">${formatMoney(flow.realizedProfitKrw, "KRW")}</span></td>
            <td>${formatMoney(snapshot?.totalValueKrw || 0, "KRW")}</td>
            <td>${flow.count}건</td>
          </tr>
        `;
      })
      .join("");
  };
  if (el.monthlyFlowRows) {
    el.monthlyFlowRows.innerHTML = renderRows(groupTransactions("month"), latestSnapshotsByMonth(), "월별 거래 기록이 없습니다.");
  }
  if (el.yearlyFlowRows) {
    const yearlySnapshots = latestSnapshotsByYear().map((snapshot) => ({ ...snapshot, date: yearKey(snapshot.date) }));
    el.yearlyFlowRows.innerHTML = renderRows(groupTransactions("year"), yearlySnapshots, "연간 거래 기록이 없습니다.");
  }
}

function renderTransactions() {
  if (!el.transactionRows) return;
  if (!transactions.length) {
    el.transactionRows.innerHTML = `<tr><td colspan="8" class="muted">매수/매도 거래를 입력하면 실현손익 기록이 쌓입니다.</td></tr>`;
    return;
  }
  el.transactionRows.innerHTML = transactions
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map(
      (tx) => `
        <tr>
          <td>${escapeHtml(tx.date)}</td>
          <td><span class="trade-pill ${tx.type}">${tx.type === "buy" ? "매수" : "매도"}</span></td>
          <td><strong>${escapeHtml(tx.name || tx.symbol)}</strong><br><span class="muted">${escapeHtml(tx.symbol)}</span></td>
          <td>${formatNumber(Number(tx.qty || 0), 6)}</td>
          <td>${formatMoney(Number(tx.price || 0), tx.currency)}</td>
          <td>${formatMoney(Number(tx.gross || 0), tx.currency)}</td>
          <td><span class="${Number(tx.realizedProfitKrw || 0) >= 0 ? "up-text" : "down-text"}">${formatMoney(Number(tx.realizedProfitKrw || 0), "KRW")}</span></td>
          <td><button class="delete-transaction" data-id="${escapeHtml(tx.id)}" title="거래 기록 삭제">×</button></td>
        </tr>
      `,
    )
    .join("");
}

function applyTransaction({ date, type, symbol, name, qty, price, currency }) {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) throw new Error("심볼을 입력해 주세요.");
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("수량은 0보다 커야 합니다.");
  if (!Number.isFinite(price) || price <= 0) throw new Error("거래단가는 0보다 커야 합니다.");
  if (!["buy", "sell"].includes(type)) throw new Error("거래 구분을 확인해 주세요.");
  const assetType = classifySymbol(normalized);
  const gross = qty * price;
  const grossKrw = convertAmount(gross, currency, "KRW");
  const basis = getHoldingCostBasis(normalized, currency);
  let realizedProfit = 0;
  let realizedProfitKrw = 0;

  if (type === "buy") {
    const existing = basis.holding;
    if (existing) {
      const existingQty = Number(existing.qty || 0);
      const existingCurrency = existing.currency || currency;
      const existingCostKrw = convertAmount(existingQty * Number(existing.avgPrice || 0), existingCurrency, "KRW");
      const nextQty = existingQty + qty;
      const nextAvgKrw = nextQty ? (existingCostKrw + grossKrw) / nextQty : 0;
      existing.qty = nextQty;
      existing.avgPrice = convertAmount(nextAvgKrw, "KRW", existingCurrency);
      existing.name = existing.name || name;
    } else {
      holdings = holdings.concat({ symbol: normalized, name, qty, avgPrice: price, currency });
    }
  } else {
    if (!basis.holding || basis.qty < qty) {
      throw new Error("매도 수량이 현재 보유 수량보다 많습니다.");
    }
    const avgInTradeCurrency = convertAmount(basis.avgPrice, basis.currency, currency);
    realizedProfit = (price - avgInTradeCurrency) * qty;
    realizedProfitKrw = convertAmount(realizedProfit, currency, "KRW");
    basis.holding.qty = Math.max(0, basis.qty - qty);
    if (basis.holding.qty === 0) holdings.splice(basis.index, 1);
  }

  const tx = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date,
    type,
    symbol: normalized,
    name,
    qty,
    price,
    currency,
    assetType,
    gross,
    grossKrw,
    realizedProfit,
    realizedProfitKrw,
    fxRate: fxRate.usdKrw,
  };
  transactions = transactions.concat(tx);
  saveTransactions();
  saveHoldings();
  return tx;
}

function drawAssetFlowChart() {
  const canvas = el.assetFlowChart;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const points = latestSnapshotsByMonth().map((snapshot) => ({ label: monthKey(snapshot.date), value: snapshot.totalValueKrw }));
  drawLineSeries(ctx, width, height, points, "총 자산", "#75d37b");
}

function drawRealizedPnlChart() {
  const canvas = el.realizedPnlChart;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const points = groupTransactions("month").map((item) => ({ label: item.key, value: item.realizedProfitKrw }));
  drawBarSeries(ctx, width, height, points);
}

function drawLineSeries(ctx, width, height, points, title, color) {
  ctx.fillStyle = "#101713";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(242,247,239,0.9)";
  ctx.font = "700 16px sans-serif";
  ctx.fillText(title, 18, 28);
  if (!points.length) {
    ctx.fillStyle = "rgba(242,247,239,0.55)";
    ctx.fillText("스냅샷 데이터가 아직 없습니다.", 18, height / 2);
    return;
  }
  const values = points.map((point) => point.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const left = 54;
  const right = width - 22;
  const top = 48;
  const bottom = height - 42;
  ctx.strokeStyle = "rgba(242,247,239,0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const y = top + ((bottom - top) / 3) * i;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = points.length === 1 ? left : left + ((right - left) / (points.length - 1)) * index;
    const y = bottom - ((point.value - min) / range) * (bottom - top);
    if (index) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.stroke();
  points.forEach((point, index) => {
    const x = points.length === 1 ? left : left + ((right - left) / (points.length - 1)) * index;
    const y = bottom - ((point.value - min) / range) * (bottom - top);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(242,247,239,0.62)";
    ctx.font = "11px sans-serif";
    ctx.fillText(point.label.slice(2), x - 14, height - 16);
  });
}

function drawBarSeries(ctx, width, height, points) {
  ctx.fillStyle = "#101713";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(242,247,239,0.9)";
  ctx.font = "700 16px sans-serif";
  ctx.fillText("월별 실현손익", 18, 28);
  if (!points.length) {
    ctx.fillStyle = "rgba(242,247,239,0.55)";
    ctx.fillText("매도 거래를 입력하면 월별 손익이 표시됩니다.", 18, height / 2);
    return;
  }
  const maxAbs = Math.max(...points.map((point) => Math.abs(point.value)), 1);
  const left = 46;
  const right = width - 22;
  const top = 48;
  const bottom = height - 42;
  const zeroY = top + (bottom - top) / 2;
  const barWidth = Math.max(12, (right - left) / points.length - 10);
  ctx.strokeStyle = "rgba(242,247,239,0.24)";
  ctx.beginPath();
  ctx.moveTo(left, zeroY);
  ctx.lineTo(right, zeroY);
  ctx.stroke();
  points.forEach((point, index) => {
    const x = left + ((right - left) / points.length) * index + 5;
    const heightRatio = Math.abs(point.value) / maxAbs;
    const barHeight = heightRatio * ((bottom - top) / 2 - 10);
    const y = point.value >= 0 ? zeroY - barHeight : zeroY;
    ctx.fillStyle = point.value >= 0 ? "#75d37b" : "#ff6b6b";
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = "rgba(242,247,239,0.62)";
    ctx.font = "11px sans-serif";
    ctx.fillText(point.label.slice(2), x, height - 16);
  });
}

function drawAllocationChart(rows) {
  const canvas = el.dashboardAllocationChart;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const groups = [
    { label: "US", value: sumWeight(rows, (row) => row.assetType === "US Stock"), color: "#75d37b" },
    { label: "KR", value: sumWeight(rows, (row) => row.assetType === "KR Stock"), color: "#f5c35b" },
    { label: "Crypto", value: sumWeight(rows, (row) => row.assetType === "Crypto"), color: "#5bb8f5" },
  ].filter((group) => group.value > 0);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.32;
  if (!groups.length) {
    ctx.fillStyle = "#9ba89d";
    ctx.font = "14px system-ui";
    ctx.fillText("포트폴리오 종목을 추가하세요.", 28, 44);
    return;
  }
  let start = -Math.PI / 2;
  groups.forEach((group) => {
    const angle = (group.value / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = group.color;
    ctx.fill();
    start += angle;
  });
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
  ctx.fillStyle = "#181d1a";
  ctx.fill();
  ctx.fillStyle = "#eef4ee";
  ctx.font = "bold 18px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("자산배분", cx, cy + 6);
  ctx.textAlign = "left";
  groups.forEach((group, index) => {
    const y = 28 + index * 24;
    ctx.fillStyle = group.color;
    ctx.fillRect(24, y - 10, 12, 12);
    ctx.fillStyle = "#eef4ee";
    ctx.font = "13px system-ui";
    ctx.fillText(`${group.label} ${group.value.toFixed(1)}%`, 44, y);
  });
}

function drawPerformanceChart(rows) {
  const canvas = el.dashboardPerformanceChart;
  if (!canvas) return;
  canvas.height = Math.max(360, rows.length * 44 + 72);
  canvas.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  if (!rows.length) {
    ctx.fillStyle = "#9ba89d";
    ctx.font = "14px system-ui";
    ctx.fillText("손익 데이터가 없습니다.", 28, 44);
    return;
  }
  const chartRows = rows.slice().sort((a, b) => b.metrics.profitPercent - a.metrics.profitPercent);
  const max = Math.max(10, ...chartRows.map((row) => Math.abs(row.metrics.profitPercent)));
  const hasPositive = chartRows.some((row) => row.metrics.profitPercent > 0);
  const hasNegative = chartRows.some((row) => row.metrics.profitPercent < 0);
  const mid = hasPositive && hasNegative ? width / 2 : hasNegative ? width - 132 : 132;
  const padY = 34;
  const barH = Math.max(18, (height - padY * 2) / chartRows.length - 10);
  ctx.strokeStyle = "rgba(238, 244, 238, 0.14)";
  ctx.beginPath();
  ctx.moveTo(mid, 18);
  ctx.lineTo(mid, height - 18);
  ctx.stroke();
  chartRows.forEach((row, index) => {
    const y = padY + index * (barH + 10);
    const pct = row.metrics.profitPercent;
    const availableWidth = pct >= 0 ? width - mid - 132 : mid - 132;
    const barW = (Math.abs(pct) / max) * Math.max(availableWidth, width * 0.28);
    ctx.fillStyle = pct >= 0 ? "#75d37b" : "#ff6b6b";
    ctx.fillRect(pct >= 0 ? mid : mid - barW, y, barW, barH);
    ctx.fillStyle = "#eef4ee";
    ctx.font = "bold 12px system-ui";
    ctx.textAlign = pct >= 0 ? "left" : "right";
    ctx.fillText(`${displayHoldingName(row)} ${pct.toFixed(1)}%`, pct >= 0 ? mid + barW + 8 : mid - barW - 8, y + barH / 2 + 4);
  });
  ctx.textAlign = "left";
}

function getPegOpinion(peg, growthPercent) {
  if (!Number.isFinite(growthPercent) || growthPercent <= 0) return { label: "성장률 확인 필요", tone: "neutral" };
  if (!Number.isFinite(peg)) return { label: "PEG 계산 불가", tone: "neutral" };
  if (peg <= 1) return { label: "성장 대비 매력", tone: "good" };
  if (peg <= 2) return { label: "관찰 가능", tone: "watch" };
  return { label: "가격 부담 큼", tone: "bad" };
}

function classifyLynchCategory({ holding, quote, financials, growthPercent }) {
  const symbol = normalizeSymbol(holding.symbol);
  const name = `${holding.name || quote.name || ""}`.toLowerCase();
  const pbr = financials.pbr;

  if (symbol.endsWith("-USD") || name.includes("bitcoin") || name.includes("xrp")) return "asset";
  if (isEtfHolding({ symbol, name })) return "slow";
  if (name.includes("semiconductor") || name.includes("하이닉스") || name.includes("samsung electronics")) return "cyclical";
  if (Number.isFinite(growthPercent) && growthPercent < 0) return "turnaround";
  if (Number.isFinite(pbr) && pbr > 0 && pbr < 0.8) return "asset";
  if (Number.isFinite(growthPercent) && growthPercent >= 20) return "fast";
  if (Number.isFinite(growthPercent) && growthPercent >= 8) return "stalwart";
  if (Number.isFinite(growthPercent) && growthPercent >= 0) return "slow";
  return "turnaround";
}

function renderLynchCategories(rows = []) {
  if (!el.lynchCategoryGrid) return;
  el.lynchCategoryGrid.innerHTML = Object.entries(LYNCH_CATEGORIES)
    .map(([key, category]) => {
      const matches = rows.filter((row) => row.category === key);
      return `
        <article class="lynch-category-card">
          <header>
            <strong>${category.title}</strong>
            <span>${category.subtitle}</span>
          </header>
          <p>${category.summary}</p>
          <div class="category-holdings">
            ${
              matches.length
                ? matches.map((row) => `<span>${escapeHtml(displayHoldingName(row))}</span>`).join("")
                : `<em>해당 종목 없음</em>`
            }
          </div>
          <footer>${category.peg}</footer>
        </article>
      `;
    })
    .join("");
}

function isLynchViewActive() {
  return document.querySelector("#lynchView")?.classList.contains("active");
}

function isBuffettViewActive() {
  return document.querySelector("#buffettView")?.classList.contains("active");
}

function setSearchVisibility(viewName) {
  const form = document.querySelector("#symbolForm");
  if (!form) return;
  form.hidden = viewName !== "research";
}

function suggestedHoldingCurrency(symbol) {
  const normalized = normalizeSymbol(symbol || "");
  if (normalized.endsWith(".KS") || normalized.endsWith(".KQ") || normalized.endsWith("-USD")) return "KRW";
  return "USD";
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function formatRatio(value) {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function rangeLabel(range) {
  return {
    "1d": "1일",
    "5d": "1주",
    "1mo": "1개월",
    "6mo": "6개월",
    "1y": "1년",
  }[range] || range.toUpperCase();
}

function getNetCash(financials) {
  if (!Number.isFinite(financials.totalCash) || !Number.isFinite(financials.totalDebt)) return null;
  return financials.totalCash - financials.totalDebt;
}

function getDebtEquityPercent(financials) {
  return Number.isFinite(financials.debtToEquity) ? financials.debtToEquity : null;
}

function getLynchHealth(financials) {
  const de = getDebtEquityPercent(financials);
  const netCash = getNetCash(financials);
  if (Number.isFinite(netCash) && netCash > 0 && (!Number.isFinite(de) || de < 25)) return { label: "★★★ 무부채급", tone: "good" };
  if (Number.isFinite(netCash) && netCash > 0) return { label: "★★★ 순현금", tone: "good" };
  if (Number.isFinite(de) && de < 50) return { label: "★★☆ 안전", tone: "watch" };
  if (Number.isFinite(de) && de < 100) return { label: "★★☆ 양호", tone: "watch" };
  if (Number.isFinite(de)) return { label: "★☆☆ 부채 주의", tone: "bad" };
  return { label: "데이터 부족", tone: "neutral" };
}

function scoreBuffett(row) {
  let score = 0;
  if (Number.isFinite(row.returnOnEquity) && row.returnOnEquity >= 0.15) score += 25;
  if (Number.isFinite(row.profitMargins) && row.profitMargins >= 0.15) score += 20;
  if (Number.isFinite(row.debtToEquity) && row.debtToEquity <= 50) score += 20;
  if (Number.isFinite(row.growthPercent) && row.growthPercent >= 5) score += 15;
  if (Number.isFinite(row.peg) && row.peg <= 2) score += 10;
  if (Number.isFinite(row.freeCashflow) && row.freeCashflow > 0) score += 10;
  return score;
}

function getBuffettMoat(row) {
  if ((row.returnOnEquity ?? 0) >= 0.2 && (row.profitMargins ?? 0) >= 0.18) return "강한 해자 후보";
  if ((row.returnOnEquity ?? 0) >= 0.15 || (row.profitMargins ?? 0) >= 0.15) return "해자 관찰";
  return "해자 약함/확인 필요";
}

function getBuffettPriceDiscipline(row) {
  if (!Number.isFinite(row.peg)) return "가격 판단 데이터 부족";
  if (row.peg <= 1.5) return "가격 규율 양호";
  if (row.peg <= 2.5) return "가격 부담 관찰";
  return "고평가 주의";
}

function getBuffettSellCheck(row) {
  const checks = [];
  if ((row.returnOnEquity ?? 1) < 0.1 || (row.profitMargins ?? 1) < 0.08) checks.push("사업의 질 훼손");
  if (Number.isFinite(row.peg) && row.peg > 3) checks.push("과도한 고평가");
  if (row.weight > 35 && row.score < 70) checks.push("더 나은 기회 검토");
  return checks.length ? checks.join(", ") : "보유 논리 점검 유지";
}

async function buildLynchRows() {
  await fetchFxRate();
  const uniqueHoldings = holdings.filter(
    (holding, index, list) => list.findIndex((item) => normalizeSymbol(item.symbol) === normalizeSymbol(holding.symbol)) === index,
  );
  const quotes = await Promise.all(uniqueHoldings.map((holding) => getQuote(holding.symbol, "1d", "5m")));
  const financials = await Promise.all(uniqueHoldings.map((holding) => getFinancials(holding.symbol)));
  const totalValue = uniqueHoldings.reduce((sum, holding, index) => {
    const quote = quotes[index];
    return sum + getPortfolioRowMetrics(holding, quote).valueKrw;
  }, 0);

  return uniqueHoldings.map((holding, index) => {
    const quote = quotes[index];
    const data = financials[index];
    const growthPercent = getGrowthPercent(data);
    const peg = data.per && growthPercent && growthPercent > 0 ? data.per / growthPercent : null;
    const value = getPortfolioRowMetrics(holding, quote).valueKrw;
    const category = classifyLynchCategory({ holding, quote, financials: data, growthPercent, peg });
    const debtToEquity = getDebtEquityPercent(data);
    const netCash = getNetCash(data);
    return {
      symbol: holding.symbol,
      name: holding.name || quote.name,
      weight: totalValue ? (value / totalValue) * 100 : 0,
      per: data.per,
      growthPercent,
      peg,
      pbr: data.pbr,
      totalCash: data.totalCash,
      totalDebt: data.totalDebt,
      debtToEquity,
      netCash,
      returnOnEquity: data.returnOnEquity,
      profitMargins: data.profitMargins,
      freeCashflow: data.freeCashflow,
      category,
      opinion: getPegOpinion(peg, growthPercent),
    };
  });
}

async function renderLynchAnalysis() {
  if (!el.lynchRows) return;
  if (!holdings.length) {
    el.lynchCount.textContent = "0개";
    el.lynchAvgPeg.textContent = "-";
    el.lynchGoodPeg.textContent = "0개";
    el.lynchGrowthCoverage.textContent = "0%";
    el.lynchUpdated.textContent = "포트폴리오를 먼저 추가하세요";
    el.lynchCards.innerHTML = "";
    renderLynchCategories([]);
    renderLynchHealth([]);
    el.lynchRows.innerHTML = `<tr><td colspan="7">포트폴리오에 종목을 추가하면 피터린치 분석이 표시됩니다.</td></tr>`;
    drawPegChart([]);
    return;
  }

  el.lynchUpdated.textContent = "분석 중";
  const rows = await buildLynchRows();
  const validPegs = rows.map((row) => row.peg).filter(Number.isFinite);
  const growthCount = rows.filter((row) => Number.isFinite(row.growthPercent)).length;
  const avgPeg = validPegs.length ? validPegs.reduce((sum, value) => sum + value, 0) / validPegs.length : null;

  el.lynchCount.textContent = `${rows.length}개`;
  el.lynchAvgPeg.textContent = Number.isFinite(avgPeg) ? avgPeg.toFixed(2) : "-";
  el.lynchGoodPeg.textContent = `${rows.filter((row) => Number.isFinite(row.peg) && row.peg <= 1).length}개`;
  el.lynchGrowthCoverage.textContent = `${Math.round((growthCount / rows.length) * 100)}%`;
  el.lynchUpdated.textContent = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  el.lynchCards.innerHTML = rows
    .slice()
    .sort((a, b) => (a.peg ?? 999) - (b.peg ?? 999))
    .map(
      (row) => `
        <article class="lynch-card ${row.opinion.tone}">
          <span>${escapeHtml(displayHoldingName(row))}</span>
          <strong>${Number.isFinite(row.peg) ? row.peg.toFixed(2) : "-"}</strong>
          <p>${escapeHtml(LYNCH_CATEGORIES[row.category].title)} · ${escapeHtml(row.opinion.label)}</p>
        </article>
      `,
    )
    .join("");

  el.lynchRows.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td><strong>${escapeHtml(displayHoldingName(row))}</strong><br><span class="muted">${escapeHtml(row.symbol)}</span></td>
          <td>${formatPercent(row.weight)}</td>
          <td>${formatNumber(row.per)}</td>
          <td>${formatPercent(row.growthPercent)}</td>
          <td>${Number.isFinite(row.peg) ? row.peg.toFixed(2) : "-"}</td>
          <td>${escapeHtml(LYNCH_CATEGORIES[row.category].title)}</td>
          <td><span class="lynch-pill ${row.opinion.tone}">${escapeHtml(row.opinion.label)}</span></td>
        </tr>
      `,
    )
    .join("");

  renderLynchCategories(rows);
  renderLynchHealth(rows);
  drawPegChart(rows);
}

function renderLynchHealth(rows) {
  if (!el.lynchHealthRows) return;
  if (!rows.length) {
    el.lynchHealthRows.innerHTML = `<tr><td colspan="6">포트폴리오에 종목을 추가하면 재무건전성 분석이 표시됩니다.</td></tr>`;
    return;
  }
  el.lynchHealthRows.innerHTML = rows
    .map((row) => {
      const health = getLynchHealth(row);
      const netCashText = Number.isFinite(row.netCash)
        ? row.netCash >= 0
          ? `순현금 ${formatCompact(row.netCash, "USD")}`
          : `순부채 ${formatCompact(Math.abs(row.netCash), "USD")}`
        : "데이터 부족";
      return `
        <tr>
          <td><strong>${escapeHtml(displayHoldingName(row))}</strong><br><span class="muted">${escapeHtml(row.symbol)}</span></td>
          <td>${formatRatio(row.debtToEquity)}</td>
          <td>${formatCompact(row.totalCash, "USD")}</td>
          <td>${formatCompact(row.totalDebt, "USD")}</td>
          <td><span class="lynch-pill ${Number.isFinite(row.netCash) && row.netCash >= 0 ? "good" : "bad"}">${netCashText}</span></td>
          <td><span class="lynch-pill ${health.tone}">${health.label}</span></td>
        </tr>
      `;
    })
    .join("");
}

function drawPegChart(rows) {
  const canvas = el.pegChart;
  if (!canvas) return;
  rows = rows.filter((row) => !isEtfHolding(row) && Number.isFinite(row.peg));
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  if (!rows.length) {
    ctx.fillStyle = "#9ba89d";
    ctx.font = "14px system-ui";
    ctx.fillText("분석할 포트폴리오 종목이 없습니다.", 28, 44);
    return;
  }

  const pad = 54;
  const chartRows = rows;
  const maxPeg = Math.max(2.5, ...chartRows.map((row) => (Number.isFinite(row.peg) ? Math.min(row.peg, 5) : 0)));
  const barGap = 14;
  const barHeight = Math.max(18, (height - pad * 2 - barGap * (chartRows.length - 1)) / chartRows.length);

  ctx.strokeStyle = "rgba(238, 244, 238, 0.1)";
  ctx.lineWidth = 1;
  [1, 2].forEach((value) => {
    const x = pad + (value / maxPeg) * (width - pad * 2);
    ctx.beginPath();
    ctx.moveTo(x, pad - 18);
    ctx.lineTo(x, height - pad + 18);
    ctx.stroke();
    ctx.fillStyle = "#9ba89d";
    ctx.font = "12px system-ui";
    ctx.fillText(`PEG ${value}`, x + 6, pad - 24);
  });

  chartRows.forEach((row, index) => {
    const y = pad + index * (barHeight + barGap);
    const peg = Number.isFinite(row.peg) ? Math.min(row.peg, 5) : 0;
    const barWidth = (peg / maxPeg) * (width - pad * 2);
    const color = row.opinion.tone === "good" ? "#75d37b" : row.opinion.tone === "watch" ? "#f5c35b" : "#ff6b6b";
    ctx.fillStyle = "rgba(238, 244, 238, 0.08)";
    ctx.fillRect(pad, y, width - pad * 2, barHeight);
    ctx.fillStyle = color;
    ctx.fillRect(pad, y, Math.max(barWidth, 3), barHeight);
    ctx.fillStyle = "#eef4ee";
    ctx.font = "bold 12px system-ui";
    ctx.fillText(displayHoldingName(row), 10, y + barHeight / 2 + 4);
    ctx.textAlign = "right";
    ctx.fillText(Number.isFinite(row.peg) ? row.peg.toFixed(2) : "-", width - 10, y + barHeight / 2 + 4);
    ctx.textAlign = "left";
  });
}

async function renderBuffettAnalysis() {
  if (!el.buffettRows) return;
  if (!holdings.length) {
    el.buffettCount.textContent = "0개";
    el.buffettAvgScore.textContent = "-";
    el.buffettQualityCount.textContent = "0개";
    el.buffettSellCount.textContent = "0개";
    el.buffettUpdated.textContent = "포트폴리오를 먼저 추가하세요";
    el.buffettRows.innerHTML = `<tr><td colspan="8">포트폴리오에 종목을 추가하면 워렌버핏 분석이 표시됩니다.</td></tr>`;
    drawBuffettChart([]);
    return;
  }

  el.buffettUpdated.textContent = "분석 중";
  const rows = (await buildLynchRows())
    .filter(isBuffettEligible)
    .map((row) => {
      const scored = { ...row };
      scored.score = scoreBuffett(scored);
      scored.moat = getBuffettMoat(scored);
      scored.priceDiscipline = getBuffettPriceDiscipline(scored);
      scored.sellCheck = getBuffettSellCheck(scored);
      return scored;
    });
  if (!rows.length) {
    el.buffettCount.textContent = "0개";
    el.buffettAvgScore.textContent = "-";
    el.buffettQualityCount.textContent = "0개";
    el.buffettSellCount.textContent = "0개";
    el.buffettUpdated.textContent = "개별 주식 종목을 추가하세요";
    el.buffettRows.innerHTML = `<tr><td colspan="8">워렌버핏 분석은 ETF와 암호화폐를 제외한 개별 주식만 표시합니다.</td></tr>`;
    drawBuffettChart([]);
    return;
  }
  const avgScore = rows.reduce((sum, row) => sum + row.score, 0) / rows.length;

  el.buffettCount.textContent = `${rows.length}개`;
  el.buffettAvgScore.textContent = `${avgScore.toFixed(0)}점`;
  el.buffettQualityCount.textContent = `${rows.filter((row) => row.score >= 70).length}개`;
  el.buffettSellCount.textContent = `${rows.filter((row) => row.sellCheck !== "보유 논리 점검 유지").length}개`;
  el.buffettUpdated.textContent = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  el.buffettRows.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td><strong>${escapeHtml(displayHoldingName(row))}</strong><br><span class="muted">${escapeHtml(row.symbol)}</span></td>
          <td><span class="lynch-pill ${row.score >= 70 ? "good" : row.score >= 45 ? "watch" : "bad"}">${row.score}점</span></td>
          <td>${formatPercent((row.returnOnEquity ?? NaN) * 100)}</td>
          <td>${formatPercent((row.profitMargins ?? NaN) * 100)}</td>
          <td>${formatRatio(row.debtToEquity)}</td>
          <td>${escapeHtml(row.moat)}</td>
          <td>${escapeHtml(row.priceDiscipline)}</td>
          <td>${escapeHtml(row.sellCheck)}</td>
        </tr>
      `,
    )
    .join("");

  drawBuffettChart(rows);
}

function drawBuffettChart(rows) {
  const canvas = el.buffettChart;
  if (!canvas) return;
  rows = rows.filter(isBuffettEligible);
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  if (!rows.length) {
    ctx.fillStyle = "#9ba89d";
    ctx.font = "14px system-ui";
    ctx.fillText("분석할 포트폴리오 종목이 없습니다.", 28, 44);
    return;
  }

  const pad = 54;
  const chartRows = rows;
  const gap = 14;
  const barHeight = Math.max(18, (height - pad * 2 - gap * (chartRows.length - 1)) / chartRows.length);
  chartRows.forEach((row, index) => {
    const y = pad + index * (barHeight + gap);
    const barWidth = (row.score / 100) * (width - pad * 2);
    const color = row.score >= 70 ? "#75d37b" : row.score >= 45 ? "#f5c35b" : "#ff6b6b";
    ctx.fillStyle = "rgba(238, 244, 238, 0.08)";
    ctx.fillRect(pad, y, width - pad * 2, barHeight);
    ctx.fillStyle = color;
    ctx.fillRect(pad, y, barWidth, barHeight);
    ctx.fillStyle = "#eef4ee";
    ctx.font = "bold 12px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(displayHoldingName(row), 10, y + barHeight / 2 + 4);
    ctx.textAlign = "right";
    ctx.fillText(`${row.score}점`, width - 10, y + barHeight / 2 + 4);
  });
}

async function refreshWatchlist() {
  setStatus("관심 종목 갱신 중", "idle");
  const quotes = await Promise.all(watchlistItems.map((item) => getQuote(item.symbol, "1d", "5m")));
  renderWatchlist(quotes);
}

function bindEvents() {
  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-tab").forEach((tab) => tab.classList.remove("active"));
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`#${button.dataset.view}View`).classList.add("active");
      setSearchVisibility(button.dataset.view);
      if (button.dataset.view === "dashboard") renderPortfolio();
      if (button.dataset.view === "portfolio") renderPortfolio();
      if (button.dataset.view === "flow") renderFlowDashboard();
      if (button.dataset.view === "lynch") renderLynchAnalysis();
      if (button.dataset.view === "buffett") renderBuffettAnalysis();
    });
  });

  document.querySelector("#symbolForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const symbol = normalizeSymbol(document.querySelector("#symbolInput").value);
    if (symbol) selectSymbol(symbol);
  });

  document.querySelectorAll(".chart-toolbar .range-tab").forEach((button) => {
    button.addEventListener("click", async () => {
      document.querySelectorAll(".chart-toolbar .range-tab").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      selectedRange = { range: button.dataset.range, interval: button.dataset.interval };
      await renderSelectedQuote();
    });
  });

  el.researchRangeTabs?.querySelectorAll(".range-tab").forEach((button) => {
    button.addEventListener("click", async () => {
      el.researchRangeTabs.querySelectorAll(".range-tab").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      researchRange = { range: button.dataset.range, interval: button.dataset.interval };
      const quote = await getQuote(selectedSymbol, researchRange.range, researchRange.interval);
      const financials = await getFinancials(selectedSymbol);
      renderResearchDetail(quote, financials);
    });
  });

  document.querySelectorAll(".guide-item").forEach((button) => {
    button.addEventListener("click", () => selectSymbol(button.dataset.symbol));
  });

  document.querySelector("#refreshAll").addEventListener("click", async () => {
    quoteCache.clear();
    financialCache.clear();
    await refreshWatchlist();
    await renderSelectedQuote();
  });

  el.watchlistForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const symbol = normalizeSymbol(el.watchSymbol.value);
    if (!symbol) return;
    const known = getKnownSymbol(symbol);
    const nextItem = {
      symbol,
      name: el.watchName.value.trim() || known?.name || symbol,
      type: classifySymbol(symbol),
      currency: guessCurrency(symbol),
    };
    watchlistItems = watchlistItems.filter((item) => normalizeSymbol(item.symbol) !== symbol).concat(nextItem);
    saveWatchlist();
    el.watchlistForm.reset();
    await refreshWatchlist();
  });

  el.watchlist.addEventListener("click", async (event) => {
    const removeButton = event.target.closest(".remove-watch");
    if (!removeButton) return;
    const symbol = normalizeSymbol(removeButton.dataset.symbol);
    watchlistItems = watchlistItems.filter((item) => normalizeSymbol(item.symbol) !== symbol);
    saveWatchlist();
    if (symbol === selectedSymbol && watchlistItems[0]) {
      await selectSymbol(watchlistItems[0].symbol);
      return;
    }
    renderWatchlist([...quoteCache.values()].map((entry) => entry.data));
  });

  document.querySelector("#refreshLynch")?.addEventListener("click", async () => {
    financialCache.clear();
    await renderLynchAnalysis();
  });

  document.querySelector("#refreshBuffett")?.addEventListener("click", async () => {
    financialCache.clear();
    await renderBuffettAnalysis();
  });

  document.querySelector("#holdingForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const holding = {
      symbol: normalizeSymbol(document.querySelector("#holdingSymbol").value),
      name: document.querySelector("#holdingName").value.trim(),
      qty: Number(document.querySelector("#holdingQty").value),
      avgPrice: Number(document.querySelector("#holdingAvg").value),
      currency: document.querySelector("#holdingCurrency").value,
    };
    const existingIndex = holdings.findIndex((item) => normalizeSymbol(item.symbol) === holding.symbol);
    if (existingIndex >= 0) holdings[existingIndex] = holding;
    else holdings = holdings.concat(holding);
    saveHoldings();
    event.target.reset();
    await renderSelectedQuote();
    if (isLynchViewActive()) await renderLynchAnalysis();
    if (isBuffettViewActive()) await renderBuffettAnalysis();
  });

  document.querySelector("#holdingSymbol").addEventListener("change", (event) => {
    document.querySelector("#holdingCurrency").value = suggestedHoldingCurrency(event.target.value);
  });

  el.transactionForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      applyTransaction({
        date: form.querySelector("#tradeDate").value || todayKey(),
        type: form.querySelector("#tradeType").value,
        symbol: form.querySelector("#tradeSymbol").value,
        name: form.querySelector("#tradeName").value.trim() || form.querySelector("#tradeSymbol").value.trim(),
        qty: Number(form.querySelector("#tradeQty").value),
        price: Number(form.querySelector("#tradePrice").value),
        currency: form.querySelector("#tradeCurrency").value,
      });
      form.reset();
      form.querySelector("#tradeDate").value = todayKey();
      await renderSelectedQuote();
      renderFlowDashboard();
      if (isLynchViewActive()) await renderLynchAnalysis();
      if (isBuffettViewActive()) await renderBuffettAnalysis();
    } catch (error) {
      alert(error.message || "거래를 저장하지 못했습니다.");
    }
  });

  document.querySelector("#tradeSymbol")?.addEventListener("change", (event) => {
    const symbol = normalizeSymbol(event.target.value);
    const known = getKnownSymbol(symbol);
    const nameInput = document.querySelector("#tradeName");
    const currencyInput = document.querySelector("#tradeCurrency");
    if (nameInput && !nameInput.value && known?.name) nameInput.value = known.name;
    if (currencyInput) currencyInput.value = suggestedHoldingCurrency(symbol);
  });

  el.transactionRows?.addEventListener("click", async (event) => {
    const button = event.target.closest(".delete-transaction");
    if (!button) return;
    transactions = transactions.filter((tx) => tx.id !== button.dataset.id);
    saveTransactions();
    renderFlowDashboard();
  });

  el.portfolioRows.addEventListener("click", async (event) => {
    const moveButton = event.target.closest(".move-row");
    if (moveButton) {
      const index = Number(moveButton.dataset.index);
      const direction = moveButton.dataset.direction === "up" ? -1 : 1;
      const nextIndex = index + direction;
      if (holdings[index] && holdings[nextIndex]) {
        [holdings[index], holdings[nextIndex]] = [holdings[nextIndex], holdings[index]];
        saveHoldings();
        await renderSelectedQuote();
        if (isLynchViewActive()) await renderLynchAnalysis();
        if (isBuffettViewActive()) await renderBuffettAnalysis();
      }
      return;
    }
    const button = event.target.closest(".delete-row");
    if (!button) return;
    holdings.splice(Number(button.dataset.index), 1);
    saveHoldings();
    await renderSelectedQuote();
    if (isLynchViewActive()) await renderLynchAnalysis();
    if (isBuffettViewActive()) await renderBuffettAnalysis();
  });

  el.portfolioRows.addEventListener("change", async (event) => {
    const input = event.target.closest(".portfolio-edit");
    if (!input) return;
    const index = Number(input.dataset.index);
    const field = input.dataset.field;
    const value = Number(input.value);
    if (!holdings[index] || !Number.isFinite(value) || value < 0) {
      await renderPortfolio();
      return;
    }
    holdings[index][field] = value;
    saveHoldings();
    await renderSelectedQuote();
    if (isLynchViewActive()) await renderLynchAnalysis();
    if (isBuffettViewActive()) await renderBuffettAnalysis();
  });

  document.querySelector("#clearPortfolio").addEventListener("click", async () => {
    holdings = [];
    saveHoldings();
    await renderSelectedQuote();
    if (isLynchViewActive()) await renderLynchAnalysis();
    if (isBuffettViewActive()) await renderBuffettAnalysis();
  });
}

function tickClock() {
  el.clock.textContent = new Date().toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

async function init() {
  bindEvents();
  setSearchVisibility("dashboard");
  renderWatchlist();
  tickClock();
  setInterval(tickClock, 1000);
  document.querySelector("#symbolInput").value = selectedSymbol;
  const tradeDate = document.querySelector("#tradeDate");
  if (tradeDate && !tradeDate.value) tradeDate.value = todayKey();
  await refreshWatchlist();
  await renderSelectedQuote();
  setInterval(async () => {
    await refreshWatchlist();
    await renderSelectedQuote();
  }, 15_000);
}

init();

if ("serviceWorker" in navigator) {
  let refreshing = false;
  async function resetServiceWorkerCache() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("reset") && !params.has("fresh")) return false;
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    const cleanUrl = `${window.location.origin}${window.location.pathname}?v=${Date.now()}`;
    window.location.replace(cleanUrl);
    return true;
  }

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    if (await resetServiceWorkerCache()) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.update())
      .catch((error) => {
        console.warn("Service worker registration failed", error);
      });
  });
}
