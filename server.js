const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT) || 4173;
const root = __dirname;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

const yahooHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
};

let yahooSession = {
  cookie: "",
  crumb: "",
  expiresAt: 0,
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(payload));
}

function sendResetPage(res) {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, max-age=0, must-revalidate",
  });
  res.end(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>앱 캐시 초기화</title>
    <style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111513;color:#eef4ee;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      main{max-width:520px;padding:28px;text-align:center}
      h1{font-size:24px;margin:0 0 10px}
      p{color:#9ba89d;line-height:1.55}
    </style>
  </head>
  <body>
    <main>
      <h1>최신 버전으로 초기화 중</h1>
      <p>아이폰에 남아 있는 예전 앱 캐시와 예전 포트폴리오 데이터를 지우고 있습니다.</p>
    </main>
    <script>
      (async () => {
        try {
          localStorage.clear();
          sessionStorage.clear();
          if ("serviceWorker" in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.unregister()));
          }
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
          }
        } catch (error) {
          console.warn(error);
        }
        location.replace("/?v=" + Date.now());
      })();
    </script>
  </body>
</html>`);
}

function collectCookie(headers) {
  const setCookies = headers.getSetCookie?.() || [headers.get("set-cookie")].filter(Boolean);
  return setCookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

async function getYahooSession(forceRefresh = false) {
  if (!forceRefresh && yahooSession.cookie && yahooSession.crumb && yahooSession.expiresAt > Date.now()) {
    return yahooSession;
  }

  const cookieResponse = await fetch("https://fc.yahoo.com", { headers: yahooHeaders });
  const cookie = collectCookie(cookieResponse.headers);
  const crumbResponse = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { ...yahooHeaders, Cookie: cookie },
  });
  if (!crumbResponse.ok) throw new Error("Yahoo crumb request failed");

  const crumb = (await crumbResponse.text()).trim();
  yahooSession = {
    cookie,
    crumb,
    expiresAt: Date.now() + 1000 * 60 * 45,
  };
  return yahooSession;
}

async function fetchJson(url, options = {}) {
  const headers = { ...yahooHeaders, ...(options.headers || {}) };
  const response = await fetch(url, { headers });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { error: text };
  }
  if (!response.ok) {
    const message = payload?.chart?.error?.description || payload?.quoteSummary?.error?.description || response.statusText;
    throw new Error(message || `HTTP ${response.status}`);
  }
  return payload;
}

async function fetchYahooSummary(symbol, modules) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const session = await getYahooSession(attempt > 0);
    const summaryUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      symbol,
    )}?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`;
    try {
      return await fetchJson(summaryUrl, { headers: { Cookie: session.cookie } });
    } catch (error) {
      if (!/Unauthorized|401|Invalid Crumb/i.test(error.message) || attempt === 1) throw error;
    }
  }
  throw new Error("Yahoo summary request failed");
}

function isKoreanSymbol(symbol) {
  return symbol.endsWith(".KS") || symbol.endsWith(".KQ");
}

function isCryptoSymbol(symbol) {
  return symbol.endsWith("-USD");
}

function upbitMarket(symbol) {
  return `KRW-${symbol.replace("-USD", "")}`;
}

function upbitCandleEndpoint(range, interval) {
  if (interval === "1wk") return { path: "weeks", count: range === "1y" ? 60 : 24 };
  if (interval === "1d") return { path: "days", count: range === "1y" ? 365 : range === "6mo" ? 180 : 60 };
  const unit = Number.parseInt(interval, 10) || 5;
  return { path: `minutes/${unit}`, count: range === "5d" ? 200 : 120 };
}

