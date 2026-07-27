import type { BacktestAsset } from "./portfolio";

export type PricePoint = { date: string; value: number };
export type PriceProvider = "EODHD" | "Yahoo Finance Chart";

type CacheEntry<T> = { expiresAt: number; value: T };

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const memoryCache = new Map<string, CacheEntry<unknown>>();

async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const current = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (current && current.expiresAt > Date.now()) return current.value;
  const value = await loader();
  memoryCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}

function compactDate(date: string) {
  return date.replaceAll("-", "");
}

function safeNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function utcDateFromUnix(timestamp: number) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

async function fetchYahooSeries(
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
      headers: { "User-Agent": "FIDI-Backtest/1.0" },
    });
    if (!response.ok) {
      throw new Error(`가격 제공자 응답 오류 (${symbol}, ${response.status})`);
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
      throw new Error(
        `가격 이력을 찾을 수 없습니다 (${symbol})`,
      );
    }

    const timestamps = result.timestamp ?? [];
    const adjusted =
      result.indicators?.adjclose?.[0]?.adjclose ??
      result.indicators?.quote?.[0]?.close ??
      [];
    const points = timestamps.flatMap((timestamp, index) => {
      const value = safeNumber(adjusted[index]);
      return value && value > 0
        ? [{ date: utcDateFromUnix(timestamp), value }]
        : [];
    });
    if (points.length < 2) {
      throw new Error(`유효한 수정주가가 부족합니다 (${symbol})`);
    }
    return points;
  });
}

async function fetchEodhdSeries(
  symbol: string,
  start: string,
  end: string,
  token: string,
): Promise<PricePoint[]> {
  return cached(`eodhd:${symbol}:${start}:${end}`, async () => {
    const endpoint = new URL(
      `https://eodhd.com/api/eod/${encodeURIComponent(symbol)}`,
    );
    endpoint.searchParams.set("api_token", token);
    endpoint.searchParams.set("fmt", "json");
    endpoint.searchParams.set("from", start);
    endpoint.searchParams.set("to", end);
    endpoint.searchParams.set("period", "d");
    endpoint.searchParams.set("order", "a");

    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`EODHD 응답 오류 (${symbol}, ${response.status})`);
    }
    const payload = (await response.json()) as Array<{
      date?: string;
      adjusted_close?: number | string;
      close?: number | string;
    }>;
    const points = Array.isArray(payload)
      ? payload.flatMap((row) => {
          const value = safeNumber(row.adjusted_close ?? row.close);
          return row.date && value && value > 0
            ? [{ date: row.date, value }]
            : [];
        })
      : [];
    if (points.length < 2) {
      throw new Error(`EODHD 수정주가가 부족합니다 (${symbol})`);
    }
    return points;
  });
}

export async function fetchAssetSeries(
  asset: BacktestAsset,
  start: string,
  end: string,
  eodhdToken?: string,
): Promise<{ provider: PriceProvider; points: PricePoint[] }> {
  if (eodhdToken) {
    return {
      provider: "EODHD",
      points: await fetchEodhdSeries(asset.eodhdSymbol, start, end, eodhdToken),
    };
  }
  return {
    provider: "Yahoo Finance Chart",
    points: await fetchYahooSeries(asset.yahooSymbol, start, end),
  };
}

export async function fetchUsdKrwSeries(
  start: string,
  end: string,
  eodhdToken?: string,
): Promise<PricePoint[]> {
  return eodhdToken
    ? fetchEodhdSeries("USDKRW.FOREX", start, end, eodhdToken)
    : fetchYahooSeries("KRW=X", start, end);
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
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error("FRED 금리 조회에 실패했습니다");
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
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error("ECOS 금리 조회에 실패했습니다");
    const payload = (await response.json()) as {
      StatisticSearch?: {
        row?: Array<{ TIME?: string; DATA_VALUE?: string; ITEM_NAME1?: string }>;
      };
      RESULT?: { MESSAGE?: string };
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

