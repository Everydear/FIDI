import type { BacktestAsset } from "./portfolio";
import { parseKrxClosingPrices } from "./krx.mjs";

export type PricePoint = { date: string; value: number };
export type PriceProvider =
  | "Massive SIP EOD + Corporate Actions"
  | "Yahoo Finance Adjusted Chart";

export type DividendEvent = {
  ticker: string;
  exDividendDate: string;
  splitAdjustedCashAmount: number;
};

export type LatestQuote = {
  price: number;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  asOf: string;
  source: string;
  freshness: "latest-available-daily-bar";
};

export type KrxAudit = {
  source: "한국거래소 KRX Open API";
  date: string;
  matched: number;
  total: number;
  maximumDifferencePercent: number;
};

type CacheEntry<T> = { expiresAt: number; value: T };

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const memoryCache = new Map<string, CacheEntry<unknown>>();

async function cached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = CACHE_TTL_MS,
): Promise<T> {
  const current = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (current && current.expiresAt > Date.now()) return current.value;
  const value = await loader();
  memoryCache.set(key, { expiresAt: Date.now() + ttlMs, value });
  return value;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function compactDate(date: string) {
  return date.replaceAll("-", "");
}

function isoDateFromCompact(date: string) {
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

function safeNumber(value: unknown) {
  const parsed =
    typeof value === "string"
      ? Number(value.replaceAll(",", ""))
      : typeof value === "number"
        ? value
        : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function utcDateFromUnixMilliseconds(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function shiftIsoDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isWeekday(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6;
}

async function fetchYahooAdjustedSeries(
  symbol: string,
  start: string,
  end: string,
): Promise<PricePoint[]> {
  return cached(`yahoo:${symbol}:${start}:${end}`, async () => {
    const endpoint = new URL(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
    );
    endpoint.searchParams.set(
      "period1",
      String(Math.floor(Date.parse(`${start}T00:00:00Z`) / 1000)),
    );
    endpoint.searchParams.set(
      "period2",
      String(Math.floor(Date.parse(`${end}T00:00:00Z`) / 1000) + 86_400),
    );
    endpoint.searchParams.set("interval", "1d");
    endpoint.searchParams.set("events", "div,splits");
    endpoint.searchParams.set("includeAdjustedClose", "true");

    const response = await fetch(endpoint, {
      headers: { "User-Agent": "FIDI-Backtest/2.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(
        `한국 종목 수정주가 응답 오류 (${symbol}, ${response.status})`,
      );
    }
    const payload = (await response.json()) as {
      chart?: {
        error?: { description?: string } | null;
        result?: Array<{
          timestamp?: number[];
          indicators?: {
            adjclose?: Array<{ adjclose?: Array<number | null> }>;
            quote?: Array<{ close?: Array<number | null> }>;
          };
        }>;
      };
    };
    const result = payload.chart?.result?.[0];
    if (!result || payload.chart?.error) {
      throw new Error(`한국 종목 가격 이력을 찾을 수 없습니다 (${symbol})`);
    }

    const timestamps = result.timestamp ?? [];
    const adjusted =
      result.indicators?.adjclose?.[0]?.adjclose ??
      result.indicators?.quote?.[0]?.close ??
      [];
    const points = timestamps.flatMap((timestamp, index) => {
      const value = safeNumber(adjusted[index]);
      return value && value > 0
        ? [{ date: utcDateFromUnixMilliseconds(timestamp * 1000), value }]
        : [];
    });
    if (points.length < 2) {
      throw new Error(`한국 종목 수정주가가 부족합니다 (${symbol})`);
    }
    return points;
  });
}

async function fetchMassiveBars(
  ticker: string,
  start: string,
  end: string,
  apiKey: string,
): Promise<PricePoint[]> {
  return cached(`massive-bars:${ticker}:${start}:${end}`, async () => {
    const endpoint = new URL(
      `https://api.massive.com/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${start}/${end}`,
    );
    endpoint.searchParams.set("adjusted", "true");
    endpoint.searchParams.set("sort", "asc");
    endpoint.searchParams.set("limit", "50000");
    endpoint.searchParams.set("apiKey", apiKey);

    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json()) as {
      status?: string;
      error?: string;
      message?: string;
      results?: Array<{ t?: number; c?: number }>;
    };
    if (!response.ok || !Array.isArray(payload.results)) {
      throw new Error(
        `Massive 미국 종가 응답 오류 (${ticker}, ${response.status}): ${
          payload.error ?? payload.message ?? payload.status ?? "unknown"
        }`,
      );
    }

    const points = payload.results.flatMap((row) => {
      const value = safeNumber(row.c);
      return row.t && value && value > 0
        ? [{ date: utcDateFromUnixMilliseconds(row.t), value }]
        : [];
    });
    if (points.length < 2) {
      throw new Error(`Massive 미국 종가가 부족합니다 (${ticker})`);
    }
    return points;
  });
}

function recentUtcDate(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export async function fetchMassiveLatestQuote(
  ticker: string,
  apiKey: string,
): Promise<LatestQuote> {
  return cached(
    `massive-latest:${ticker}`,
    async () => {
      const end = recentUtcDate();
      const start = recentUtcDate(-7);
      const endpoint = new URL(
        `https://api.massive.com/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${start}/${end}`,
      );
      endpoint.searchParams.set("adjusted", "true");
      endpoint.searchParams.set("sort", "asc");
      endpoint.searchParams.set("limit", "10");
      endpoint.searchParams.set("apiKey", apiKey);

      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(15_000),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        status?: string;
        error?: string;
        message?: string;
        results?: Array<{ t?: number; c?: number }>;
      };
      if (!response.ok || !Array.isArray(payload.results)) {
        throw new Error(
          `Massive 최신 종가 응답 오류 (${ticker}, ${response.status}): ${
            payload.error ?? payload.message ?? payload.status ?? "unknown"
          }`,
        );
      }
      const points = payload.results.flatMap((row) => {
        const value = safeNumber(row.c);
        return row.t && value && value > 0
          ? [{ date: utcDateFromUnixMilliseconds(row.t), value }]
          : [];
      });
      const latest = points.at(-1);
      const previous = points.at(-2);
      if (!latest) throw new Error(`Massive 최신 종가가 없습니다 (${ticker})`);
      const change = previous ? latest.value - previous.value : null;
      return {
        price: latest.value,
        previousClose: previous?.value ?? null,
        change,
        changePercent:
          change !== null && previous?.value
            ? change / previous.value
            : null,
        asOf: latest.date,
        source: "Massive 최신 일봉",
        freshness: "latest-available-daily-bar",
      };
    },
    5 * 60 * 1000,
  );
}

export async function fetchYahooLatestQuote(
  symbol: string,
): Promise<LatestQuote> {
  return cached(
    `yahoo-latest:${symbol}`,
    async () => {
      const endpoint = new URL(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
      );
      endpoint.searchParams.set("range", "5d");
      endpoint.searchParams.set("interval", "1d");
      endpoint.searchParams.set("events", "div,splits");
      endpoint.searchParams.set("includePrePost", "true");

      const response = await fetch(endpoint, {
        headers: { "User-Agent": "FIDI-Portfolio/4.1" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        throw new Error(`최신 국내 시세 응답 오류 (${symbol}, ${response.status})`);
      }
      const payload = (await response.json()) as {
        chart?: {
          error?: { description?: string } | null;
          result?: Array<{
            timestamp?: number[];
            indicators?: {
              quote?: Array<{ close?: Array<number | null> }>;
            };
          }>;
        };
      };
      const result = payload.chart?.result?.[0];
      if (!result || payload.chart?.error) {
        throw new Error(`최신 국내 시세를 찾을 수 없습니다 (${symbol})`);
      }
      const timestamps = result.timestamp ?? [];
      const closes = result.indicators?.quote?.[0]?.close ?? [];
      const points = timestamps.flatMap((timestamp, index) => {
        const value = safeNumber(closes[index]);
        return value && value > 0
          ? [{ date: utcDateFromUnixMilliseconds(timestamp * 1000), value }]
          : [];
      });
      const latest = points.at(-1);
      const previous = points.at(-2);
      if (!latest) throw new Error(`최신 국내 시세가 없습니다 (${symbol})`);
      const change = previous ? latest.value - previous.value : null;
      return {
        price: latest.value,
        previousClose: previous?.value ?? null,
        change,
        changePercent:
          change !== null && previous?.value
            ? change / previous.value
            : null,
        asOf: latest.date,
        source: "Yahoo 최신 일봉",
        freshness: "latest-available-daily-bar",
      };
    },
    5 * 60 * 1000,
  );
}

export async function fetchMassiveDividendEvents(
  tickers: string[],
  start: string,
  end: string,
  apiKey?: string,
): Promise<DividendEvent[]> {
  if (!apiKey) {
    throw new Error("MASSIVE_API_KEY가 연결되지 않았습니다.");
  }
  const uniqueTickers = [...new Set(tickers)].sort();
  if (uniqueTickers.length === 0) return [];

  return cached(
    `massive-dividends:${uniqueTickers.join(",")}:${start}:${end}`,
    async () => {
      const endpoint = new URL("https://api.massive.com/stocks/v1/dividends");
      endpoint.searchParams.set("ticker.any_of", uniqueTickers.join(","));
      endpoint.searchParams.set("ex_dividend_date.gte", start);
      endpoint.searchParams.set("ex_dividend_date.lte", end);
      endpoint.searchParams.set("limit", "5000");
      endpoint.searchParams.set("sort", "ticker.asc,ex_dividend_date.asc");
      endpoint.searchParams.set("apiKey", apiKey);

      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(15_000),
      });
      const payload = (await response.json()) as {
        status?: string;
        error?: string;
        results?: Array<{
          ticker?: string;
          ex_dividend_date?: string;
          split_adjusted_cash_amount?: number;
          cash_amount?: number;
        }>;
      };
      if (!response.ok || !Array.isArray(payload.results)) {
        throw new Error(
          `Massive 배당 응답 오류 (${response.status}): ${
            payload.error ?? payload.status ?? "unknown"
          }`,
        );
      }

      return payload.results.flatMap((row) => {
        const amount = safeNumber(
          row.split_adjusted_cash_amount ?? row.cash_amount,
        );
        return row.ticker &&
          row.ex_dividend_date &&
          amount !== null &&
          amount >= 0
          ? [
              {
                ticker: row.ticker,
                exDividendDate: row.ex_dividend_date,
                splitAdjustedCashAmount: amount,
              },
            ]
          : [];
      });
    },
  );
}

function createTotalReturnSeries(
  closes: PricePoint[],
  dividends: DividendEvent[],
): PricePoint[] {
  if (closes.length < 2) return closes;
  const dividendByDate = new Map<string, number>();
  for (const dividend of dividends) {
    dividendByDate.set(
      dividend.exDividendDate,
      (dividendByDate.get(dividend.exDividendDate) ?? 0) +
        dividend.splitAdjustedCashAmount,
    );
  }

  let indexValue = closes[0].value;
  const result: PricePoint[] = [
    { date: closes[0].date, value: indexValue },
  ];
  for (let index = 1; index < closes.length; index += 1) {
    const previousClose = closes[index - 1].value;
    const current = closes[index];
    const cashDividend = dividendByDate.get(current.date) ?? 0;
    indexValue *= (current.value + cashDividend) / previousClose;
    result.push({ date: current.date, value: indexValue });
  }
  return result;
}

export async function fetchAssetSeries(
  asset: BacktestAsset,
  start: string,
  end: string,
  options: {
    massiveApiKey?: string;
    dividendEvents?: DividendEvent[];
  },
): Promise<{ provider: PriceProvider; points: PricePoint[] }> {
  if (asset.market === "US") {
    if (!options.massiveApiKey) {
      throw new Error("MASSIVE_API_KEY가 연결되지 않았습니다.");
    }
    const closes = await fetchMassiveBars(
      asset.id,
      start,
      end,
      options.massiveApiKey,
    );
    return {
      provider: "Massive SIP EOD + Corporate Actions",
      points: createTotalReturnSeries(
        closes,
        (options.dividendEvents ?? []).filter(
          (event) => event.ticker === asset.id,
        ),
      ),
    };
  }

  return {
    provider: "Yahoo Finance Adjusted Chart",
    points: await fetchYahooAdjustedSeries(asset.yahooSymbol, start, end),
  };
}

async function fetchKrxMarketDay(
  dataset: "stock" | "etf",
  date: string,
  apiKey: string,
): Promise<Map<string, number>> {
  return cached(`krx:${dataset}:${date}`, async () => {
    const path =
      dataset === "stock"
        ? "https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd"
        : "https://data-dbg.krx.co.kr/svc/apis/etp/etf_bydd_trd";
    const endpoint = new URL(path);
    endpoint.searchParams.set("basDd", compactDate(date));
    let lastError = "";

    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt > 0) await wait(attempt * 1_200);

      let response: Response;
      try {
        response = await fetch(endpoint, {
          headers: {
            AUTH_KEY: apiKey,
            Accept: "application/json",
            "User-Agent":
              "FIDI-Portfolio/4.1 (+https://fidi-portfolio-v4-2026.gwg03045.chatgpt.site)",
          },
          signal: AbortSignal.timeout(75_000),
        });
      } catch (error) {
        lastError = `HTTPS 연결 실패: ${
          error instanceof Error ? error.message : "unknown"
        }`;
        continue;
      }

      const payload = (await response.json().catch(() => ({}))) as {
        respCode?: string;
        respMsg?: string;
        OutBlock_1?: Array<{
          BAS_DD?: string;
          ISU_CD?: string;
          ISU_SRT_CD?: string;
          TDD_CLSPRC?: string | number;
        }>;
      };
      if (response.status === 401 || payload.respCode === "401") {
        throw new Error(
          `KRX ${dataset === "stock" ? "유가증권 일별매매정보" : "ETF 일별매매정보"} 서비스 활용 승인이 필요합니다.`,
        );
      }
      if (response.ok) {
        return parseKrxClosingPrices(payload.OutBlock_1 ?? []);
      }

      lastError = `${response.status}: ${payload.respMsg ?? "unknown"}`;
      if (response.status < 500 && response.status !== 429) break;
    }

    throw new Error(`KRX Open API 응답 오류 (${dataset}, ${lastError})`);
  });
}

export async function fetchKrxOfficialAudit(
  assets: BacktestAsset[],
  seriesByTicker: Map<string, PricePoint[]>,
  end: string,
  apiKey?: string,
): Promise<KrxAudit> {
  if (!apiKey) {
    throw new Error("KRX_AUTH_KEY가 연결되지 않았습니다.");
  }
  const koreanAssets = assets.filter(
    (asset) => asset.market === "KRX" && asset.krxDataset,
  );
  const datasets = [
    ...new Set(koreanAssets.map((asset) => asset.krxDataset!)),
  ];

  for (let offset = 0; offset < 10; offset += 1) {
    const date = shiftIsoDate(end, -offset);
    if (!isWeekday(date)) continue;

    const results = await Promise.all(
      datasets.map(async (dataset) => ({
        dataset,
        prices: await fetchKrxMarketDay(dataset, date, apiKey),
      })),
    );
    if (results.every((result) => result.prices.size === 0)) continue;

    const pricesByDataset = new Map(
      results.map((result) => [result.dataset, result.prices]),
    );
    const comparisons = koreanAssets.map((asset) => {
      const official = pricesByDataset
        .get(asset.krxDataset!)
        ?.get(asset.id);
      const calculated = seriesByTicker
        .get(asset.id)
        ?.find((point) => point.date === date)?.value;
      if (!official || !calculated) {
        throw new Error(
          `KRX 공식 종가 대조값이 없습니다 (${asset.id}, ${date}).`,
        );
      }
      return {
        ticker: asset.id,
        difference: Math.abs(calculated / official - 1),
      };
    });
    const maximumDifference = Math.max(
      ...comparisons.map((comparison) => comparison.difference),
    );
    const mismatches = comparisons.filter(
      (comparison) => comparison.difference > 0.005,
    );
    if (mismatches.length > 0) {
      throw new Error(
        `KRX 공식 종가와 수정주가의 최근값이 일치하지 않습니다 (${mismatches
          .map((item) => item.ticker)
          .join(", ")}).`,
      );
    }

    return {
      source: "한국거래소 KRX Open API",
      date,
      matched: comparisons.length,
      total: comparisons.length,
      maximumDifferencePercent: maximumDifference * 100,
    };
  }

  throw new Error(
    `KRX Open API에서 ${isoDateFromCompact(compactDate(end))} 이전의 대조 가능한 영업일을 찾지 못했습니다.`,
  );
}

export async function fetchFredUsdKrwSeries(
  start: string,
  end: string,
  apiKey?: string,
): Promise<PricePoint[]> {
  if (!apiKey) {
    throw new Error("FRED_KEY가 연결되지 않았습니다.");
  }
  return cached(`fred:DEXKOUS:${start}:${end}`, async () => {
    const endpoint = new URL(
      "https://api.stlouisfed.org/fred/series/observations",
    );
    endpoint.searchParams.set("series_id", "DEXKOUS");
    endpoint.searchParams.set("api_key", apiKey);
    endpoint.searchParams.set("file_type", "json");
    endpoint.searchParams.set("observation_start", start);
    endpoint.searchParams.set("observation_end", end);
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`FRED 원/달러 환율 조회 실패 (${response.status})`);
    }
    const payload = (await response.json()) as {
      observations?: Array<{ date?: string; value?: string }>;
    };
    const points = (payload.observations ?? []).flatMap((row) => {
      const value = safeNumber(row.value);
      return row.date && value && value > 0
        ? [{ date: row.date, value }]
        : [];
    });
    if (points.length < 2) {
      throw new Error("FRED DEXKOUS 원/달러 환율 관측치가 부족합니다.");
    }
    return points;
  });
}

