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
  let realtime = {};
  try {
    realtime = await fetchJson(`https://finance.naver.com/item/siseLast.naver?code=${encodeURIComponent(code)}`, {
      headers: {
        Referer: `https://finance.naver.com/item/main.naver?code=${encodeURIComponent(code)}`,
      },
    });
  } catch {
    realtime = {};
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
            bookValue: { raw: bps },
            priceToBook: { raw: Number(realtime.pbr) || pbr },
          },
          summaryDetail: {
            trailingPE: { raw: Number(realtime.per) || per },
          },
          financialData: {
            earningsGrowth: { raw: earningsGrowth },
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
                  bookValue: { raw: quote.bookValue ?? null },
                  priceToBook: { raw: quote.priceToBook ?? null },
                },
                summaryDetail: {
                  trailingPE: { raw: quote.trailingPE ?? null },
                },
                financialData: {
                  earningsGrowth: { raw: quote.earningsQuarterlyGrowth ?? null },
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
      const cacheControl =
        ext === ".html" ? "no-cache" : ext === ".js" || ext === ".css" ? "no-cache" : "public, max-age=86400";
      res.writeHead(200, {
        "Content-Type": types[ext] || "text/plain; charset=utf-8",
        "Cache-Control": cacheControl,
      });
      res.end(content);
    });
  })
  .listen(port, "0.0.0.0", () => {
    console.log(`Portfolio Pulse running at http://localhost:${port}`);
  });
