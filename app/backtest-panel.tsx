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
  rebalances: number;
};

type CurvePoint = { date: string; value: number; drawdown: number };

type ReadinessCheck = {
  id: string;
  label: string;
  status: "PASS" | "FAIL" | "PENDING";
  blocker: boolean;
  detail: string;
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
    };
    koreanRiskFree: RateSource | null;
    usReferenceRate: RateSource | null;
  };
  assumptions: {
    rebalance: "weekly" | "monthly" | "quarterly";
    lockedRebalance: "weekly" | "monthly" | "quarterly";
    transactionCostBps: number;
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
  readiness: {
    verdict: "HOLD" | "READY";
    readyForLiveCapital: boolean;
    checkedAt: string;
    summary: {
      passed: number;
      failed: number;
      pending: number;
      total: number;
      blockers: number;
    };
    statistics: {
      informationRatio: number | null;
      rollingBeatRate: number | null;
      worstRollingExcess: number | null;
      costStressExcessCagr: number;
      delayedStartExcessCagr: number;
      alternateCadenceExcessCagr: number;
      maximumDrawdownGap: number;
      concentration: {
        maximumWeight: number;
        herfindahlIndex: number;
      };
    };
    evidence: {
      researchUnitTests: number;
      v3CombinedRows: number;
      v3ReferenceObservations: number;
      retrospectiveOutOfSample: boolean;
      forwardObservationStart: string;
      earliestFormalReview: string;
    };
    checks: ReadinessCheck[];
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

  async function executeBacktest() {
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
      setState({ kind: "success", data: payload as BacktestSuccess });
    } catch {
      setState({
        kind: "error",
        data: {
          status: "network_error",
          message: "백테스트 API에 연결하지 못했습니다.",
          setup: "잠시 후 다시 실행해 주세요.",
        },
      });
    }
  }

  return (
    <section className="backtest-section" id="backtest">
      <div className="backtest-heading">
        <div>
          <span className="step-label">STEP 04 · BACKTEST</span>
          <h2>공식 데이터로 전체 포트폴리오 검증</h2>
          <p>
            Massive·KRX·FRED·ECOS 자료로 배당·분할·환율·비용을 반영하고,
            현재 {profileName} 전체 구성을 동일위험 정책 기준선과 비교한 뒤
            실운용 준비요건까지 판정합니다.
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
              ? "최신 데이터로 다시 실행"
              : "실데이터 백테스트 실행"}
        </button>
      </div>

      {state.kind === "idle" && (
        <div className="backtest-empty">
          <span>API READY</span>
          <strong>아직 계산되지 않았습니다.</strong>
          <p>
            버튼을 누르면 서버가 가격과 금리를 새로 확인합니다. 화면의
            기존 기대수익률 숫자는 백테스트 결과로 간주하지 않습니다.
          </p>
          <div>
            <i>01</i> Massive 미국 종가·배당
            <i>02</i> KRX 최근 종가 대조
            <i>03</i> FRED 환율·비용
            <i>04</i> 실운용 게이트 판정
          </div>
        </div>
      )}

      {state.kind === "loading" && (
        <div className="backtest-loading" role="status">
          <i />
          <strong>공식 데이터 출처를 확인하고 총수익률을 계산합니다.</strong>
          <span>Massive 무료 호출 한도 때문에 첫 실행은 조금 걸릴 수 있습니다.</span>
        </div>
      )}

      {state.kind === "error" && (
        <div className="backtest-error" role="alert">
          <span>검증을 완료하지 못했습니다</span>
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
              <span>OFFICIAL SOURCES CHECKED</span>
              <strong>KRX 최근 종가 대조 완료</strong>
            </div>
            <p>
              {state.data.period.start} — {state.data.period.end}
              <b>{state.data.period.observations.toLocaleString("ko-KR")} 거래 관측치</b>
            </p>
          </div>

          <section
            className={`readiness-card ${
              state.data.readiness.readyForLiveCapital ? "ready" : "hold"
            }`}
            aria-label="실운용 준비도 판정"
          >
            <div className="readiness-hero">
              <div>
                <span>PRE-LIVE VALIDATION · {state.data.readiness.verdict}</span>
                <strong>
                  {state.data.readiness.readyForLiveCapital
                    ? "실제자금 운용 준비 완료"
                    : "실제자금 투입 보류"}
                </strong>
                <p>
                  {state.data.readiness.readyForLiveCapital
                    ? "잠금된 필수 검증 게이트를 모두 통과했습니다."
                    : `${state.data.readiness.summary.blockers}개 필수 게이트가 남았습니다. 과거 수익률만으로 운용을 시작하면 안 됩니다.`}
                </p>
              </div>
              <dl>
                <div>
                  <dt>통과</dt>
                  <dd>{state.data.readiness.summary.passed}</dd>
                </div>
                <div>
                  <dt>실패</dt>
                  <dd>{state.data.readiness.summary.failed}</dd>
                </div>
                <div>
                  <dt>대기</dt>
                  <dd>{state.data.readiness.summary.pending}</dd>
                </div>
              </dl>
            </div>

            <div className="readiness-stat-grid">
              <article>
                <span>정보비율</span>
                <strong>
                  {state.data.readiness.statistics.informationRatio === null
                    ? "—"
                    : number.format(
                        state.data.readiness.statistics.informationRatio,
                      )}
                </strong>
                <small>동일위험 기준선 대비</small>
              </article>
              <article>
                <span>6개월 구간 승률</span>
                <strong>
                  {state.data.readiness.statistics.rollingBeatRate === null
                    ? "—"
                    : percent.format(
                        state.data.readiness.statistics.rollingBeatRate,
                      )}
                </strong>
                <small>126거래일 롤링</small>
              </article>
              <article>
                <span>비용 3배 초과 CAGR</span>
                <strong>
                  {percent.format(
                    state.data.readiness.statistics.costStressExcessCagr,
                  )}
                </strong>
                <small>{state.data.assumptions.transactionCostBps * 3}bp 스트레스</small>
              </article>
              <article>
                <span>21일 지연 초과 CAGR</span>
                <strong>
                  {percent.format(
                    state.data.readiness.statistics.delayedStartExcessCagr,
                  )}
                </strong>
                <small>시작일 민감도</small>
              </article>
              <article>
                <span>낙폭 차이</span>
                <strong>
                  {percent.format(
                    state.data.readiness.statistics.maximumDrawdownGap,
                  )}
                </strong>
                <small>양수면 기준선보다 방어적</small>
              </article>
            </div>

            <div className="readiness-checks">
              {state.data.readiness.checks.map((check) => (
                <article key={check.id} className={check.status.toLowerCase()}>
                  <span>{check.status}</span>
                  <div>
                    <strong>{check.label}</strong>
                    <p>{check.detail}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="research-evidence">
              <strong>연구 파이프라인 증거</strong>
              <p>
                단위테스트 {state.data.readiness.evidence.researchUnitTests}개 통과 ·
                V3 결합 데이터{" "}
                {state.data.readiness.evidence.v3CombinedRows.toLocaleString("ko-KR")}행 ·
                기준 백테스트{" "}
                {state.data.readiness.evidence.v3ReferenceObservations.toLocaleString("ko-KR")}관측치
              </p>
              <span>
                단, 회고 결과이며 OOS 아님 · 전진 관찰{" "}
                {state.data.readiness.evidence.forwardObservationStart} 시작 · 최초 정식
                검토 {state.data.readiness.evidence.earliestFormalReview}
              </span>
            </div>
          </section>

          <div className="backtest-metrics">
            <article className="primary">
              <span>연환산 수익률</span>
              <strong>{percent.format(state.data.metrics.cagr)}</strong>
              <small>복리 CAGR</small>
            </article>
            <article>
              <span>누적 수익률</span>
              <strong>{percent.format(state.data.metrics.totalReturn)}</strong>
              <small>초기 1원 기준 {number.format(state.data.metrics.endingValue)}원</small>
            </article>
            <article>
              <span>최대 낙폭</span>
              <strong>{percent.format(state.data.metrics.maximumDrawdown)}</strong>
              <small>고점 대비 MDD</small>
            </article>
            <article>
              <span>연 변동성</span>
              <strong>{percent.format(state.data.metrics.annualVolatility)}</strong>
              <small>일별 수익률 × √252</small>
            </article>
            <article>
              <span>샤프지수</span>
              <strong>
                {state.data.metrics.sharpe === null
                  ? "—"
                  : number.format(state.data.metrics.sharpe)}
              </strong>
              <small>ECOS 원화 무위험금리 우선</small>
            </article>
            <article>
              <span>월간 승률</span>
              <strong>{percent.format(state.data.metrics.winningMonths)}</strong>
              <small>{state.data.metrics.rebalances}회 리밸런싱</small>
            </article>
          </div>

          <article
            className={`benchmark-summary ${
              state.data.comparison.beatBenchmark ? "win" : "loss"
            }`}
          >
            <div>
              <span>전체 포트폴리오 vs 동일위험 정책 기준선</span>
              <strong>
                {state.data.comparison.beatBenchmark
                  ? "벤치마크 상회"
                  : "벤치마크 하회"}
              </strong>
              <small>
                {state.data.benchmark.name} · {state.data.benchmark.ticker}
              </small>
            </div>
            <dl>
              <div>
                <dt>포트폴리오 CAGR</dt>
                <dd>{percent.format(state.data.metrics.cagr)}</dd>
              </div>
              <div>
                <dt>정책 기준선 CAGR</dt>
                <dd>{percent.format(state.data.benchmark.metrics.cagr)}</dd>
              </div>
              <div>
                <dt>초과 CAGR</dt>
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
                <span>KRW TOTAL RETURN CURVE</span>
                <strong>전체 포트폴리오와 동일위험 기준선</strong>
              </div>
              <div className="curve-legend" aria-hidden="true">
                <span><i />{profileName} 포트폴리오</span>
                <span><i />동일위험 정책 기준선</span>
              </div>
              <svg
                viewBox="0 0 800 220"
                role="img"
                aria-label={`${profileName} 포트폴리오와 동일위험 정책 기준선 누적 운용가치 비교`}
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
                  <dt>KRX 대조일</dt>
                  <dd>
                    {state.data.providers.koreanOfficialAudit.date} ·{" "}
                    {state.data.providers.koreanOfficialAudit.matched}종목
                  </dd>
                </div>
                <div>
                  <dt>원/달러 환율</dt>
                  <dd>FRED {state.data.providers.fx.series}</dd>
                </div>
                <div>
                  <dt>기준 통화</dt>
                  <dd>{state.data.baseCurrency}</dd>
                </div>
                <div>
                  <dt>리밸런싱</dt>
                  <dd>{cadenceLabel[state.data.assumptions.rebalance]}</dd>
                </div>
                <div>
                  <dt>거래비용</dt>
                  <dd>{state.data.assumptions.transactionCostBps}bp / 회전금액</dd>
                </div>
                <div>
                  <dt>잠금 정책 주기</dt>
                  <dd>{cadenceLabel[state.data.assumptions.lockedRebalance]}</dd>
                </div>
                <div>
                  <dt>무위험금리</dt>
                  <dd>{number.format(state.data.assumptions.riskFreeRatePercent)}%</dd>
                </div>
                <div>
                  <dt>연간 회전율</dt>
                  <dd>{percent.format(state.data.metrics.annualizedTurnover)}</dd>
                </div>
              </dl>
              <p className="market-reference">
                시장 참고치: {state.data.marketReference.name}({state.data.marketReference.ticker})
                CAGR {percent.format(state.data.marketReference.metrics.cagr)} · 공식 채택
                벤치마크 아님
              </p>
              <div className="api-connections">
                <span className="connected">Massive 연결됨</span>
                <span className="connected">KRX 대조됨</span>
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
