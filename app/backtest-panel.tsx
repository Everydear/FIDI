"use client";

import { useMemo, useState } from "react";

type RateSource = {
  source: string;
  series: string;
  name: string;
  averagePercent: number;
  observations: number;
};

type BacktestMetrics = {
  totalReturn: number;
  cagr: number;
  annualVolatility: number;
  maximumDrawdown: number;
  sharpe: number | null;
  winningMonths: number;
  endingValue: number;
  totalTurnover: number;
  annualizedTurnover: number;
  cumulativeCost: number;
  cumulativeTransactionCost?: number;
  cumulativeSlippageCost?: number;
  cumulativeTaxCost?: number;
  executionCostBps?: number;
  rebalanceBand?: number;
  skippedRebalances?: number;
  rebalances: number;
};

type CurvePoint = { date: string; value: number; drawdown: number };

type GuidanceStatus =
  | "CHECKED"
  | "REVIEW"
  | "IN_PROGRESS"
  | "LIMITED_DATA"
  | "ACTION";

type GuidanceCheck = {
  id: string;
  label: string;
  status: GuidanceStatus;
  detail: string;
  guide: string;
};

type DailyCandidate = {
  ticker: string;
  name: string;
  current: boolean;
  latestDate: string;
  latestValue: number;
  return20: number;
  return60: number;
  volatility20: number;
  drawdown60: number;
  aboveMovingAverage20: boolean;
  score: number;
  rank: number;
};

type DailyGuideGroup = {
  id: string;
  name: string;
  action: "MAINTAIN" | "REVIEW_CHANGE";
  actionLabel: string;
  leaderTicker: string;
  leaderName: string;
  currentTicker: string;
  currentName: string;
  scoreAdvantage: number;
  reason: string;
  candidates: DailyCandidate[];
};

