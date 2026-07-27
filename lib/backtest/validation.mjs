const TRADING_DAYS_PER_YEAR = 252;

function mean(values) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function sampleStandardDeviation(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
      (values.length - 1),
  );
}

function alignedCurves(portfolioCurve, benchmarkCurve) {
  const benchmarkByDate = new Map(
    benchmarkCurve.map((point) => [point.date, point.value]),
  );
  return portfolioCurve
    .filter((point) => benchmarkByDate.has(point.date))
    .map((point) => ({
      date: point.date,
      portfolio: point.value,
      benchmark: benchmarkByDate.get(point.date),
    }));
}

function relativeReturn(points, start, end, key) {
  return points[end][key] / points[start][key] - 1;
}

export function calculateRelativeStatistics(
  portfolioCurve,
  benchmarkCurve,
  rollingWindow = 126,
) {
  const points = alignedCurves(portfolioCurve, benchmarkCurve);
  if (points.length < 3) {
    throw new Error("Relative validation needs at least three aligned points");
  }

  const activeReturns = [];
  for (let index = 1; index < points.length; index += 1) {
    const portfolioReturn =
      points[index].portfolio / points[index - 1].portfolio - 1;
    const benchmarkReturn =
      points[index].benchmark / points[index - 1].benchmark - 1;
    activeReturns.push(portfolioReturn - benchmarkReturn);
  }
  const trackingError =
    sampleStandardDeviation(activeReturns) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  const informationRatio =
    trackingError > 0
      ? (mean(activeReturns) * TRADING_DAYS_PER_YEAR) / trackingError
      : null;

  const midpoint = Math.floor((points.length - 1) / 2);
  const halfExcessReturns = [
    relativeReturn(points, 0, midpoint, "portfolio") -
      relativeReturn(points, 0, midpoint, "benchmark"),
    relativeReturn(points, midpoint, points.length - 1, "portfolio") -
      relativeReturn(points, midpoint, points.length - 1, "benchmark"),
  ];

  const rollingExcessReturns = [];
  if (points.length > rollingWindow) {
    for (let end = rollingWindow; end < points.length; end += 1) {
      const start = end - rollingWindow;
      rollingExcessReturns.push(
        relativeReturn(points, start, end, "portfolio") -
          relativeReturn(points, start, end, "benchmark"),
      );
    }
  }

  return {
    alignedObservations: points.length,
    informationRatio,
    trackingError,
    halfExcessReturns,
    rollingWindow,
    rollingWindows: rollingExcessReturns.length,
    rollingBeatRate: rollingExcessReturns.length
      ? rollingExcessReturns.filter((value) => value > 0).length /
        rollingExcessReturns.length
      : null,
    worstRollingExcess: rollingExcessReturns.length
      ? Math.min(...rollingExcessReturns)
      : null,
  };
}

export function calculateConcentration(weights) {
  return {
    maximumWeight: Math.max(...weights),
    herfindahlIndex: weights.reduce((sum, weight) => sum + weight ** 2, 0),
  };
}

function weightsMatch(current, locked, tolerance = 1e-8) {
  return Object.keys(locked).every(
    (key) => Math.abs(current[key] - locked[key]) <= tolerance,
  );
}

