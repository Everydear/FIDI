import { NextResponse } from "next/server";

import { runBacktest } from "@/lib/backtest/engine.mjs";
import {
  getBacktestAssets,
  getBacktestCadence,
  getDailyCandidateGroups,
  getLockedCadence,
  getLockedProfileWeights,
  getProfileWeights,
  isBacktestProfileCode,
  type BacktestAsset,
  type RebalanceCadence,
  type Sleeve,
} from "@/lib/backtest/portfolio";
import {
  convertUsdSeriesToKrw,
  fetchAssetSeries,
  fetchEcosCdRate,
  fetchFredThreeMonthRate,
  fetchFredUsdKrwSeries,
  fetchKrxOfficialAudit,
  fetchMassiveDividendEvents,
  type PricePoint,
  type PriceProvider,
} from "@/lib/backtest/providers";
import { buildDailyGuide } from "@/lib/backtest/daily-guide.mjs";
import { buildValidationGuide } from "@/lib/backtest/validation.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

type PricedAsset = {
  id: string;
  name: string;
  sleeve: Sleeve;
  weight: number;
  prices: PricePoint[];
  provider: PriceProvider;
};

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

function createPolicyBenchmarkAssets(pricedAssets: PricedAsset[]) {
  const market = pricedAssets.find((asset) => asset.sleeve === "market");
  if (!market) {
    throw new Error("동일위험 정책 기준선에 필요한 시장 ETF 가격이 없습니다.");
  }

  const equityWeight = pricedAssets
    .filter((asset) =>
      ["market", "strategy", "stocks"].includes(asset.sleeve),
    )
    .reduce((sum, asset) => sum + asset.weight, 0);
  const benchmarkAssets = [
    {
      id: "POLICY-EQUITY-360750",
      name: "주식 위험예산 · TIGER 미국S&P500",
      weight: equityWeight,
      prices: market.prices,
    },
  ];

  for (const sleeve of [
    "government",
    "credit",
    "alternative",
    "cash",
  ] as const) {
    const asset = pricedAssets.find((candidate) => candidate.sleeve === sleeve);
    if (asset && asset.weight > 0) {
      benchmarkAssets.push({
        id: `POLICY-${asset.id}`,
        name: asset.name,
        weight: asset.weight,
        prices: asset.prices,
      });
    }
  }
  return benchmarkAssets;
}

function pricesFrom(
  assets: PricedAsset[],
  startDate: string,
): PricedAsset[] {
  return assets.map((asset) => ({
    ...asset,
    prices: asset.prices.filter((point) => point.date >= startDate),
  }));
}

function alternateCadence(cadence: RebalanceCadence): RebalanceCadence {
  if (cadence === "quarterly") return "monthly";
  if (cadence === "monthly") return "quarterly";
  return "monthly";
}

function publicResult<T extends { fullCurve: unknown }>(result: T) {
  const { fullCurve: _fullCurve, ...value } = result;
  void _fullCurve;
  return value;
}