export function convertUsdSeriesToKrw(
  prices: PricePoint[],
  fxRates: PricePoint[],
): PricePoint[] {
  const rates = new Map(fxRates.map((point) => [point.date, point.value]));
  const sortedFxDates = fxRates.map((point) => point.date).sort();
  let fxIndex = 0;
  let latestRate: number | undefined;

  return prices.flatMap((point) => {
    while (
      fxIndex < sortedFxDates.length &&
      sortedFxDates[fxIndex] <= point.date
    ) {
      latestRate = rates.get(sortedFxDates[fxIndex]);
      fxIndex += 1;
    }
    return latestRate
      ? [{ date: point.date, value: point.value * latestRate }]
      : [];
  });
}

export async function fetchFredThreeMonthRate(
  start: string,
  end: string,
  apiKey?: string,
) {
  if (!apiKey) return null;
  return cached(`fred:DGS3MO:${start}:${end}`, async () => {
    const endpoint = new URL(
      "https://api.stlouisfed.org/fred/series/observations",
    );
    endpoint.searchParams.set("series_id", "DGS3MO");
    endpoint.searchParams.set("api_key", apiKey);
    endpoint.searchParams.set("file_type", "json");
    endpoint.searchParams.set("observation_start", start);
    endpoint.searchParams.set("observation_end", end);
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("FRED 금리 조회에 실패했습니다.");
    const payload = (await response.json()) as {
      observations?: Array<{ date?: string; value?: string }>;
    };
    const values = (payload.observations ?? [])
      .map((row) => safeNumber(row.value))
      .filter((value): value is number => value !== null);
    return values.length
      ? {
          series: "DGS3MO",
          name: "3-Month Treasury Bill Secondary Market Rate",
          averagePercent:
            values.reduce((sum, value) => sum + value, 0) / values.length,
          observations: values.length,
        }
      : null;
  });
}

export async function fetchEcosCdRate(
  start: string,
  end: string,
  apiKey?: string,
) {
  if (!apiKey) return null;
  return cached(`ecos:817Y002:010502000:${start}:${end}`, async () => {
    const endpoint = [
      "https://ecos.bok.or.kr/api/StatisticSearch",
      apiKey,
      "json",
      "kr",
      "1",
      "100000",
      "817Y002",
      "D",
      compactDate(start),
      compactDate(end),
      "010502000",
    ].join("/");
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("ECOS 금리 조회에 실패했습니다.");
    const payload = (await response.json()) as {
      StatisticSearch?: {
        row?: Array<{ TIME?: string; DATA_VALUE?: string; ITEM_NAME1?: string }>;
      };
    };
    const rows = payload.StatisticSearch?.row ?? [];
    const values = rows
      .map((row) => safeNumber(row.DATA_VALUE))
      .filter((value): value is number => value !== null);
    return values.length
      ? {
          series: "817Y002/010502000",
          name: rows[0]?.ITEM_NAME1 ?? "CD(91일)",
          averagePercent:
            values.reduce((sum, value) => sum + value, 0) / values.length,
          observations: values.length,
        }
      : null;
  });
}
