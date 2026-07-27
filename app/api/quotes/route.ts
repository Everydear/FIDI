import { NextResponse } from "next/server";

import {
  getBacktestAssets,
  isBacktestProfileCode,
} from "@/lib/backtest/portfolio";
import {
  fetchMassiveLatestQuote,
  fetchYahooLatestQuote,
} from "@/lib/backtest/providers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const profile = url.searchParams.get("profile");
  if (!isBacktestProfileCode(profile)) {
    return NextResponse.json(
      { status: "invalid_request", message: "지원하지 않는 투자자 유형입니다." },
      { status: 400 },
    );
  }

  const massiveApiKey = process.env.MASSIVE_API_KEY?.trim();
  const assets = getBacktestAssets(profile);
  const results = await Promise.all(
    assets.map(async (asset) => {
      try {
        if (asset.market === "US" && !massiveApiKey) {
          throw new Error("MASSIVE_API_KEY가 연결되지 않았습니다.");
        }
        const quote =
          asset.market === "US"
            ? await fetchMassiveLatestQuote(asset.id, massiveApiKey!)
            : await fetchYahooLatestQuote(asset.yahooSymbol);
        return {
          ticker: asset.id,
          name: asset.name,
          market: asset.market,
          currency: asset.currency,
          ...quote,
        };
      } catch (error) {
        return {
          ticker: asset.id,
          name: asset.name,
          market: asset.market,
          currency: asset.currency,
          error:
            error instanceof Error ? error.message : "최신 가격을 확인하지 못했습니다.",
        };
      }
    }),
  );

  const quotes = results.filter((result) => !result.error);
  const errors = results.filter((result) => result.error);
  const asOf = quotes.length
    ? [...quotes].sort((left, right) => right.asOf.localeCompare(left.asOf))[0].asOf
    : null;

  return NextResponse.json({
    status:
      quotes.length === results.length
        ? "connected"
        : quotes.length > 0
          ? "partial"
          : "unavailable",
    generatedAt: new Date().toISOString(),
    profile,
    summary: {
      total: results.length,
      connected: quotes.length,
      unavailable: errors.length,
      asOf,
    },
    quotes,
    errors: errors.map(({ ticker, name, market, error }) => ({
      ticker,
      name,
      market,
      error,
    })),
    notice:
      "현재 표시값은 각 시장에서 확인 가능한 최신 일봉입니다. 미국 실시간 호가는 Massive 요금제 권한에 따라 제공 범위가 달라집니다.",
  });
}
