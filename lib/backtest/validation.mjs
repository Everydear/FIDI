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
    activeReturnMean: mean(activeReturns),
    activeHitRate: activeReturns.length
      ? activeReturns.filter((value) => value > 0).length / activeReturns.length
      : null,
    worstDailyActiveReturn: activeReturns.length
      ? Math.min(...activeReturns)
      : null,
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
  if (!weights.length) {
    return { maximumWeight: 0, herfindahlIndex: 0 };
  }
  return {
    maximumWeight: Math.max(...weights),
    herfindahlIndex: weights.reduce((sum, weight) => sum + weight ** 2, 0),
  };
}

function annualizedReturn(startValue, endValue, startDate, endDate) {
  const days = Math.max(
    1,
    (Date.parse(`${endDate}T00:00:00Z`) -
      Date.parse(`${startDate}T00:00:00Z`)) /
      86_400_000,
  );
  return (endValue / startValue) ** (365.25 / days) - 1;
}

/**
 * Temporal holdout validation. The strategy is never allowed to use prices
 * from the test window when the window is scored. This is a strict time split
 * check, not a claim that a future result is guaranteed.
 */
export function calculateWalkForwardStatistics(
  portfolioCurve,
  benchmarkCurve,
  { minimumTrainObservations = 252, testWindow = 63, maxFolds = 3 } = {},
) {
  const points = alignedCurves(portfolioCurve, benchmarkCurve);
  const folds = [];
  if (points.length < minimumTrainObservations + testWindow) {
    return {
      status: "LIMITED_DATA",
      alignedObservations: points.length,
      minimumTrainObservations,
      testWindow,
      folds,
      beatRate: null,
      meanExcessCagr: null,
      worstExcessCagr: null,
    };
  }

  const firstTrainEnd = Math.min(
    minimumTrainObservations,
    points.length - testWindow,
  );
  for (
    let trainEnd = firstTrainEnd;
    trainEnd + testWindow < points.length && folds.length < maxFolds;
    trainEnd += testWindow
  ) {
    const testStart = trainEnd;
    const testEnd = Math.min(points.length - 1, trainEnd + testWindow);
    const portfolioCagr = annualizedReturn(
      points[testStart].portfolio,
      points[testEnd].portfolio,
      points[testStart].date,
      points[testEnd].date,
    );
    const benchmarkCagr = annualizedReturn(
      points[testStart].benchmark,
      points[testEnd].benchmark,
      points[testStart].date,
      points[testEnd].date,
    );
    const testPoints = points.slice(testStart, testEnd + 1);
    const activeReturns = [];
    for (let index = 1; index < testPoints.length; index += 1) {
      activeReturns.push(
        testPoints[index].portfolio / testPoints[index - 1].portfolio -
          (testPoints[index].benchmark /
            testPoints[index - 1].benchmark -
            1),
      );
    }
    let peak = testPoints[0].portfolio;
    let maximumDrawdown = 0;
    for (const point of testPoints) {
      peak = Math.max(peak, point.portfolio);
      maximumDrawdown = Math.min(maximumDrawdown, point.portfolio / peak - 1);
    }
    folds.push({
      trainObservations: testStart,
      testObservations: testEnd - testStart + 1,
      testStart: points[testStart].date,
      testEnd: points[testEnd].date,
      portfolioCagr,
      benchmarkCagr,
      excessCagr: portfolioCagr - benchmarkCagr,
      activeHitRate: activeReturns.length
        ? activeReturns.filter((value) => value > 0).length /
          activeReturns.length
        : null,
      maximumDrawdown,
    });
    if (testEnd === points.length - 1) break;
  }

  const excess = folds.map((fold) => fold.excessCagr);
  const meanExcessCagr = excess.length
    ? excess.reduce((sum, value) => sum + value, 0) / excess.length
    : null;
  return {
    status:
      folds.length >= 3 &&
      meanExcessCagr !== null &&
      meanExcessCagr > 0 &&
      (excess.filter((value) => value > 0).length / excess.length >= 0.5) &&
      Math.min(...excess) > -0.05
        ? "CHECKED"
        : "REVIEW",
    alignedObservations: points.length,
    minimumTrainObservations,
    testWindow,
    folds,
    beatRate: excess.length
      ? excess.filter((value) => value > 0).length / excess.length
      : null,
    meanExcessCagr,
    worstExcessCagr: excess.length ? Math.min(...excess) : null,
  };
}

