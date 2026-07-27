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

export function buildValidationGuide({
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
      label: "KRX 최신 종가 확인",
      status:
        krxAudit.matched === krxAudit.total &&
        krxAudit.maximumDifferencePercent <= 0.5
          ? "CHECKED"
          : "REVIEW",
      detail: `${krxAudit.matched}/${krxAudit.total} 종목 · 최대 차이 ${krxAudit.maximumDifferencePercent.toFixed(3)}%`,
      guide: "최근 공식 종가와 계산 가격의 차이를 주문 전에 다시 확인합니다.",
    },
    {
      id: "same-risk-benchmark",
      label: "기준 구성과 성과 비교",
      status:
        comparison.excessTotalReturn > 0 &&
        relative.informationRatio !== null &&
        relative.informationRatio > 0
          ? "CHECKED"
          : "REVIEW",
      detail: `연수익률 차이 ${(comparison.excessCagr * 100).toFixed(2)}%p · 안정성 점수 ${
        relative.informationRatio === null
          ? "계산 불가"
          : relative.informationRatio.toFixed(2)
      }`,
      guide: "기준 구성과의 차이는 성과를 살펴보는 참고자료로 사용합니다.",
    },
    {
      id: "cost-stress",
      label: "거래비용을 높여 다시 계산",
      status: costStressExcessCagr > 0 ? "CHECKED" : "REVIEW",
      detail: `기준 구성 대비 연수익률 차이 ${(costStressExcessCagr * 100).toFixed(2)}%p`,
      guide: "실제 주문 전 예상 비용이 가정 범위 안인지 확인합니다.",
    },
    {
      id: "subperiod-stability",
      label: "기간을 나눠 성과 확인",
      status: relative.halfExcessReturns.every((value) => value > 0)
        ? "CHECKED"
        : "REVIEW",
      detail: relative.halfExcessReturns
        .map((value) => `${(value * 100).toFixed(2)}%p`)
        .join(" / "),
      guide: "특정 구간에만 성과가 집중되는지 함께 살펴봅니다.",
    },
    {
      id: "delayed-start",
      label: "시작일을 바꿔 확인",
      status: delayedStartExcessCagr > 0 ? "CHECKED" : "REVIEW",
      detail: `연수익률 차이 ${(delayedStartExcessCagr * 100).toFixed(2)}%p`,
      guide: "시작일이 달라져도 결과 방향이 유지되는지 참고합니다.",
    },
    {
      id: "cadence-sensitivity",
      label: "비중 조정 주기 비교",
      status: alternateCadenceExcessCagr > 0 ? "CHECKED" : "REVIEW",
      detail: `${alternateCadence.cadence} 적용 시 연수익률 차이 ${(alternateCadenceExcessCagr * 100).toFixed(2)}%p`,
      guide: "매일 평가하되 실제 교체는 점수 우위와 비용을 함께 봅니다.",
    },
    {
      id: "drawdown-control",
      label: "기준 구성 대비 하락폭",
      status: maximumDrawdownGap >= -0.05 ? "CHECKED" : "REVIEW",
      detail: `고점 대비 하락폭 차이 ${(maximumDrawdownGap * 100).toFixed(2)}%p`,
      guide: "낙폭이 커질 때 비중 축소나 교체 검토 기준으로 사용합니다.",
    },
    {
      id: "sample-length",
      label: "3년 이상 가격 데이터",
      status: result.period.years >= 3 ? "CHECKED" : "LIMITED_DATA",
      detail: `${result.period.years.toFixed(2)}년 · ${result.period.observations.toLocaleString()} 관측치`,
      guide:
        result.period.years >= 3
          ? "장기 구간을 포함한 참고자료입니다."
          : "데이터 한계를 표시하고, 장기 확신보다 오늘의 상대 비교에 활용합니다.",
    },
    {
      id: "policy-weights",
      label: "기준 비중 확인",
      status: weightsMatch(currentWeights, lockedWeights)
        ? "CHECKED"
        : "REVIEW",
      detail: weightsMatch(currentWeights, lockedWeights)
        ? "현재 구성과 V4.1 정책 기준 비중 일치"
        : "현재 화면 비중과 정책 기준 비중 확인 필요",
      guide: "자산군 비중은 기준으로 유지하고, 종목은 매일 다시 평가합니다.",
    },
    {
      id: "policy-cadence",
      label: "기준 조정 주기 확인",
      status: currentCadence === lockedCadence ? "CHECKED" : "REVIEW",
      detail: `현재 ${currentCadence} · 정책 기준 ${lockedCadence}`,
      guide: "데이터는 매일 평가하고, 실제 거래는 유형별 주기와 교체 기준을 적용합니다.",
    },
    {
      id: "point-in-time",
      label: "과거 시점 후보군·선정 스냅샷",
      status: "IN_PROGRESS",
      detail: "오늘부터 생성한 후보 점수와 선정 결과를 날짜별로 기록",
      guide: "일일 신호를 기기에 저장하거나 JSON으로 내려받아 변경 이력을 남깁니다.",
    },
    {
      id: "forward-oos",
      label: "정한 규칙을 1년간 확인",
      status: "IN_PROGRESS",
      detail: "미래 데이터 관찰 시작 2026-07-25 · 2027-07-25에 1년 결과 확인",
      guide: "규칙을 고정한 채 앞으로의 데이터에서 결과가 어떻게 나오는지 기록합니다.",
    },
    {
      id: "execution-dry-run",
      label: "세금·수수료·체결 조건 확인",
      status: "ACTION",
      detail: "주문 전 세금·환전·호가스프레드·수수료를 직접 입력해 확인",
      guide: "주문 기능 없이 수량과 예상 체결가격을 확인하고 사용자가 직접 결정합니다.",
    },
  ];

  if (profile === "CONTEST") {
    checks.push({
      id: "contest-rules",
      label: "투자대회 규정·평가식 확정",
      status: "ACTION",
      detail: "대회 규정 URL·허용시장·평가식·최초 선정 스냅샷 필요",
      guide: "대회 시작 전에 허용 종목과 평가식을 별도 규칙으로 저장합니다.",
    });
  }

  return {
    mode: "GUIDANCE",
    headline: "오늘의 데이터와 정책 기준을 함께 확인하세요",
    checkedAt: new Date().toISOString(),
    summary: {
      checked: checks.filter((check) => check.status === "CHECKED").length,
      review: checks.filter((check) => check.status === "REVIEW").length,
      inProgress: checks.filter(
        (check) => check.status === "IN_PROGRESS",
      ).length,
      limitedData: checks.filter(
        (check) => check.status === "LIMITED_DATA",
      ).length,
      action: checks.filter((check) => check.status === "ACTION").length,
      total: checks.length,
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
