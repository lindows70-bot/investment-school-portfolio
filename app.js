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
const quoteCache = new Map();
const financialCache = new Map();
let fxRate = { usdKrw: 1350, updatedAt: null, source: "fallback" };

let selectedSymbol = "AAPL";
let selectedRange = { range: "1d", interval: "5m" };
let holdings = loadHoldings();
let watchlistItems = loadWatchlist();

const el = {
  clock: document.querySelector("#clock"),
  connectionState: document.querySelector("#connectionState"),
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
  portfolioRows: document.querySelector("#portfolioRows"),
  lynchCount: document.querySelector("#lynchCount"),
  lynchAvgPeg: document.querySelector("#lynchAvgPeg"),
  lynchGoodPeg: document.querySelector("#lynchGoodPeg"),
  lynchGrowthCoverage: document.querySelector("#lynchGrowthCoverage"),
  lynchUpdated: document.querySelector("#lynchUpdated"),
  lynchCards: document.querySelector("#lynchCards"),
  lynchRows: document.querySelector("#lynchRows"),
  lynchCategoryGrid: document.querySelector("#lynchCategoryGrid"),
  pegChart: document.querySelector("#pegChart"),
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
    earningsGrowth: raw(financial.earningsGrowth),
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
  return fxRate.usdKrw;
}

function getFxMultiplier(currency) {
  return currency === "USD" ? fxRate.usdKrw : 1;
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
  await fetchFxRate();
  const quoteResults = await Promise.all(holdings.map((holding) => getQuote(holding.symbol, "1d", "5m")));
  let totalCostKrw = 0;
  let totalValueKrw = 0;
  el.portfolioRows.innerHTML = "";

  holdings.forEach((holding, index) => {
    const quote = quoteResults[index] || fallbackQuote(holding.symbol);
    const fx = getFxMultiplier(holding.currency);
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
  if (symbol.includes("ETF") || name.includes("tiger") || name.includes("kodex") || name.includes("s&p")) return "slow";
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
                ? matches.map((row) => `<span>${escapeHtml(row.symbol)}</span>`).join("")
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

function formatPercent(value) {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(1)}%`;
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
    const fx = getFxMultiplier(holding.currency);
    return sum + Number(holding.qty || 0) * Number(quote.price || 0) * fx;
  }, 0);

  return uniqueHoldings.map((holding, index) => {
    const quote = quotes[index];
    const data = financials[index];
    const growthPercent = Number.isFinite(data.earningsGrowth) ? data.earningsGrowth * 100 : null;
    const peg = data.per && growthPercent && growthPercent > 0 ? data.per / growthPercent : null;
    const fx = getFxMultiplier(holding.currency);
    const value = Number(holding.qty || 0) * Number(quote.price || 0) * fx;
    const category = classifyLynchCategory({ holding, quote, financials: data, growthPercent, peg });
    return {
      symbol: holding.symbol,
      name: holding.name || quote.name,
      weight: totalValue ? (value / totalValue) * 100 : 0,
      per: data.per,
      growthPercent,
      peg,
      pbr: data.pbr,
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
          <span>${escapeHtml(row.symbol)}</span>
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
          <td><strong>${escapeHtml(row.symbol)}</strong><br><span class="muted">${escapeHtml(row.name)}</span></td>
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
  drawPegChart(rows);
}

function drawPegChart(rows) {
  const canvas = el.pegChart;
  if (!canvas) return;
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
  const chartRows = rows.slice(0, 8);
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
    ctx.fillText(row.symbol, 10, y + barHeight / 2 + 4);
    ctx.textAlign = "right";
    ctx.fillText(Number.isFinite(row.peg) ? row.peg.toFixed(2) : "-", width - 10, y + barHeight / 2 + 4);
    ctx.textAlign = "left";
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
      if (button.dataset.view === "lynch") renderLynchAnalysis();
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
    if (isLynchViewActive()) await renderLynchAnalysis();
  });

  el.portfolioRows.addEventListener("click", async (event) => {
    const button = event.target.closest(".delete-row");
    if (!button) return;
    holdings.splice(Number(button.dataset.index), 1);
    saveHoldings();
    await renderSelectedQuote();
    if (isLynchViewActive()) await renderLynchAnalysis();
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
  });

  document.querySelector("#clearPortfolio").addEventListener("click", async () => {
    holdings = [];
    saveHoldings();
    await renderSelectedQuote();
    if (isLynchViewActive()) await renderLynchAnalysis();
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
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.update())
      .catch((error) => {
        console.warn("Service worker registration failed", error);
      });
  });
}