async function fetchUpbitChart(symbol, range = "1d", interval = "5m") {
  const market = upbitMarket(symbol);
  const { path: candlePath, count } = upbitCandleEndpoint(range, interval);
  const [tickerPayload, candlePayload] = await Promise.all([
    fetchJson(`https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(market)}`, {
      headers: { Accept: "application/json" },
    }),
    fetchJson(`https://api.upbit.com/v1/candles/${candlePath}?market=${encodeURIComponent(market)}&count=${count}`, {
      headers: { Accept: "application/json" },
    }),
  ]);
  const ticker = Array.isArray(tickerPayload) ? tickerPayload[0] : {};
  const candles = (Array.isArray(candlePayload) ? candlePayload : [])
    .slice()
    .reverse()
    .map((item) => ({
      time: new Date(item.candle_date_time_kst || item.candle_date_time_utc).getTime(),
      open: Number(item.opening_price),
      high: Number(item.high_price),
      low: Number(item.low_price),
      close: Number(item.trade_price),
      volume: Number(item.candle_acc_trade_volume),
    }))
    .filter((item) => Number.isFinite(item.close));
  const current = Number(ticker.trade_price ?? candles.at(-1)?.close ?? 0);
  const previous = Number(ticker.prev_closing_price ?? candles[0]?.close ?? current);

  return {
    chart: {
      result: [
        {
          meta: {
            currency: "KRW",
            symbol,
            shortName: market,
            longName: `${symbol.replace("-USD", "")} 원화`,
            regularMarketPrice: current,
            chartPreviousClose: previous,
            regularMarketTime: ticker.timestamp ? Math.floor(Number(ticker.timestamp) / 1000) : Math.floor(Date.now() / 1000),
          },
          timestamp: candles.map((item) => Math.floor(item.time / 1000)),
          indicators: {
            quote: [
              {
                open: candles.map((item) => item.open),
                high: candles.map((item) => item.high),
                low: candles.map((item) => item.low),
                close: candles.map((item) => item.close),
                volume: candles.map((item) => item.volume),
              },
            ],
          },
        },
      ],
    },
    source: "upbit",
  };
}

function parseNaverMetric(html, label) {
  return parseNaverMetricValues(html, label).at(-1) ?? null;
}