export function buildLiveReadiness({
  profile,
  result,
  policyBenchmark,
  costStress,
  delayedStart,
  alternateCadence,
  currentWeights,
  lockedWeights,
  currentCadence,
  lockedCadence,
  krxAudit,
  assetWeights,
}) {
  const relative = calculateRelativeStatistics(
    result.fullCurve,
    policyBenchmark.fullCurve,
  );
  const comparison = {
    excessTotalReturn:
      result.metrics.totalReturn - policyBenchmark.metrics.totalReturn,
    excessCagr: result.metrics.cagr - policyBenchmark.metrics.cagr,
  };
  const costStressExcessCagr =
    costStress.result.metrics.cagr -
    costStress.policyBenchmark.metrics.cagr;
  const delayedStartExcessCagr =
    delayedStart.result.metrics.cagr -
    delayedStart.policyBenchmark.metrics.cagr;
  const alternateCadenceExcessCagr =
    alternateCadence.result.metrics.cagr -
    alternateCadence.policyBenchmark.metrics.cagr;
  const maximumDrawdownGap =
    result.metrics.maximumDrawdown -
    policyBenchmark.metrics.maximumDrawdown;
  const concentration = calculateConcentration(
    assetWeights,
  );

  const checks = [
    {
      id: "official-price-audit",
      label: "KRX 공식 최근 종가 교차대조",
      status:
        krxAudit.matched === krxAudit.total &&
        krxAudit.maximumDifferencePercent <= 0.5
          ? "PASS"
          : "FAIL",
      blocker: true,
      detail: `${krxAudit.matched}/${krxAudit.total} 종목 · 최대 차이 ${krxAudit.maximumDifferencePercent.toFixed(3)}%`,
    },
    {
      id: "same-risk-benchmark",
      label: "동일위험 정책 벤치마크 초과",
      status:
        comparison.excessTotalReturn > 0 &&
        relative.informationRatio !== null &&
        relative.informationRatio > 0
          ? "PASS"
          : "FAIL",
      blocker: true,
      detail: `초과 CAGR ${(comparison.excessCagr * 100).toFixed(2)}%p · IR ${
        relative.informationRatio === null
          ? "계산 불가"
          : relative.informationRatio.toFixed(2)
      }`,
    },
    {
      id: "cost-stress",
      label: "거래비용 3배 스트레스",
      status: costStressExcessCagr > 0 ? "PASS" : "FAIL",
      blocker: true,
      detail: `정책 기준선 대비 초과 CAGR ${(costStressExcessCagr * 100).toFixed(2)}%p`,
    },
    {
      id: "subperiod-stability",
      label: "전·후반 구간 안정성",
      status: relative.halfExcessReturns.every((value) => value > 0)
        ? "PASS"
        : "FAIL",
      blocker: true,
      detail: relative.halfExcessReturns
        .map((value) => `${(value * 100).toFixed(2)}%p`)
        .join(" / "),
    },
    {
      id: "delayed-start",
      label: "21거래일 지연 시작 민감도",
      status: delayedStartExcessCagr > 0 ? "PASS" : "FAIL",
      blocker: true,
      detail: `초과 CAGR ${(delayedStartExcessCagr * 100).toFixed(2)}%p`,
    },
    {
      id: "cadence-sensitivity",
      label: "리밸런싱 주기 민감도",
      status: alternateCadenceExcessCagr > 0 ? "PASS" : "FAIL",
      blocker: true,
      detail: `${alternateCadence.cadence} 적용 시 초과 CAGR ${(alternateCadenceExcessCagr * 100).toFixed(2)}%p`,
    },
    {
      id: "drawdown-control",
      label: "동일위험 기준선 대비 낙폭",
      status: maximumDrawdownGap >= -0.05 ? "PASS" : "FAIL",
      blocker: true,
      detail: `MDD 차이 ${(maximumDrawdownGap * 100).toFixed(2)}%p`,
    },
    {
      id: "sample-length",
      label: "최소 3년 검증 표본",
      status: result.period.years >= 3 ? "PASS" : "FAIL",
      blocker: true,
      detail: `${result.period.years.toFixed(2)}년 · ${result.period.observations.toLocaleString()} 관측치`,
    },
    {
      id: "policy-weights",
      label: "잠금 정책 비중 일치",
      status: weightsMatch(currentWeights, lockedWeights) ? "PASS" : "FAIL",
      blocker: true,
      detail: weightsMatch(currentWeights, lockedWeights)
        ? "현재 구성과 승인된 정책 비중 일치"
        : "현재 화면 비중과 승인된 V4 정책 비중이 다름",
    },
    {
      id: "policy-cadence",
      label: "잠금 리밸런싱 주기 일치",
      status: currentCadence === lockedCadence ? "PASS" : "FAIL",
      blocker: true,
      detail: `현재 ${currentCadence} · 잠금 정책 ${lockedCadence}`,
    },
    {
      id: "point-in-time",
      label: "과거 시점 후보군·선정 스냅샷",
      status: "PENDING",
      blocker: true,
      detail: "현재 종목을 과거에도 보유한 가정이며 point-in-time 후보군이 없음",
    },
    {
      id: "forward-oos",
      label: "사전 잠금 후 1년 전진 OOS",
      status: "PENDING",
      blocker: true,
      detail: "관찰 시작 2026-07-25 · 최초 정식 검토 가능 2027-07-25",
    },
    {
      id: "execution-dry-run",
      label: "세금·호가스프레드·체결 드라이런",
      status: "PENDING",
      blocker: true,
      detail: "증권사 주문·세금·실제 호가 충격 검증이 아직 없음",
    },
  ];

  if (profile === "CONTEST") {
    checks.push({
      id: "contest-rules",
      label: "투자대회 규정·평가식 잠금",
      status: "PENDING",
      blocker: true,
      detail: "대회 규정 URL·허용시장·평가식·최초 선정 스냅샷 필요",
    });
  }

  const blocking = checks.filter(
    (check) => check.blocker && check.status !== "PASS",
  );
  return {
    verdict: blocking.length ? "HOLD" : "READY",
    readyForLiveCapital: blocking.length === 0,
    checkedAt: new Date().toISOString(),
    summary: {
      passed: checks.filter((check) => check.status === "PASS").length,
      failed: checks.filter((check) => check.status === "FAIL").length,
      pending: checks.filter((check) => check.status === "PENDING").length,
      total: checks.length,
      blockers: blocking.length,
    },
    statistics: {
      ...relative,
      ...comparison,
      costStressExcessCagr,
      delayedStartExcessCagr,
      alternateCadenceExcessCagr,
      maximumDrawdownGap,
      concentration,
    },
    evidence: {
      researchUnitTests: 34,
      v3CombinedRows: 52_477,
      v3ReferenceObservations: 3_337,
      retrospectiveOutOfSample: false,
      forwardObservationStart: "2026-07-25",
      earliestFormalReview: "2027-07-25",
    },
    checks,
  };
}