type BacktestSuccess = {
  status: "verified";
  generatedAt: string;
  profile: string;
  baseCurrency: "KRW";
  validationScope: "current-holdings-fixed";
  providers: {
    prices: string;
    usPrices: string;
    koreanHistory: string;
    koreanOfficialAudit: {
      source: string;
      date: string;
      matched: number;
      total: number;
      maximumDifferencePercent: number;
    };
    fx: {
      source: string;
      series: string;
      observations: number;
      latestDate: string | null;
      latestRate: number | null;
    };
    koreanRiskFree: RateSource | null;
    usReferenceRate: RateSource | null;
  };
  assumptions: {
    rebalance: "weekly" | "monthly" | "quarterly";
    lockedRebalance: "weekly" | "monthly" | "quarterly";
    dailyEvaluation: boolean;
    transactionCostBps: number;
    slippageBps?: number;
    taxBps?: number;
    executionCostBps?: number;
    rebalanceBand?: number;
    riskFreeRatePercent: number;
    adjustedClose: boolean;
    dividendsAndSplits: string;
    fx: string;
    initialPurchaseCost: string;
    missingMarketDays: string;
  };
  holdings: Array<{
    ticker: string;
    name: string;
    weight: number;
    provider: string;
    firstPriceDate: string;
    lastPriceDate: string;
    observations: number;
  }>;
  warnings: string[];
  period: {
    start: string;
    end: string;
    calendarDays: number;
    years: number;
    observations: number;
  };
  metrics: BacktestMetrics;
  curve: CurvePoint[];
  benchmark: {
    ticker: string;
    name: string;
    definition: string;
    metrics: BacktestMetrics;
    curve: CurvePoint[];
  };
  marketReference: {
    ticker: string;
    name: string;
    role: string;
    metrics: BacktestMetrics;
    curve: CurvePoint[];
  };
  comparison: {
    beatBenchmark: boolean;
    excessTotalReturn: number;
    excessCagr: number;
  };
  dailyGuide: {
    version: string;
    asOf: string;
    profile: string;
    evaluationCadence: "daily";
    switchThreshold: number;
    transactionCostBps: number;
    slippageBps?: number;
    taxBps?: number;
    executionCostBps?: number;
    rebalanceBand?: number;
    headline: string;
    summary: {
      groups: number;
      maintain: number;
      reviewChange: number;
    };
    executionGuide: string[];
    dataNotice: string;
    groups: DailyGuideGroup[];
  };
  guidance: {
    mode: "GUIDANCE";
    headline: string;
    checkedAt: string;
    summary: {
      checked: number;
      review: number;
      inProgress: number;
      limitedData: number;
      action: number;
      total: number;
    };
    statistics: {
      activeReturnMean?: number;
      activeHitRate?: number | null;
      worstDailyActiveReturn?: number | null;
      informationRatio: number | null;
      rollingBeatRate: number | null;
      worstRollingExcess: number | null;
      costStressExcessCagr: number;
      delayedStartExcessCagr: number;
      alternateCadenceExcessCagr: number;
      maximumDrawdownGap: number;
      walkForward?: {
        status: string;
        alignedObservations: number;
        folds: Array<unknown>;
        beatRate: number | null;
        meanExcessCagr: number | null;
        worstExcessCagr: number | null;
      };
      dataQuality?: {
        commonObservations: number;
        totalMissingObservations: number;
        maximumForwardFillObservations: number;
        minimumCoverageRatio: number;
      };
      riskLimits?: {
        maxSingleAssetWeight: number;
        maxSingleAssetWeightLimit: number;
        equityWeight: number;
        maxEquityWeight: number;
        maximumDrawdown: number;
        maxDrawdown: number;
        annualizedTurnover: number;
        maxAnnualizedTurnover: number;
        rebalanceBand: number;
      };
      concentration: {
        maximumWeight: number;
        herfindahlIndex: number;
      };
    };
    decision: {
      grade: "ROBUST" | "MIXED" | "LIMITED_DATA";
      label: string;
      criticalChecks: number;
      passedChecks: number;
      reviewIds: string[];
      detail: string;
    };
    evidence: {
      researchUnitTests: number;
      v3CombinedRows: number;
      v3ReferenceObservations: number;
      retrospectiveOutOfSample: boolean;
      forwardObservationStart: string;
      earliestFormalReview: string;
      walkForward?: {
        status: string;
        alignedObservations: number;
        folds: Array<unknown>;
        beatRate: number | null;
        meanExcessCagr: number | null;
        worstExcessCagr: number | null;
      };
    };
    checks: GuidanceCheck[];
  };
};

type BacktestFailure = {
  status: string;
  message: string;
  setup?: string;
};

type BacktestState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; data: BacktestSuccess }
  | { kind: "error"; data: BacktestFailure };

const percent = new Intl.NumberFormat("ko-KR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const number = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 2,
});

const cadenceLabel = {
  weekly: "주간",
  monthly: "월간",
  quarterly: "분기",
};

const guidanceStatusLabel: Record<GuidanceStatus, string> = {
  CHECKED: "확인",
  REVIEW: "검토",
  IN_PROGRESS: "진행",
  LIMITED_DATA: "데이터 한계",
  ACTION: "다음 단계",
};