function parseNaverMetricValues(html, label) {
  const rowPattern = new RegExp(`<tr[^>]*>[\\s\\S]*?<strong>${label}[\\s\\S]*?</tr>`, "i");
  const row = html.match(rowPattern)?.[0] || "";
  return [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
    .map((match) =>
      match[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .map((value) => Number(value.replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value !== 0);
}

function naverNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/,/g, "").replace(/%/g, "").trim();
  if (!normalized || normalized === "-" || normalized === "N/A") return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function normalizeNaverLabel(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, "")
    .replace(/[\s.·ㆍ()]/g, "")
    .trim();
}

function naverRowLabel(row) {
  return normalizeNaverLabel(row?.ACC_NM || row?.acc_nm || row?.NM || row?.name || "");
}

function findNaverRow(rows, labels) {
  const normalizedLabels = labels.map(normalizeNaverLabel);
  return (rows || []).find((row) => {
    const label = naverRowLabel(row);
    return normalizedLabels.some((target) => label.includes(target));
  });
}

function latestNaverValue(row, options = {}) {
  if (!row) return null;
  const actualKeys = ["DATA5", "DATA4", "DATA3", "DATA2", "DATA1", "DATA6"];
  const estimateKeys = ["DATA6", "DATA5", "DATA4", "DATA3", "DATA2", "DATA1"];
  const keys = options.preferEstimate ? estimateKeys : actualKeys;
  for (const key of keys) {
    const value = naverNumber(row[key] ?? row[key.toLowerCase()]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function naverHundredMillionWon(value) {
  return Number.isFinite(value) ? value * 100_000_000 : null;
}

function extractNaverRows(payload) {
  return Array.isArray(payload?.DATA) ? payload.DATA : [];
}

async function fetchNaverAnalysisReport(code, encparam, rpt, referer) {
  const params = new URLSearchParams({
    cmp_cd: code,
    frq: "0",
    rpt: String(rpt),
    finGubun: "MAIN",
    frqTyp: "0",
    cn: "",
    encparam,
  });
  return fetchJson(`https://navercomp.wisereport.co.kr/v2/company/cF3002.aspx?${params.toString()}`, {
    headers: {
      Accept: "application/json,text/plain,*/*",
      Referer: referer,
    },
  });
}

async function fetchNaverCompanyAnalysis(code) {
  const referer = `https://navercomp.wisereport.co.kr/v2/company/c1030001.aspx?cmp_cd=${encodeURIComponent(code)}`;
  const response = await fetch(referer, {
    headers: {
      "User-Agent": yahooHeaders["User-Agent"],
      Accept: "text/html,*/*",
    },
  });
  if (!response.ok) throw new Error(`Naver analysis request failed: ${response.status}`);

  const html = await response.text();
  const encparam = html.match(/encparam:\s*'([^']+)'/)?.[1];
  if (!encparam) return {};

  const [incomePayload, balancePayload, cashflowPayload] = await Promise.all([
    fetchNaverAnalysisReport(code, encparam, 0, referer),
    fetchNaverAnalysisReport(code, encparam, 1, referer),
    fetchNaverAnalysisReport(code, encparam, 2, referer),
  ]);

  const income = extractNaverRows(incomePayload);
  const balance = extractNaverRows(balancePayload);
  const cashflow = extractNaverRows(cashflowPayload);
  const revenue = latestNaverValue(findNaverRow(income, ["매출액", "수익"]));
  const netIncome = latestNaverValue(findNaverRow(income, ["당기순이익", "순이익"]));
  const totalCash = latestNaverValue(findNaverRow(balance, ["현금및현금성자산", "현금성자산"]));
  const totalDebt = latestNaverValue(findNaverRow(balance, ["부채총계"]));
  const equity = latestNaverValue(findNaverRow(balance, ["자본총계"]));
  const currentAssets = latestNaverValue(findNaverRow(balance, ["유동자산"]));
  const currentLiabilities = latestNaverValue(findNaverRow(balance, ["유동부채"]));
  const operatingCashflow = latestNaverValue(findNaverRow(cashflow, ["영업활동으로인한현금흐름", "영업활동현금흐름"]));
  const freeCashflow = latestNaverValue(findNaverRow(cashflow, ["FCF", "잉여현금흐름"]));
  const capex = latestNaverValue(findNaverRow(cashflow, ["유형자산의취득", "설비투자"]));
  const estimatedFreeCashflow =
    Number.isFinite(freeCashflow) ? freeCashflow : Number.isFinite(operatingCashflow) && Number.isFinite(capex)
      ? operatingCashflow - Math.abs(capex)
      : null;

  return {
    totalCash: naverHundredMillionWon(totalCash),
    totalDebt: naverHundredMillionWon(totalDebt),
    debtToEquity: Number.isFinite(totalDebt) && Number.isFinite(equity) && equity !== 0 ? (totalDebt / equity) * 100 : null,
    returnOnEquity:
      Number.isFinite(netIncome) && Number.isFinite(equity) && equity !== 0 ? netIncome / equity : null,
    profitMargins: Number.isFinite(netIncome) && Number.isFinite(revenue) && revenue !== 0 ? netIncome / revenue : null,
    freeCashflow: naverHundredMillionWon(estimatedFreeCashflow),
    currentRatio:
      Number.isFinite(currentAssets) && Number.isFinite(currentLiabilities) && currentLiabilities !== 0
        ? currentAssets / currentLiabilities
        : null,
  };
}

async function fetchNaverInvestmentRatios(code) {
  const referer = `https://navercomp.wisereport.co.kr/v2/company/c1040001.aspx?cmp_cd=${encodeURIComponent(code)}`;
  const response = await fetch(referer, {
    headers: {
      "User-Agent": yahooHeaders["User-Agent"],
      Accept: "text/html,*/*",
    },
  });
  if (!response.ok) throw new Error(`Naver investment ratios request failed: ${response.status}`);

  const html = await response.text();
  const encparam = html.match(/encparam:\s*'([^']+)'/)?.[1];
  if (!encparam) return {};

  const fetchRatioReport = (rpt) => {
    const params = new URLSearchParams({
      cmp_cd: code,
      frq: "0",
      rpt: String(rpt),
      finGubun: "MAIN",
      frqTyp: "0",
      cn: "",
      encparam,
    });
    return fetchJson(`https://navercomp.wisereport.co.kr/v2/company/cF4002.aspx?${params.toString()}`, {
      headers: {
        Accept: "application/json,text/plain,*/*",
        Referer: referer,
      },
    });
  };

  const [profitabilityPayload, stabilityPayload] = await Promise.all([fetchRatioReport(0), fetchRatioReport(3)]);
  const profitability = extractNaverRows(profitabilityPayload);
  const stability = extractNaverRows(stabilityPayload);
  const roe = latestNaverValue(findNaverRow(profitability, ["ROE"]));
  const profitMargin = latestNaverValue(findNaverRow(profitability, ["순이익률"]));
  const debtToEquity = latestNaverValue(findNaverRow(stability, ["부채비율"]));
  const currentRatio = latestNaverValue(findNaverRow(stability, ["유동비율"]));

  return {
    returnOnEquity: Number.isFinite(roe) ? roe / 100 : null,
    profitMargins: Number.isFinite(profitMargin) ? profitMargin / 100 : null,
    debtToEquity: Number.isFinite(debtToEquity) ? debtToEquity : null,
    currentRatio: Number.isFinite(currentRatio) ? currentRatio / 100 : null,
  };
}

async function fetchNaverConsensus(code) {
  const url = `https://navercomp.wisereport.co.kr/v2/company/c1010001.aspx?cmp_cd=${encodeURIComponent(code)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": yahooHeaders["User-Agent"],
      Accept: "text/html,*/*",
    },
  });
  if (!response.ok) throw new Error(`Naver consensus request failed: ${response.status}`);

  const html = await response.text();
  const table = html.match(/<table[^>]+id=["']cTB15["'][\s\S]*?<\/table>/i)?.[0] || "";
  const text = table.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
  const values = [...text.matchAll(/[-+]?\d[\d,]*(?:\.\d+)?/g)]
    .map((match) => naverNumber(match[0]))
    .filter((value) => Number.isFinite(value));

  return {
    forwardEps: values.length >= 5 ? values[3] : null,
    targetPrice: values.length >= 4 ? values[2] : null,
  };
}

async function fetchNaverFinancials(symbol) {
  const code = symbol.replace(/\.(KS|KQ)$/i, "");
  const response = await fetch(`https://finance.naver.com/item/main.naver?code=${encodeURIComponent(code)}`, {
    headers: {
      "User-Agent": yahooHeaders["User-Agent"],
      Accept: "text/html,*/*",
    },
  });
  if (!response.ok) throw new Error(`Naver financials request failed: ${response.status}`);

  const html = new TextDecoder("windows-949").decode(Buffer.from(await response.arrayBuffer()));
  const eps = parseNaverMetric(html, "EPS");
  const epsValues = parseNaverMetricValues(html, "EPS");
  const bps = parseNaverMetric(html, "BPS");
  const pbr = parseNaverMetric(html, "PBR");
  const per = parseNaverMetric(html, "PER");
  const roe = parseNaverMetric(html, "ROE");
  const netMargin = parseNaverMetric(html, "순이익률");
  let realtime = {};
  let analysis = {};
  let ratios = {};
  let consensus = {};
  try {
    realtime = await fetchJson(`https://finance.naver.com/item/siseLast.naver?code=${encodeURIComponent(code)}`, {
      headers: {
        Referer: `https://finance.naver.com/item/main.naver?code=${encodeURIComponent(code)}`,
      },
    });
  } catch {
    realtime = {};
  }
  try {
    analysis = await fetchNaverCompanyAnalysis(code);
  } catch {
    analysis = {};
  }
  try {
    ratios = await fetchNaverInvestmentRatios(code);
  } catch {
    ratios = {};
  }
  try {
    consensus = await fetchNaverConsensus(code);
  } catch {
    consensus = {};
  }
  const marketCap = Number.isFinite(Number(realtime.marketSum))
    ? Math.trunc(Number(realtime.marketSum) / 100) * 100_000_000
    : null;
  const latestEps = Number(realtime.eps) || epsValues.at(-1) || eps;
  const previousEps = epsValues.length > 1 ? epsValues.at(-2) : null;
  const earningsGrowth =
    latestEps && previousEps && previousEps > 0 ? Math.max((latestEps - previousEps) / previousEps, -0.99) : null;

  return {
    quoteSummary: {
      result: [
        {
          defaultKeyStatistics: {
            trailingEps: { raw: latestEps },
            forwardEps: { raw: consensus.forwardEps ?? null },
            bookValue: { raw: bps },
            priceToBook: { raw: Number(realtime.pbr) || pbr },
          },
          summaryDetail: {
            trailingPE: { raw: Number(realtime.per) || per },
          },
          financialData: {
            earningsGrowth: { raw: earningsGrowth },
            forwardEps: { raw: consensus.forwardEps ?? null },
            totalCash: { raw: analysis.totalCash ?? null },
            totalDebt: { raw: analysis.totalDebt ?? null },
            debtToEquity: { raw: ratios.debtToEquity ?? analysis.debtToEquity ?? null },
            returnOnEquity: { raw: ratios.returnOnEquity ?? analysis.returnOnEquity ?? (Number.isFinite(roe) ? roe / 100 : null) },
            profitMargins: { raw: ratios.profitMargins ?? analysis.profitMargins ?? (Number.isFinite(netMargin) ? netMargin / 100 : null) },
            freeCashflow: { raw: analysis.freeCashflow ?? null },
            currentRatio: { raw: ratios.currentRatio ?? analysis.currentRatio ?? null },
          },
          price: {
            regularMarketPrice: { raw: Number(realtime.now) || null },
            marketCap: { raw: marketCap },
            currency: "KRW",
          },
          source: "naver",
        },
      ],
    },
  };
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/fx") {
    try {
      const pair = url.searchParams.get("pair") || "USDKRW=X";
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        pair,
      )}?range=1d&interval=5m`;
      const payload = await fetchJson(yahooUrl);
      const meta = payload.chart?.result?.[0]?.meta || {};
      sendJson(res, 200, {
        pair,
        rate: Number(meta.regularMarketPrice) || null,
        currency: "KRW",
        updatedAt: meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now(),
      });
    } catch (error) {
      sendJson(res, 502, { error: error.message || "fx request failed" });
    }
    return;
  }

  const symbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();
  if (!symbol) {
    sendJson(res, 400, { error: "symbol is required" });
    return;
  }

  try {
    if (url.pathname === "/api/chart") {
      const range = url.searchParams.get("range") || "1d";
      const interval = url.searchParams.get("interval") || "5m";
      if (isCryptoSymbol(symbol)) {
        sendJson(res, 200, await fetchUpbitChart(symbol, range, interval));
        return;
      }
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        symbol,
      )}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(
        interval,
      )}&includePrePost=true&events=div%2Csplits`;
      sendJson(res, 200, await fetchJson(yahooUrl));
      return;
    }

    if (url.pathname === "/api/financials") {
      if (isKoreanSymbol(symbol)) {
        sendJson(res, 200, await fetchNaverFinancials(symbol));
        return;
      }

      const modules = "summaryDetail,defaultKeyStatistics,financialData,price";
      try {
        sendJson(res, 200, await fetchYahooSummary(symbol, modules));
        return;
      } catch {
        const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
        let quote = {};
        try {
          const quotePayload = await fetchJson(quoteUrl);
          quote = quotePayload.quoteResponse?.result?.[0] || {};
        } catch {
          quote = {};
        }
        sendJson(res, 200, {
          quoteSummary: {
            result: [
              {
                defaultKeyStatistics: {
                  trailingEps: { raw: quote.epsTrailingTwelveMonths ?? null },
                  forwardEps: { raw: quote.epsForward ?? null },
                  bookValue: { raw: quote.bookValue ?? null },
                  priceToBook: { raw: quote.priceToBook ?? null },
                },
                summaryDetail: {
                  trailingPE: { raw: quote.trailingPE ?? null },
                },
                financialData: {
                  earningsGrowth: { raw: quote.earningsQuarterlyGrowth ?? null },
                  forwardEps: { raw: quote.epsForward ?? null },
                },
                price: {
                  regularMarketPrice: { raw: quote.regularMarketPrice ?? null },
                  marketCap: { raw: quote.marketCap ?? null },
                  currency: quote.currency || null,
                },
              },
            ],
          },
        });
        return;
      }
    }

    sendJson(res, 404, { error: "unknown api route" });
  } catch (error) {
    sendJson(res, 502, { error: error.message || "upstream request failed" });
  }
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname === "/reset" || url.searchParams.has("reset") || url.searchParams.has("clearData")) {
      sendResetPage(res);
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      handleApi(req, res, url);
      return;
    }

    const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const filePath = path.resolve(root, `.${pathname}`);

    if (!filePath.startsWith(root + path.sep) && filePath !== root) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath);
      const noStoreAssets = new Set([".html", ".js", ".css", ".webmanifest"]);
      const cacheControl = noStoreAssets.has(ext) ? "no-store, max-age=0, must-revalidate" : "public, max-age=86400";
      const extraHeaders = path.basename(filePath) === "sw.js" ? { "Service-Worker-Allowed": "/" } : {};
      res.writeHead(200, {
        "Content-Type": types[ext] || "text/plain; charset=utf-8",
        "Cache-Control": cacheControl,
        ...extraHeaders,
      });
      res.end(content);
    });
  })
  .listen(port, "0.0.0.0", () => {
    console.log(`Portfolio Pulse running at http://localhost:${port}`);
  });
