import { NextResponse } from "next/server";

import { runBacktest } from "@/lib/backtest/engine.mjs";
import {
  getBacktestAssets,
  getBacktestCadence,
  isBacktestProfileCode,
} from "@/lib/backtest/portfolio";
import {
  convertUsdSeriesToKrw,
  fetchAssetSeries,
  fetchEcosCdRate,
  fetchFredThreeMonthRate,
  fetchUsdKrwSeries,
} from "@/lib/backtest/providers";

export const dynamic = "force-dynamic";

function isIsoDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function defaultEndDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const profileValue = url.searchParams.get("profile");
  if (!isBacktestProfileCode(profileValue)) {
    return NextResponse.json(
      { status: "invalid_request", message: "지원하지 않는 투자자 유형입니다." },
      { status: 400 },
    );
  }

  const start = isIsoDate(url.searchParams.get("start"))
    ? url.searchParams.get("start")!
    : "2021-01-01";
  const end = isIsoDate(url.searchParams.get("end"))
    ? url.searchParams.get("end")!
    : defaultEndDate();
  if (start >= end) {
    return NextResponse.json(
      { status: "invalid_request", message: "시작일은 종료일보다 빨라야 합니다." },
      { status: 400 },
    );
  }

  const eodhdToken = process.env.EODHD_API_TOKEN?.trim() || undefined;
  const assets = getBacktestAssets(profileValue);

  try {
    const [ecosRateResult, fredRateResult, fxRates] = await Promise.all([
      fetchEcosCdRate(start, end, process.env.ECOS_KEY?.trim()),
      fetchFredThreeMonthRate(start, end, process.env.FRED_KEY?.trim()),
      assets.some((asset) => asset.currency === "USD")
        ? fetchUsdKrwSeries(start, end, eodhdToken)
        : Promise.resolve([]),
    ]);

    const pricedAssets = await Promise.all(
      assets.map(async (asset) => {
        const result = await fetchAssetSeries(asset, start, end, eodhdToken);
        return {
          id: asset.id,
          name: asset.name,
          weight: asset.weight,
          prices:
            asset.currency === "USD"
              ? convertUsdSeriesToKrw(result.points, fxRates)
              : result.points,
          provider: result.provider,
        };
      }),
    );

    const annualRiskFreeRate =
      (ecosRateResult?.averagePercent ??
        fredRateResult?.averagePercent ??
        0) / 100;
    const transactionCostBps = profileValue === "CONTEST" ? 25 : 15;
    const result = runBacktest({
      assets: pricedAssets,
      cadence: getBacktestCadence(profileValue),
      transactionCostBps,
      annualRiskFreeRate,
    });
    const priceProvider = pricedAssets[0]?.provider ?? "unknown";
    const warnings = [
      "현재 화면의 고정 편입 종목을 과거에도 보유했다고 가정한 검증입니다. 과거 시점의 종목 선정 규칙 자체를 검증한 결과는 아닙니다.",
      "모든 종목의 실제 가격이 존재하는 공통 구간만 사용하며 상장 전 수익률을 대체지수로 채우지 않습니다.",
      priceProvider === "Yahoo Finance Chart"
        ? "가격은 Yahoo Finance의 공개 차트 응답을 이용한 검증용 경로입니다. 운영·감사 목적에는 계약형 데이터 제공자(EODHD 등)로 교체해야 합니다."
        : "가격은 EODHD 수정주가를 사용했습니다.",
    ];
    if (result.period.years < 3) {
      warnings.push(
        "공통 운용기간이 3년 미만입니다. KODEX 머니마켓액티브(488770)의 짧은 상장 이력 때문에 장기 성과 판단에는 표본이 부족합니다.",
      );
    }

    return NextResponse.json({
      status: "verified",
      generatedAt: new Date().toISOString(),
      profile: profileValue,
      baseCurrency: "KRW",
      validationScope: "current-holdings-fixed",
      providers: {
        prices: priceProvider,
        koreanRiskFree: ecosRateResult
          ? { source: "한국은행 ECOS", ...ecosRateResult }
          : null,
        usReferenceRate: fredRateResult
          ? { source: "FRED", ...fredRateResult }
          : null,
      },
      assumptions: {
        adjustedClose: true,
        dividendsAndSplits: "수정주가에 반영",
        fx: "미국 개별주는 일별 USD/KRW로 원화 환산",
        rebalance: getBacktestCadence(profileValue),
        transactionCostBps,
        initialPurchaseCost: "제외",
        riskFreeRatePercent: annualRiskFreeRate * 100,
        missingMarketDays: "전일 가격 유지",
      },
      holdings: pricedAssets.map(({ id, name, weight, prices }) => ({
        ticker: id,
        name,
        weight,
        firstPriceDate: prices[0]?.date,
        lastPriceDate: prices.at(-1)?.date,
        observations: prices.length,
      })),
      warnings,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 백테스트 오류";
    return NextResponse.json(
      {
        status: "provider_error",
        message,
        setup: eodhdToken
          ? "EODHD 토큰과 종목별 데이터 권한을 확인해 주세요."
          : "공개 가격 경로가 일시적으로 차단될 수 있습니다. EODHD_API_TOKEN을 연결하면 계약형 가격 경로를 사용합니다.",
      },
      { status: 502 },
    );
  }
}