function curvePolyline(
  curve: BacktestSuccess["curve"],
  minimum: number,
  maximum: number,
) {
  if (curve.length < 2) return "";
  const range = Math.max(maximum - minimum, 0.0001);
  return curve
    .map((point, index) => {
      const x = (index / (curve.length - 1)) * 760 + 20;
      const y = 200 - ((point.value - minimum) / range) * 160;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function BacktestPanel({
  profileCode,
  profileName,
}: {
  profileCode: string;
  profileName: string;
}) {
  const [state, setState] = useState<BacktestState>({ kind: "idle" });
  const [signalSaved, setSignalSaved] = useState(false);

  const chartLines = useMemo(
    () => {
      if (state.kind !== "success") {
        return { portfolio: "", benchmark: "" };
      }
      const values = [
        ...state.data.curve.map((point) => point.value),
        ...state.data.benchmark.curve.map((point) => point.value),
      ];
      const minimum = Math.min(...values);
      const maximum = Math.max(...values);
      return {
        portfolio: curvePolyline(state.data.curve, minimum, maximum),
        benchmark: curvePolyline(
          state.data.benchmark.curve,
          minimum,
          maximum,
        ),
      };
    },
    [state],
  );

  function recordDailySignal(data: BacktestSuccess) {
    try {
      const storageKey = "fidi-daily-signal-log-v4.1";
      const stored = JSON.parse(
        window.localStorage.getItem(storageKey) ?? "[]",
      ) as Array<{
        profile: string;
        asOf: string;
        generatedAt?: string;
        guide?: BacktestSuccess["dailyGuide"];
      }>;
      const next = stored.filter(
        (item) =>
          item.profile !== data.profile || item.asOf !== data.dailyGuide.asOf,
      );
      next.push({
        profile: data.profile,
        asOf: data.dailyGuide.asOf,
        generatedAt: data.generatedAt,
        guide: data.dailyGuide,
      });
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(next.slice(-365)),
      );
      setSignalSaved(true);
    } catch {
      setSignalSaved(false);
    }
  }

  function downloadDailySignal() {
    if (state.kind !== "success") return;
    const payload = JSON.stringify(
      {
        generatedAt: state.data.generatedAt,
        profile: state.data.profile,
        dailyGuide: state.data.dailyGuide,
        guidance: state.data.guidance,
      },
      null,
      2,
    );
    const objectUrl = URL.createObjectURL(
      new Blob([payload], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `fidi-${state.data.profile}-${state.data.dailyGuide.asOf}.json`;
    link.click();
    URL.revokeObjectURL(objectUrl);
  }

  async function executeBacktest() {
    setSignalSaved(false);
    setState({ kind: "loading" });
    try {
      const response = await fetch(
        `/api/backtest?profile=${encodeURIComponent(profileCode)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as
        | BacktestSuccess
        | BacktestFailure;
      if (!response.ok || payload.status !== "verified") {
        setState({
          kind: "error",
          data: payload as BacktestFailure,
        });
        return;
      }
      const verified = payload as BacktestSuccess;
      recordDailySignal(verified);
      setState({ kind: "success", data: verified });
    } catch {
      setState({
        kind: "error",
        data: {
          status: "network_error",
          message: "오늘 구성 확인에 연결하지 못했습니다.",
          setup: "잠시 후 다시 실행해 주세요.",
        },
      });
    }
  }

  return (
    <section className="backtest-section" id="backtest">
      <div className="backtest-heading">
        <div>
          <span className="step-label">STEP 04 · 오늘 확인</span>
          <h2>오늘 가격으로 구성 확인</h2>
          <p>
            매일 최신 가격으로 ETF와 섹터별 후보를 비교합니다. 현재
            {profileName} 구성을 유지할지, 바꿀 후보가 있는지와 확인 순서를 보여줍니다.
          </p>
        </div>
        <button
          className="backtest-action"
          type="button"
          onClick={executeBacktest}
          disabled={state.kind === "loading"}
        >
          {state.kind === "loading"
            ? "데이터 수집·계산 중…"
            : state.kind === "success"
              ? "오늘 가격으로 다시 확인"
              : "오늘 구성 확인"}
        </button>
      </div>

      {state.kind === "idle" && (
        <div className="backtest-empty">
          <span>오늘 확인</span>
          <strong>현재 구성과 대안 상품을 비교해 보세요.</strong>
          <p>
            버튼을 누르면 가격·환율·금리를 새로 확인하고, 현재 상품과
            대안 후보의 최근 흐름과 흔들림을 비교합니다.
          </p>
          <div>
            <i>01</i> Massive 미국 종가·배당
            <i>02</i> KRX 후보 종가 대조
            <i>03</i> 매일 후보 비교
            <i>04</i> 교체·비용 확인 순서
          </div>
        </div>
      )}

      {state.kind === "loading" && (
        <div className="backtest-loading" role="status">
          <i />
          <strong>오늘 가격과 비교 결과를 확인합니다.</strong>
          <span>Massive 무료 호출 한도 때문에 첫 실행은 조금 걸릴 수 있습니다.</span>
        </div>
      )}

      {state.kind === "error" && (
        <div className="backtest-error" role="alert">
          <span>오늘 구성 확인을 끝내지 못했습니다</span>
          <strong>{state.data.message}</strong>
          {state.data.setup && <p>{state.data.setup}</p>}
          <button type="button" onClick={executeBacktest}>
            다시 시도
          </button>
        </div>
      )}

      {state.kind === "success" && (
        <div className="backtest-results">
          <div className="verification-bar">
            <div>
              <i />
              <span>공식 데이터 확인</span>
              <strong>KRX 최신 종가 확인</strong>
            </div>
            <p>
              {state.data.period.start} — {state.data.period.end}
              <b>{state.data.period.observations.toLocaleString("ko-KR")} 거래 관측치</b>
            </p>
          </div>

          <section className="daily-guide-card" aria-label="오늘 구성 확인">
            <div className="daily-guide-hero">
              <div>
                <span>
                  오늘 확인 · {state.data.dailyGuide.asOf} ·{" "}
                  {state.data.dailyGuide.version}
                </span>
                <strong>{state.data.dailyGuide.headline}</strong>
                <p>
                  매일 평가 · 교체 우위{" "}
                  {percent.format(state.data.dailyGuide.switchThreshold)} 이상
                  비교 · 최종 실행은 사용자 직접 결정
                </p>
                <small>
                  실행비용 {state.data.dailyGuide.executionCostBps ?? state.data.dailyGuide.transactionCostBps}bp ·
                  비중 이탈 {percent.format(state.data.dailyGuide.rebalanceBand ?? 0)}p 이상일 때 검토
                </small>
              </div>
              <div className="daily-guide-summary">
                <div>
                  <span>현재 유지</span>
                  <strong>{state.data.dailyGuide.summary.maintain}</strong>
                </div>
                <div>
                  <span>교체 비교</span>
                  <strong>{state.data.dailyGuide.summary.reviewChange}</strong>
                </div>
                <button type="button" onClick={downloadDailySignal}>
                  오늘 신호 JSON 저장
                </button>
                <small>
                  {signalSaved
                    ? "이 기기에 오늘 기록을 저장했습니다."
                    : "계산 결과를 날짜별로 보관할 수 있습니다."}
                </small>
              </div>
            </div>

            <div className="daily-guide-groups">
              {state.data.dailyGuide.groups.map((group) => (
                <article
                  key={group.id}
                  className={
                    group.action === "REVIEW_CHANGE" ? "review-change" : ""
                  }
                >
                  <header>
                    <div>
                      <span>{group.name}</span>
                      <strong>{group.actionLabel}</strong>
                    </div>
                    <small>{group.reason}</small>
                  </header>
                  <div className="candidate-list">
                    {group.candidates.map((candidate) => (
                      <div
                        key={candidate.ticker}
                        className={`${candidate.rank === 1 ? "leader" : ""} ${
                          candidate.current ? "current" : ""
                        }`}
                      >
                        <b>{candidate.rank}</b>
                        <p>
                          <strong>{candidate.name}</strong>
                          <span>
                            {candidate.ticker}
                            {candidate.current ? " · 현재 편입" : " · 대안 후보"}
                          </span>
                        </p>
                        <dl>
                          <div>
                            <dt>20일</dt>
                            <dd>{percent.format(candidate.return20)}</dd>
                          </div>
                          <div>
                            <dt>60일</dt>
                            <dd>{percent.format(candidate.return60)}</dd>
                          </div>
                          <div>
                            <dt>점수</dt>
                            <dd>{percent.format(candidate.score)}</dd>
                          </div>
                        </dl>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <div className="execution-guide">
              <div>
                <span>확인 순서</span>
                <strong>교체 신호가 나온 날의 확인 순서</strong>
              </div>
              <ol>
                {state.data.dailyGuide.executionGuide.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </section>

          <section
            className="readiness-card guide"
            aria-label="운용 전 확인 가이드"
          >
            <div className="readiness-hero">
              <div>
                <span>검증 요약</span>
                <small className="validation-grade">
                  종합 판정 · {state.data.guidance.decision.label} ·{" "}
                  {state.data.guidance.decision.passedChecks}/
                  {state.data.guidance.decision.criticalChecks}개 핵심 확인
                </small>
                <strong>{state.data.guidance.headline}</strong>
                <p>
                  {state.data.guidance.decision.detail} 데이터가 짧은 항목은
                  한계로 표시하고, 미래 관찰과 체결 확인은 진행 순서로 안내합니다.
                </p>
              </div>
              <dl>
                <div>
                  <dt>확인</dt>
                  <dd>{state.data.guidance.summary.checked}</dd>
                </div>
                <div>
                  <dt>살펴보기</dt>
                  <dd>
                    {state.data.guidance.summary.review +
                      state.data.guidance.summary.limitedData}
                  </dd>
                </div>
                <div>
                  <dt>진행·다음</dt>
                  <dd>
                    {state.data.guidance.summary.inProgress +
                      state.data.guidance.summary.action}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="readiness-stat-grid">
              <article>
                <span>기준 대비 안정성</span>
                <strong>
                  {state.data.guidance.statistics.informationRatio === null
                    ? "—"
                    : number.format(
                        state.data.guidance.statistics.informationRatio,
                      )}
                </strong>
                <small>기준 구성 대비</small>
              </article>
              <article>
                <span>일별 초과수익 빈도</span>
                <strong>
                  {state.data.guidance.statistics.activeHitRate == null
                    ? "—"
                    : percent.format(
                        state.data.guidance.statistics.activeHitRate,
                      )}
                </strong>
                <small>기준 구성보다 높았던 거래일 비율</small>
              </article>
              <article>
                <span>최근 6개월 상회 비율</span>
                <strong>
                  {state.data.guidance.statistics.rollingBeatRate === null
                    ? "—"
                    : percent.format(
                        state.data.guidance.statistics.rollingBeatRate,
                      )}
                </strong>
                <small>126거래일 기준</small>
              </article>
              <article>
                <span>비용을 높였을 때 차이</span>
                <strong>
                  {percent.format(
                    state.data.guidance.statistics.costStressExcessCagr,
                  )}
                </strong>
                <small>거래비용 {state.data.assumptions.transactionCostBps * 3}bp 가정</small>
              </article>
              <article>
                <span>시작일을 바꿨을 때 차이</span>
                <strong>
                  {percent.format(
                    state.data.guidance.statistics.delayedStartExcessCagr,
                  )}
                </strong>
                <small>21거래일 뒤 시작</small>
              </article>
              <article>
                <span>낙폭 차이</span>
                <strong>
                  {percent.format(
                    state.data.guidance.statistics.maximumDrawdownGap,
                  )}
                </strong>
                <small>양수면 기준선보다 방어적</small>
              </article>
              <article>
                <span>OOS 검증 구간</span>
                <strong>
                  {state.data.guidance.statistics.walkForward?.folds.length ??
                    0}
                  회
                </strong>
                <small>
                  {state.data.guidance.statistics.walkForward?.meanExcessCagr ==
                  null
                    ? "데이터 부족"
                    : `평균 ${percent.format(state.data.guidance.statistics.walkForward.meanExcessCagr)}`}
                </small>
              </article>
              <article>
                <span>가격 데이터 품질</span>
                <strong>
                  {percent.format(
                    state.data.guidance.statistics.dataQuality
                      ?.minimumCoverageRatio ?? 1,
                  )}
                </strong>
                <small>
                  공백 보정 {number.format(
                    state.data.guidance.statistics.dataQuality
                      ?.totalMissingObservations ?? 0,
                  )}
                  개
                </small>
              </article>
              <article>
                <span>최대 종목 비중</span>
                <strong>
                  {percent.format(
                    state.data.guidance.statistics.riskLimits
                      ?.maxSingleAssetWeight ?? 0,
                  )}
                </strong>
                <small>
                  한도 {percent.format(
                    state.data.guidance.statistics.riskLimits
                      ?.maxSingleAssetWeightLimit ?? 0,
                  )}
                </small>
              </article>
            </div>

            <div className="readiness-checks">
              {state.data.guidance.checks.map((check) => (
                <article key={check.id} className={check.status.toLowerCase()}>
                  <span>{guidanceStatusLabel[check.status]}</span>
                  <div>
                    <strong>{check.label}</strong>
                    <p>{check.detail}</p>
                    <small>{check.guide}</small>
                  </div>
                </article>
              ))}
            </div>

            <div className="research-evidence">
              <strong>미래 관찰 기록</strong>
              <p>
                단위테스트 {state.data.guidance.evidence.researchUnitTests}개 ·
                V3 결합 데이터{" "}
                {state.data.guidance.evidence.v3CombinedRows.toLocaleString("ko-KR")}행 ·
                기준 백테스트{" "}
                {state.data.guidance.evidence.v3ReferenceObservations.toLocaleString("ko-KR")}관측치
              </p>
              <span>
                미래 데이터 관찰{" "}
                {state.data.guidance.evidence.forwardObservationStart} 시작 · 1년
                기록 확인 {state.data.guidance.evidence.earliestFormalReview}
              </span>
              {state.data.guidance.evidence.walkForward && (
                <span>
                  과거 시계열 홀드아웃 {state.data.guidance.evidence.walkForward.folds.length}개 ·
                  {state.data.guidance.evidence.walkForward.meanExcessCagr == null
                    ? " 데이터 부족"
                    : ` 평균 초과 연수익률 ${percent.format(state.data.guidance.evidence.walkForward.meanExcessCagr)}`}
                </span>
              )}
            </div>
          </section>

          <div className="backtest-metrics">
            <article className="primary">
              <span>연환산 수익률</span>
              <strong>{percent.format(state.data.metrics.cagr)}</strong>
              <small>연수익률(복리)</small>
            </article>
            <article>
              <span>누적 수익률</span>
              <strong>{percent.format(state.data.metrics.totalReturn)}</strong>
              <small>초기 1원 기준 {number.format(state.data.metrics.endingValue)}원</small>
            </article>
            <article>
              <span>최대 낙폭</span>
              <strong>{percent.format(state.data.metrics.maximumDrawdown)}</strong>
              <small>고점에서 내려간 폭</small>
            </article>
            <article>
              <span>연 변동성</span>
              <strong>{percent.format(state.data.metrics.annualVolatility)}</strong>
              <small>일별 가격 변동 기준</small>
            </article>
            <article>
              <span>샤프지수</span>
              <strong>
                {state.data.metrics.sharpe === null
                  ? "—"
                  : number.format(state.data.metrics.sharpe)}
              </strong>
              <small>ECOS 원화 참고 금리 사용</small>
            </article>
            <article>
              <span>월간 승률</span>
              <strong>{percent.format(state.data.metrics.winningMonths)}</strong>
              <small>{state.data.metrics.rebalances}회 비중 조정</small>
            </article>
          </div>

          <article
            className={`benchmark-summary ${
              state.data.comparison.beatBenchmark ? "win" : "loss"
            }`}
          >
            <div>
              <span>포트폴리오와 기준 구성 비교</span>
              <strong>
                {state.data.comparison.beatBenchmark
                  ? "비교 기준 상회"
                  : "비교 기준 하회"}
              </strong>
              <small>
                {state.data.benchmark.name} · {state.data.benchmark.ticker}
              </small>
            </div>
            <dl>
              <div>
                <dt>포트폴리오 연수익률</dt>
                <dd>{percent.format(state.data.metrics.cagr)}</dd>
              </div>
              <div>
                <dt>기준 구성 연수익률</dt>
                <dd>{percent.format(state.data.benchmark.metrics.cagr)}</dd>
              </div>
              <div>
                <dt>연수익률 차이</dt>
                <dd>{percent.format(state.data.comparison.excessCagr)}</dd>
              </div>
              <div>
                <dt>누적 초과수익</dt>
                <dd>{percent.format(state.data.comparison.excessTotalReturn)}</dd>
              </div>
            </dl>
          </article>

          <div className="backtest-detail-grid">
            <article className="equity-curve-card">
              <div>
                <span>누적 운용가치</span>
                <strong>포트폴리오와 기준 구성</strong>
              </div>
              <div className="curve-legend" aria-hidden="true">
                <span><i />{profileName} 포트폴리오</span>
                <span><i />기준 구성</span>
              </div>
              <svg
                viewBox="0 0 800 220"
                role="img"
                aria-label={`${profileName} 포트폴리오와 기준 구성의 누적 운용가치 비교`}
              >
                <line x1="20" y1="200" x2="780" y2="200" />
                <line x1="20" y1="120" x2="780" y2="120" />
                <line x1="20" y1="40" x2="780" y2="40" />
                <polyline
                  className="benchmark-line"
                  points={chartLines.benchmark}
                />
                <polyline
                  className="portfolio-line"
                  points={chartLines.portfolio}
                />
              </svg>
              <div className="curve-axis">
                <span>{state.data.period.start}</span>
                <strong>1.00</strong>
                <span>{state.data.period.end}</span>
              </div>
            </article>

            <article className="assumption-card">
              <div>
                <span>검증 조건</span>
                <strong>재현 가능한 계산 기준</strong>
              </div>
              <dl>
                <div>
                  <dt>가격 데이터</dt>
                  <dd>Massive + KRX 대조</dd>
                </div>
                <div>
                  <dt>KRX 확인일</dt>
                  <dd>
                    {state.data.providers.koreanOfficialAudit.date} ·{" "}
                    {state.data.providers.koreanOfficialAudit.matched}종목
                  </dd>
                </div>
                <div>
                  <dt>원/달러 환율</dt>
                  <dd>
                    {state.data.providers.fx.latestRate === null
                      ? "확인 필요"
                      : `${number.format(state.data.providers.fx.latestRate)}원 · ${state.data.providers.fx.latestDate ?? "최근일"}`}
                  </dd>
                </div>
                <div>
                  <dt>기준 통화</dt>
                  <dd>{state.data.baseCurrency}</dd>
                </div>
                <div>
                  <dt>비중 조정</dt>
                  <dd>{cadenceLabel[state.data.assumptions.rebalance]}</dd>
                </div>
                <div>
                  <dt>거래비용</dt>
                  <dd>
                    {state.data.assumptions.transactionCostBps}bp 수수료 +{" "}
                    {state.data.assumptions.slippageBps ?? 0}bp 슬리피지
                  </dd>
                </div>
                <div>
                  <dt>총 실행비용</dt>
                  <dd>{state.data.assumptions.executionCostBps ?? state.data.assumptions.transactionCostBps}bp</dd>
                </div>
                <div>
                  <dt>리밸런싱 밴드</dt>
                  <dd>{percent.format(state.data.assumptions.rebalanceBand ?? 0)}p</dd>
                </div>
                <div>
                  <dt>기준 조정 주기</dt>
                  <dd>{cadenceLabel[state.data.assumptions.lockedRebalance]}</dd>
                </div>
                <div>
                  <dt>참고 금리</dt>
                  <dd>{number.format(state.data.assumptions.riskFreeRatePercent)}%</dd>
                </div>
                <div>
                  <dt>연간 교체 비율</dt>
                  <dd>{percent.format(state.data.metrics.annualizedTurnover)}</dd>
                </div>
              </dl>
              <p className="market-reference">
                시장 참고치: {state.data.marketReference.name}({state.data.marketReference.ticker})
                연수익률 {percent.format(state.data.marketReference.metrics.cagr)} · 공식
                기준 구성 아님
              </p>
              <div className="api-connections">
                <span className="connected">Massive 연결됨</span>
                <span className="connected">KRX 확인됨</span>
                <span className={state.data.providers.koreanRiskFree ? "connected" : ""}>
                  ECOS {state.data.providers.koreanRiskFree ? "연결됨" : "미연결"}
                </span>
                <span className={state.data.providers.usReferenceRate ? "connected" : ""}>
                  FRED {state.data.providers.usReferenceRate ? "연결됨" : "미연결"}
                </span>
              </div>
            </article>
          </div>

          <div className="backtest-warnings">
            <strong>결과를 읽을 때 반드시 확인할 점</strong>
            <ul>
              {state.data.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
