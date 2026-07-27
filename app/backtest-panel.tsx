"use client";

import { useEffect, useMemo, useState } from "react";

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
    metrics: BacktestMetrics;
    curve: CurvePoint[];
  };
  comparison: {
    beatBenchmark: boolean;
    excessTotalReturn: number;
    excessCagr: number;
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

  useEffect(() => {
    setState({ kind: "idle" });
  }, [profileCode]);

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
            현재 {profileName} 전체 구성을 TIGER 미국S&amp;P500과 비교합니다.
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
            <i>04</i> 벤치마크 비교
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
              <span>전체 포트폴리오 vs 단일 벤치마크</span>
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
                <dt>벤치마크 CAGR</dt>
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
                <span>KRW EQUITY CURVE</span>
                <strong>전체 포트폴리오와 벤치마크</strong>
              </div>
              <div className="curve-legend" aria-hidden="true">
                <span><i />{profileName} 포트폴리오</span>
                <span><i />TIGER 미국S&amp;P500</span>
              </div>
              <svg
                viewBox="0 0 800 220"
                role="img"
                aria-label={`${profileName} 포트폴리오와 TIGER 미국S&P500 누적 운용가치 비교`}
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
                  <dt>무위험금리</dt>
                  <dd>{number.format(state.data.assumptions.riskFreeRatePercent)}%</dd>
                </div>
                <div>
                  <dt>연간 회전율</dt>
                  <dd>{percent.format(state.data.metrics.annualizedTurnover)}</dd>
                </div>
              </dl>
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
