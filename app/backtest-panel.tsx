"use client";

import { useEffect, useMemo, useState } from "react";

type RateSource = {
  source: string;
  series: string;
  name: string;
  averagePercent: number;
  observations: number;
};

type BacktestSuccess = {
  status: "verified";
  generatedAt: string;
  profile: string;
  baseCurrency: "KRW";
  validationScope: "current-holdings-fixed";
  providers: {
    prices: string;
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
  metrics: {
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
  curve: Array<{ date: string; value: number; drawdown: number }>;
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

function curvePolyline(curve: BacktestSuccess["curve"]) {
  if (curve.length < 2) return "";
  const values = curve.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
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

  const points = useMemo(
    () =>
      state.kind === "success" ? curvePolyline(state.data.curve) : "",
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
          <h2>가정치가 아닌, 실제 가격으로 검증</h2>
          <p>
            수정주가·배당·분할·원/달러 환율·리밸런싱 비용을 반영해
            현재 {profileName} 편입안을 원화 기준으로 다시 계산합니다.
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
            <i>01</i> 수정주가 수집
            <i>02</i> USD 자산 원화 환산
            <i>03</i> 비용 반영
            <i>04</i> 성과지표 계산
          </div>
        </div>
      )}

      {state.kind === "loading" && (
        <div className="backtest-loading" role="status">
          <i />
          <strong>전 종목의 공통 가격 구간을 맞추고 있습니다.</strong>
          <span>미국·한국 휴장일은 직전 가격으로 정렬합니다.</span>
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
              <span>CALCULATED</span>
              <strong>서버 계산 완료</strong>
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

          <div className="backtest-detail-grid">
            <article className="equity-curve-card">
              <div>
                <span>KRW EQUITY CURVE</span>
                <strong>누적 운용가치</strong>
              </div>
              <svg
                viewBox="0 0 800 220"
                role="img"
                aria-label={`${profileName} 백테스트 누적 운용가치 곡선`}
              >
                <line x1="20" y1="200" x2="780" y2="200" />
                <line x1="20" y1="120" x2="780" y2="120" />
                <line x1="20" y1="40" x2="780" y2="40" />
                <polyline points={points} />
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
                  <dd>{state.data.providers.prices}</dd>
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