function uniqueAssets(assets: BacktestAsset[]) {
  const byTicker = new Map<string, BacktestAsset>();
  for (const asset of assets) {
    if (!byTicker.has(asset.id)) byTicker.set(asset.id, asset);
  }
  return [...byTicker.values()];
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
  const candidateGroups = getDailyCandidateGroups(profileValue);
  const candidateAssets = candidateGroups.flatMap((group) =>
    group.candidates.map((candidate) => candidate.asset),
  );
  const universeAssets = uniqueAssets([...assets, ...candidateAssets]);
  const usTickers = [
    ...new Set(
      universeAssets
        .filter((asset) => asset.market === "US")
        .map((asset) => asset.id),
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

    const pricedUniverse = await Promise.all(
      universeAssets.map(async (asset) => {
        const result = await fetchAssetSeries(asset, start, end, {
          massiveApiKey,
          dividendEvents,
        });
        return {
          id: asset.id,
          name: asset.name,
          sleeve: asset.sleeve,
          weight: asset.weight,
          prices:
            asset.currency === "USD"
              ? convertUsdSeriesToKrw(result.points, fxRates)
              : result.points,
          provider: result.provider,
        };
      }),
    );
    const pricedByTicker = new Map(
      pricedUniverse.map((asset) => [asset.id, asset]),
    );
    const pricedAssets = assets.map((asset) => {
      const priced = pricedByTicker.get(asset.id);
      if (!priced) throw new Error(`${asset.id} 가격을 찾을 수 없습니다.`);
      return {
        ...priced,
        sleeve: asset.sleeve,
        weight: asset.weight,
      };
    });

    const seriesByTicker = new Map(
      pricedUniverse.map((asset) => [asset.id, asset.prices]),
    );
    const krxAudit = await fetchKrxOfficialAudit(
      universeAssets,
      seriesByTicker,
      end,
      krxAuthKey,
    );

    const annualRiskFreeRate =
      (ecosRateResult?.averagePercent ??
        fredRateResult?.averagePercent ??
        0) / 100;
    const cadence = getBacktestCadence(profileValue);
    const lockedCadence = getLockedCadence(profileValue);
    const transactionCostBps = profileValue === "CONTEST" ? 30 : 20;
    const dailyGuide = buildDailyGuide({
      profile: profileValue,
      transactionCostBps,
      groups: candidateGroups.map((group) => ({
        id: group.id,
        name: group.name,
        candidates: group.candidates.map((candidate) => {
          const priced = pricedByTicker.get(candidate.asset.id);
          if (!priced) {
            throw new Error(`${candidate.asset.id} 후보 가격을 찾을 수 없습니다.`);
          }
          return {
            ticker: candidate.asset.id,
            name: candidate.asset.name,
            current: candidate.current,
            prices: priced.prices,
          };
        }),
      })),
    });
    const result = runBacktest({
      assets: pricedAssets,
      cadence,
      transactionCostBps,
      annualRiskFreeRate,
    });

    const policyBenchmarkAssets = createPolicyBenchmarkAssets(pricedAssets);
    const benchmark = runBacktest({
      assets: policyBenchmarkAssets,
      cadence,
      transactionCostBps,
      annualRiskFreeRate,
    });
    const marketAsset = pricedAssets.find((asset) => asset.id === "360750");
    if (!marketAsset) {
      throw new Error("시장 참고지수 TIGER 미국S&P500(360750) 가격이 없습니다.");
    }
    const marketReference = runBacktest({
      assets: [
        {
          id: marketAsset.id,
          name: marketAsset.name,
          weight: 1,
          prices: marketAsset.prices.filter(
            (point) =>
              point.date >= result.period.start && point.date <= result.period.end,
          ),
        },
      ],
      cadence: "quarterly",
      transactionCostBps: 0,
      annualRiskFreeRate,
    });

    const costStress = runBacktest({
      assets: pricedAssets,
      cadence,
      transactionCostBps: transactionCostBps * 3,
      annualRiskFreeRate,
    });
    const costStressPolicyBenchmark = runBacktest({
      assets: policyBenchmarkAssets,
      cadence,
      transactionCostBps: transactionCostBps * 3,
      annualRiskFreeRate,
    });
    const delayedStartDate =
      result.fullCurve[Math.min(21, result.fullCurve.length - 2)].date;
    const delayedAssets = pricesFrom(pricedAssets, delayedStartDate);
    const delayedResult = runBacktest({
      assets: delayedAssets,
      cadence,
      transactionCostBps,
      annualRiskFreeRate,
    });
    const delayedPolicyBenchmark = runBacktest({
      assets: createPolicyBenchmarkAssets(delayedAssets),
      cadence,
      transactionCostBps,
      annualRiskFreeRate,
    });
    const sensitivityCadence = alternateCadence(cadence);
    const cadenceSensitivity = runBacktest({
      assets: pricedAssets,
      cadence: sensitivityCadence,
      transactionCostBps,
      annualRiskFreeRate,
    });
    const cadencePolicyBenchmark = runBacktest({
      assets: policyBenchmarkAssets,
      cadence: sensitivityCadence,
      transactionCostBps,
      annualRiskFreeRate,
    });
    const guidance = buildValidationGuide({
      profile: profileValue,
      result,
      policyBenchmark: benchmark,
      costStress: {
        result: costStress,
        policyBenchmark: costStressPolicyBenchmark,
      },
      delayedStart: {
        result: delayedResult,
        policyBenchmark: delayedPolicyBenchmark,
      },
      alternateCadence: {
        cadence: sensitivityCadence,
        result: cadenceSensitivity,
        policyBenchmark: cadencePolicyBenchmark,
      },
      currentWeights: getProfileWeights(profileValue),
      lockedWeights: getLockedProfileWeights(profileValue),
      currentCadence: cadence,
      lockedCadence,
      krxAudit,
      assetWeights: pricedAssets.map((asset) => asset.weight),
    });
    const providers = [
      ...new Set(pricedUniverse.map((asset) => asset.provider)),
    ];
    const warnings = [
      "공식 채택 판단은 같은 주식·채권·금·현금 위험예산을 가진 정책 기준선과 비교합니다. TIGER 미국S&P500(360750) 100% 보유는 시장 참고치일 뿐 채택 벤치마크가 아닙니다.",
      "현재 화면의 고정 편입 종목을 과거에도 보유했다고 가정한 검증입니다. 과거 시점의 종목 선정 규칙 자체를 검증한 결과는 아닙니다.",
      "미국 가격은 Massive SIP 종가와 배당·분할 자료로 총수익률을 재구성했습니다. 국내 전체 이력은 수정주가를 사용하고 최근 종가는 KRX Open API와 교차 대조했습니다.",
      "모든 종목의 실제 가격이 존재하는 공통 구간만 사용하며 상장 전 수익률을 대체지수로 채우지 않습니다.",
      "일일 가이드는 자동 주문이 아닙니다. 교체 비교 신호가 나오면 예상 비용·세금·환전·거래 가능 여부를 확인하고 사용자가 최종 결정합니다.",
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
        rebalance: cadence,
        lockedRebalance: lockedCadence,
        dailyEvaluation: true,
        orderMode: "manual-approval",
        transactionCostBps,
        initialPurchaseCost: "포트폴리오와 벤치마크 모두 제외",
        riskFreeRatePercent: annualRiskFreeRate * 100,
        missingMarketDays: "전일 가격 유지",
      },
      benchmark: {
        ticker: "POLICY",
        name: "동일위험 정책 기준선",
        definition:
          "현재 주식 위험예산은 TIGER 미국S&P500으로, 채권·금·현금 위험예산은 동일 상품과 동일 비중으로 구성",
        ...publicResult(benchmark),
      },
      marketReference: {
        ticker: "360750",
        name: "TIGER 미국S&P500",
        role: "시장 참고치 · 공식 채택 벤치마크 아님",
        ...publicResult(marketReference),
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
      dailyGuide,
      guidance,
      warnings,
      ...publicResult(result),
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
