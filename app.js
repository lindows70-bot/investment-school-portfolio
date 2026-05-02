const MARKET_SYMBOLS = [
  { symbol: "AAPL", name: "Apple Inc.", type: "US Stock", currency: "USD" },
  { symbol: "TSLA", name: "Tesla", type: "US Stock", currency: "USD" },
  { symbol: "005930.KS", name: "Samsung Electronics", type: "KR Stock", currency: "KRW" },
  { symbol: "035720.KQ", name: "Kakao", type: "KR Stock", currency: "KRW" },
  { symbol: "BTC-USD", name: "Bitcoin", type: "Crypto", currency: "USD" },
  { symbol: "XRP-USD", name: "XRP", type: "Crypto", currency: "USD" },
];

const STORAGE_KEY = "portfolio-pulse-holdings";
const quoteCache = new Map();

let selectedSymbol = "AAPL";
let selectedRange = { range: "1d", interval: "5m" };
let holdings = loadHoldings();

const el = {
  clock: document.querySelector("#clock"),
  connectionState: document.querySelector("#connectionState"),
  watchlist: document.querySelector("#watchlist"),
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
  portfolioRows: document.querySelector("#portfolioRows"),
};

function loadHoldings() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return [
      { symbol: "AAPL", name: "Apple Inc.", qty: 3, avgPrice: 180, currency: "USD" },
      { symbol: "005930.KS", name: "삼성전자", qty: 10, avgPrice: 72000, currency: "KRW" },
      { symbol: "BTC-USD", name: "Bitcoin", qty: 0.02, avgPrice: 65000, currency: "USD" },
    ];
  }
  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

function saveHoldings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
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