function buildDecision({ checks, period, walkForward }) {
  const criticalIds = [
    "official-price-audit",
    "same-risk-benchmark",
    "cost-stress",
    "subperiod-stability",
    "data-quality",
    "walk-forward-oos",
    "risk-limits",
  ];
  const criticalChecks = checks.filter((check) =>
    criticalIds.includes(check.id),
  );
  const reviewIds = criticalChecks
    .filter((check) => check.status !== "CHECKED")
    .map((check) => check.id);
  const limitedData =
    period.years < 3 || walkForward.status === "LIMITED_DATA";
  const grade = limitedData
    ? "LIMITED_DATA"
    : reviewIds.length === 0
      ? "ROBUST"
      : "MIXED";
  return {
    grade,
    label:
      grade === "ROBUST"
        ? "주요 검증 통과"
        : grade === "LIMITED_DATA"
          ? "데이터 한계 포함"
          : "추가 확인 필요",
    criticalChecks: criticalChecks.length,
    passedChecks: criticalChecks.filter((check) => check.status === "CHECKED")
      .length,
    reviewIds,
    detail:
      grade === "ROBUST"
        ? "공식 가격·기준 구성·비용 스트레스·시간 분할·위험 한도를 모두 확인했습니다."
        : grade === "LIMITED_DATA"
          ? "공통 가격 구간이나 OOS 관측치가 충분하지 않아 장기 성과 판단은 제한적입니다."
          : `핵심 검증 ${reviewIds.length}개 항목을 추가로 확인해야 합니다.`,
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
  walkForward,
  dataQuality,
  riskLimits,
  forwardObservationStart,
  earliestFormalReview,
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
  const walkForwardEvidence = walkForward ??
    calculateWalkForwardStatistics(result.fullCurve, policyBenchmark.fullCurve);
  const quality = dataQuality ?? result.dataQuality ?? {
    commonObservations: result.period.observations,
    totalMissingObservations: 0,
    maximumForwardFillObservations: 0,
    minimumCoverageRatio: 1,
    assets: [],
  };
  const limits = riskLimits ?? {
    maxSingleAssetWeight: 0.35,
    maxSingleAssetWeightLimit: 0.35,
    equityWeight: 0,
    maxEquityWeight: 1,
    maximumDrawdown: Math.abs(result.metrics.maximumDrawdown),
    maxDrawdown: 1,
    annualizedTurnover: result.metrics.annualizedTurnover,
    maxAnnualizedTurnover: Infinity,
  };
  const qualityStatus =
    quality.maximumForwardFillObservations <= 5 &&
    quality.minimumCoverageRatio >= 0.95
      ? "CHECKED"
      : "REVIEW";

  const checks = [
    {
      id: "official-price-audit",
      label: "KRX 최신 종가 확인",
      status:
        krxAudit.status === "verified" &&
        krxAudit.total > 0 &&
        krxAudit.matched === krxAudit.total &&
        krxAudit.maximumDifferencePercent !== null &&
        krxAudit.maximumDifferencePercent <= 0.5
          ? "CHECKED"
          : "REVIEW",
      detail:
        krxAudit.status === "verified"
          ? `${krxAudit.matched}/${krxAudit.total} 종목 · 최대 차이 ${krxAudit.maximumDifferencePercent?.toFixed(3) ?? "계산 불가"}%`
          : `KRX 공식 대조를 완료하지 못했습니다${krxAudit.error ? ` · ${krxAudit.error}` : ""}`,
      guide: "최근 공식 종가와 계산 가격의 차이를 주문 전에 다시 확인합니다. 대조가 불가능하면 보조 소스로 표시합니다.",
    },
    {
      id: "same-risk-benchmark",
      label: "기준 구성과 성과 비교",
      status:
        comparison.excessTotalReturn > 0 &&
        relative.informationRatio !== null &&
        relative.informationRatio > 0 &&
        (relative.activeHitRate ?? 0) >= 0.5 &&
        (relative.rollingBeatRate ?? 0) >= 0.5 &&
        walkForwardEvidence.status === "CHECKED"
          ? "CHECKED"
          : "REVIEW",
      detail: `연수익률 차이 ${(comparison.excessCagr * 100).toFixed(2)}%p · 일별 상회 ${(relative.activeHitRate === null ? 0 : relative.activeHitRate * 100).toFixed(1)}% · 안정성 점수 ${
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
      id: "data-quality",
      label: "가격 공백과 데이터 범위 확인",
      status: qualityStatus,
      detail: `공통 ${quality.commonObservations.toLocaleString()}개 · 누락 보정 ${quality.totalMissingObservations.toLocaleString()}개 · 최대 연속 ${quality.maximumForwardFillObservations}개`,
      guide: "휴장일은 직전 가격을 유지하지만, 긴 공백이나 낮은 수집률은 다시 확인합니다.",
    },
    {
      id: "walk-forward-oos",
      label: "기간을 나눈 OOS 홀드아웃",
      status: walkForwardEvidence.status,
      detail:
        walkForwardEvidence.meanExcessCagr === null
          ? `공통 ${walkForwardEvidence.alignedObservations.toLocaleString()}개로는 학습 ${walkForwardEvidence.minimumTrainObservations}개 + 검증 ${walkForwardEvidence.testWindow}개를 만들 수 없습니다.`
          : `${walkForwardEvidence.folds.length}개 검증 구간 · 상회 비율 ${(walkForwardEvidence.beatRate * 100).toFixed(1)}% · 평균 연수익률 차이 ${(walkForwardEvidence.meanExcessCagr * 100).toFixed(2)}%p`,
      guide: "후반부 가격을 미리 보지 않는 시간 분할 결과입니다. 미래 수익을 보장하지는 않습니다.",
    },
    {
      id: "risk-limits",
      label: "위험 한도와 조정 폭 확인",
      status:
        limits.maxSingleAssetWeight <= limits.maxSingleAssetWeightLimit &&
        limits.equityWeight <= limits.maxEquityWeight &&
        limits.maximumDrawdown <= limits.maxDrawdown &&
        limits.annualizedTurnover <= limits.maxAnnualizedTurnover
          ? "CHECKED"
          : "REVIEW",
      detail: `최대 종목 ${(limits.maxSingleAssetWeight * 100).toFixed(1)}% / 한도 ${(limits.maxSingleAssetWeightLimit * 100).toFixed(1)}% · 주식 위험 ${(limits.equityWeight * 100).toFixed(1)}% / 한도 ${(limits.maxEquityWeight * 100).toFixed(1)}%`,
      guide: "한 종목·주식 위험·낙폭·연간 교체 비율이 한도를 넘으면 비중 조정 여부를 검토합니다.",
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
      detail: `미래 데이터 관찰 시작 ${forwardObservationStart ?? new Date().toISOString().slice(0, 10)} · ${earliestFormalReview ?? "1년 후"}에 1년 결과 확인`,
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

  const decision = buildDecision({
    checks,
    period: result.period,
    walkForward: walkForwardEvidence,
  });

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
      walkForward: walkForwardEvidence,
      dataQuality: quality,
      riskLimits: limits,
    },
    decision,
    evidence: {
      researchUnitTests: 34,
      v3CombinedRows: 52_477,
      v3ReferenceObservations: 3_337,
      retrospectiveOutOfSample: walkForwardEvidence.status !== "LIMITED_DATA",
      forwardObservationStart:
        forwardObservationStart ?? new Date().toISOString().slice(0, 10),
      earliestFormalReview: earliestFormalReview ?? "1년 후",
      walkForward: walkForwardEvidence,
    },
    checks,
  };
}
