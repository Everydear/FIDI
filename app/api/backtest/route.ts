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
  fetchFredUsdKrwSeries,
  fetchKrxOfficialAudit,
  fetchMassiveDividendEvents,
} from "@/lib/backtest/providers";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

function isIsoDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function todayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function freeHistoryStart(end: string) {
  const date = new Date(`${end}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() - 2);
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
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

  const end = isIsoDate(url.searchParams.get("end"))
    ? url.searchParams.get("end")!
    : todayInSeoul();
  const minimumStart = freeHistoryStart(end);
  const requestedStart = isIsoDate(url.searchParams.get("start"))
    ? url.searchParams.get("start")!
    : minimumStart;
  const start = requestedStart < minimumStart ? minimumStart : requestedStart;
  if (start >= end) {
    return NextResponse.json(
      { status: "invalid_request", message: "시작일은 종료일보다 빨라야 합니다." },
      { status: 400 },
    );
  }

  const massiveApiKey = process.env.MASSIVE_API_KEY?.trim();
  const krxAuthKey = process.env.KRX_AUTH_KEY?.trim();
  const fredKey = process.env.FRED_KEY?.trim();
  const assets = getBacktestAssets(profileValue);
  const usTickers = [
    ...new Set(
      assets.filter((asset) => asset.market === "US").map((asset) => asset.id),
    ),
  ];

  if (!massiveApiKey || !krxAuthKey || !fredKey) {
    const missing = [
      !massiveApiKey && "MASSIVE_API_KEY",
      !krxAuthKey && "KRX_AUTH_KEY",
      !fredKey && "FRED_KEY",
    ].filter(Boolean);
    return NextResponse.json(
      {
        status: "data_access_required",
        message: `실데이터 검증에 필요한 서버 키가 없습니다: ${missing.join(", ")}`,
        setup: "서버 비밀환경변수를 연결한 뒤 다시 실행해 주세요.",
      },
      { status: 503 },
    );
  }

  try {
    const [ecosRateResult, fredRateResult, fxRates, dividendEvents] =
      await Promise.all([
        fetchEcosCdRate(start, end, process.env.ECOS_KEY?.trim()),
        fetchFredThreeMonthRate(start, end, fredKey),
        fetchFredUsdKrwSeries(start, end, fredKey),
        fetchMassiveDividendEvents(usTickers, start, end, massiveApiKey),
      ]);

    const pricedAssets = await Promise.all(
      assets.map(async (asset) => {
        const result = await fetchAssetSeries(asset, start, end, {
          massiveApiKey,
          dividendEvents,
        });
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

    const seriesByTicker = new Map(
      pricedAssets.map((asset) => [asset.id, asset.prices]),
    );
    const krxAudit = await fetchKrxOfficialAudit(
      assets,
      seriesByTicker,
      end,
      krxAuthKey,
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

    const benchmarkAsset = pricedAssets.find((asset) => asset.id === "360750");
    if (!benchmarkAsset) {
      throw new Error("벤치마크 TIGER 미국S&P500(360750) 가격이 없습니다.");
    }
    const benchmark = runBacktest({
      assets: [
        {
          id: benchmarkAsset.id,
          name: benchmarkAsset.name,
          weight: 1,
          prices: benchmarkAsset.prices.filter(
            (point) =>
              point.date >= result.period.start && point.date <= result.period.end,
          ),
        },
      ],
      cadence: "quarterly",
      transactionCostBps: 0,
      annualRiskFreeRate,
    });
    const providers = [
      ...new Set(pricedAssets.map((asset) => asset.provider)),
    ];
    const warnings = [
      "전체 포트폴리오의 원화 환산 순자산가치만 TIGER 미국S&P500(360750)과 같은 기간으로 비교합니다. 개별 종목이 각각 벤치마크를 이길 필요는 없습니다.",
      "현재 화면의 고정 편입 종목을 과거에도 보유했다고 가정한 검증입니다. 과거 시점의 종목 선정 규칙 자체를 검증한 결과는 아닙니다.",
      "미국 가격은 Massive SIP 종가와 배당·분할 자료로 총수익률을 재구성했습니다. 국내 전체 이력은 수정주가를 사용하고 최근 종가는 KRX Open API와 교차 대조했습니다.",
      "모든 종목의 실제 가격이 존재하는 공통 구간만 사용하며 상장 전 수익률을 대체지수로 채우지 않습니다.",
    ];
    if (requestedStart < minimumStart) {
      warnings.push(
        `Massive 무료 플랜의 최근 2년 제한 때문에 요청 시작일을 ${minimumStart}로 조정했습니다.`,
      );
    }
    if (result.period.years < 3) {
      warnings.push(
        "공통 운용기간이 3년 미만입니다. KODEX 머니마켓액티브(488770)의 짧은 상장 이력과 무료 데이터 범위 때문에 장기 성과 판단에는 표본이 부족합니다.",
      );
    }

    return NextResponse.json({
      status: "verified",
      generatedAt: new Date().toISOString(),
      profile: profileValue,
      baseCurrency: "KRW",
      validationScope: "current-holdings-fixed",
      providers: {
        prices: providers.join(" · "),
        usPrices: "Massive SIP EOD + Corporate Actions",
        koreanHistory: "Yahoo Finance 수정주가",
        koreanOfficialAudit: krxAudit,
        fx: {
          source: "FRED",
          series: "DEXKOUS",
          observations: fxRates.length,
        },
        koreanRiskFree: ecosRateResult
          ? { source: "한국은행 ECOS", ...ecosRateResult }
          : null,
        usReferenceRate: fredRateResult
          ? { source: "FRED", ...fredRateResult }
          : null,
      },
      assumptions: {
        adjustedClose: true,
        dividendsAndSplits: "미국은 Massive 이벤트로 재투자, 한국은 수정주가에 반영",
        fx: "FRED DEXKOUS 일별 원/달러 환율로 원화 환산",
        rebalance: getBacktestCadence(profileValue),
        transactionCostBps,
        initialPurchaseCost: "포트폴리오와 벤치마크 모두 제외",
        riskFreeRatePercent: annualRiskFreeRate * 100,
        missingMarketDays: "전일 가격 유지",
      },
      benchmark: {
        ticker: "360750",
        name: "TIGER 미국S&P500",
        metrics: benchmark.metrics,
        curve: benchmark.curve,
      },
      comparison: {
        beatBenchmark:
          result.metrics.endingValue > benchmark.metrics.endingValue,
        excessTotalReturn:
          result.metrics.totalReturn - benchmark.metrics.totalReturn,
        excessCagr: result.metrics.cagr - benchmark.metrics.cagr,
      },
      holdings: pricedAssets.map(({ id, name, weight, prices, provider }) => ({
        ticker: id,
        name,
        weight,
        provider,
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
    const krxApprovalNeeded =
      message.includes("KRX") &&
      (message.includes("승인") ||
        message.includes("401") ||
        message.includes("HTTPS"));
    return NextResponse.json(
      {
        status: krxApprovalNeeded ? "krx_access_pending" : "provider_error",
        message,
        setup: krxApprovalNeeded
          ? "KRX Data Marketplace에서 ‘유가증권 일별매매정보’와 ‘ETF 일별매매정보’를 각각 활용 신청·승인한 뒤 다시 실행해 주세요."
          : "공식 데이터 공급자의 상태와 무료 호출 한도를 확인해 주세요.",
      },
      { status: krxApprovalNeeded ? 503 : 502 },
    );
  }
}