function normalizeSymbol(symbol) {
  return symbol.trim().toUpperCase();
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
  const result = data.chart?.result?.[0];
  if (!result) throw new Error(data.chart?.error?.description || "시세 데이터가 없습니다.");

  const meta = result.meta;
  const quote = result.indicators?.quote?.[0] || {};
  const timestamps = result.timestamp || [];
  const closes = (quote.close || []).map((price, index) => ({
    time: timestamps[index] * 1000,
    price,
  })).filter((point) => Number.isFinite(point.price));

  const previous = Number(meta.chartPreviousClose ?? closes[0]?.price ?? meta.regularMarketPrice);
  const current = Number(meta.regularMarketPrice ?? closes.at(-1)?.price ?? 0);
  const changePercent = previous ? ((current - previous) / previous) * 100 : 0;

  return {
    symbol,
    name: meta.longName || meta.shortName || symbol,
    type: classifySymbol(symbol),
    currency: meta.currency || guessCurrency(symbol),
    price: current,
    previous,
    changePercent,
    marketTime: meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now(),
    points: closes,
    source: "live",
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

function guessCurrency(symbol) {
  return symbol.endsWith(".KS") || symbol.endsWith(".KQ") ? "KRW" : "USD";
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
    name: MARKET_SYMBOLS.find((item) => item.symbol === symbol)?.name || symbol,
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
  try {
    return await fetchFinancials(symbol);
  } catch (error) {
    console.warn(error);
    return {
      eps: null,
      bps: null,
      pbr: null,
      per: null,
      marketCap: null,
      currency: guessCurrency(symbol),
    };
  }
}

function setStatus(text, state = "idle") {
  el.connectionState.textContent = text;
  el.connectionState.style.borderColor =
    state === "ok" ? "rgba(117, 211, 123, 0.8)" : state === "warn" ? "rgba(245, 195, 91, 0.8)" : "var(--line)";
}

function renderWatchlist(quotes = []) {
  el.watchlist.innerHTML = "";
  MARKET_SYMBOLS.forEach((item) => {
    const quote = quotes.find((candidate) => candidate.symbol === item.symbol);
    const button = document.createElement("button");
    button.className = `watch-item ${item.symbol === selectedSymbol ? "active" : ""}`;
    button.dataset.symbol = item.symbol;
    button.innerHTML = `
      <div><strong>${item.symbol}</strong><span>${item.name}</span></div>
      <div>
        <strong>${quote ? formatMoney(quote.price, quote.currency) : "-"}</strong>
        <span class="${quote ? changeClass(quote.changePercent) : "change neutral"}">${quote ? quote.changePercent.toFixed(2) : "0.00"}%</span>
      </div>
    `;
    button.addEventListener("click", () => selectSymbol(item.symbol));
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

function drawChart(points, currency) {
  const canvas = el.chart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  if (!points.length) {
    ctx.fillStyle = "#9ba89d";
    ctx.fillText("차트 데이터가 없습니다.", 24, 40);
    return;
  }

  const prices = points.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const padX = 78;
  const padY = 28;
  const range = max - min || 1;

  ctx.strokeStyle = "rgba(238, 244, 238, 0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = padY + ((height - padY * 2) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(width - padX, y);
    ctx.stroke();
  }

  const xFor = (index) => padX + (index / Math.max(points.length - 1, 1)) * (width - padX * 2);
  const yFor = (price) => height - padY - ((price - min) / range) * (height - padY * 2);
  const isUp = points.at(-1).price >= points[0].price;

  const gradient = ctx.createLinearGradient(0, padY, 0, height - padY);
  gradient.addColorStop(0, isUp ? "rgba(117, 211, 123, 0.30)" : "rgba(255, 107, 107, 0.24)");
  gradient.addColorStop(1, "rgba(24, 29, 26, 0)");

  ctx.beginPath();
  points.forEach((point, index) => {
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
  points.forEach((point, index) => {
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

async function renderPortfolio() {
  const quoteResults = await Promise.all(holdings.map((holding) => getQuote(holding.symbol, "1d", "5m")));
  let totalCostKrw = 0;
  let totalValueKrw = 0;
  el.portfolioRows.innerHTML = "";

  holdings.forEach((holding, index) => {
    const quote = quoteResults[index] || fallbackQuote(holding.symbol);
    const fx = holding.currency === "USD" ? 1350 : 1;
    const cost = holding.qty * holding.avgPrice;
    const value = holding.qty * quote.price;
    const profit = value - cost;
    totalCostKrw += cost * fx;
    totalValueKrw += value * fx;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(holding.symbol)}</strong><br><span class="muted">${escapeHtml(holding.name || quote.name)}</span></td>
      <td>
        <input class="portfolio-edit" data-index="${index}" data-field="qty" type="number" min="0" step="0.000001" value="${holding.qty}" title="수량 수정" />
      </td>
      <td>
        <input class="portfolio-edit" data-index="${index}" data-field="avgPrice" type="number" min="0" step="0.01" value="${holding.avgPrice}" title="평균단가 수정" />
      </td>
      <td>${formatMoney(quote.price, quote.currency || holding.currency)}</td>
      <td>${formatMoney(value, holding.currency)}</td>
      <td><span class="${changeClass(profit)}">${formatMoney(profit, holding.currency)}</span></td>
      <td><button class="delete-row" data-index="${index}" title="삭제">×</button></td>
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
}

async function refreshWatchlist() {
  setStatus("관심 종목 갱신 중", "idle");
  const quotes = await Promise.all(MARKET_SYMBOLS.map((item) => getQuote(item.symbol, "1d", "5m")));
  renderWatchlist(quotes);
}

function bindEvents() {
  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-tab").forEach((tab) => tab.classList.remove("active"));
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`#${button.dataset.view}View`).classList.add("active");
    });
  });

  document.querySelector("#symbolForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const symbol = normalizeSymbol(document.querySelector("#symbolInput").value);
    if (symbol) selectSymbol(symbol);
  });

  document.querySelectorAll(".range-tab").forEach((button) => {
    button.addEventListener("click", async () => {
      document.querySelectorAll(".range-tab").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      selectedRange = { range: button.dataset.range, interval: button.dataset.interval };
      await renderSelectedQuote();
    });
  });

  document.querySelectorAll(".guide-item").forEach((button) => {
    button.addEventListener("click", () => selectSymbol(button.dataset.symbol));
  });

  document.querySelector("#refreshAll").addEventListener("click", async () => {
    quoteCache.clear();
    await refreshWatchlist();
    await renderSelectedQuote();
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
    holdings = holdings.filter((item) => item.symbol !== holding.symbol).concat(holding);
    saveHoldings();
    event.target.reset();
    await renderSelectedQuote();
  });

  el.portfolioRows.addEventListener("click", async (event) => {
    const button = event.target.closest(".delete-row");
    if (!button) return;
    holdings.splice(Number(button.dataset.index), 1);
    saveHoldings();
    await renderSelectedQuote();
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
  });

  document.querySelector("#clearPortfolio").addEventListener("click", async () => {
    holdings = [];
    saveHoldings();
    await renderSelectedQuote();
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
  renderWatchlist();
  tickClock();
  setInterval(tickClock, 1000);
  document.querySelector("#symbolInput").value = selectedSymbol;
  await refreshWatchlist();
  await renderSelectedQuote();
  setInterval(async () => {
    await refreshWatchlist();
    await renderSelectedQuote();
  }, 15_000);
}

init();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  });
}
