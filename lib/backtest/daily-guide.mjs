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

export function analyzeSeries(points, asOf) {
  const prices = points.filter((point) => point.date <= asOf);
  if (prices.length < 61) {
    throw new Error("일일 운용 가이드에는 최소 61개 가격 관측치가 필요합니다.");
  }

  const latest = prices.at(-1);
  const return20 = latest.value / prices.at(-21).value - 1;
  const return60 = latest.value / prices.at(-61).value - 1;
  const recentReturns = [];
  for (let index = prices.length - 20; index < prices.length; index += 1) {
    recentReturns.push(prices[index].value / prices[index - 1].value - 1);
  }
  const volatility20 =
    sampleStandardDeviation(recentReturns) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  const recent60 = prices.slice(-61).map((point) => point.value);
  const drawdown60 = latest.value / Math.max(...recent60) - 1;
  const movingAverage20 = mean(
    prices.slice(-20).map((point) => point.value),
  );
  const score =
    0.45 * return60 +
    0.35 * return20 -
    0.2 * volatility20 +
    (latest.value >= movingAverage20 ? 0.01 : -0.01);

  return {
    latestDate: latest.date,
    latestValue: latest.value,
    return20,
    return60,
    volatility20,
    drawdown60,
    aboveMovingAverage20: latest.value >= movingAverage20,
    score,
  };
}

export function buildDailyGuide({
  profile,
  groups,
  transactionCostBps,
  slippageBps = 0,
  taxBps = 0,
  rebalanceBand = 0,
}) {
  const latestDates = groups.flatMap((group) =>
    group.candidates.map((candidate) => candidate.prices.at(-1)?.date),
  );
  if (latestDates.some((date) => !date)) {
    throw new Error("일일 후보군의 최신 가격일을 확인할 수 없습니다.");
  }
  const asOf = latestDates.sort().at(0);
  const switchThreshold = profile === "CONTEST" ? 0.02 : 0.03;

  const evaluatedGroups = groups.map((group) => {
    const candidates = group.candidates
      .map((candidate) => ({
        ticker: candidate.ticker,
        name: candidate.name,
        current: candidate.current,
        ...analyzeSeries(candidate.prices, asOf),
      }))
      .sort((left, right) => right.score - left.score)
      .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
    const leader = candidates[0];
    const current =
      candidates.filter((candidate) => candidate.current)[0] ?? leader;
    const scoreAdvantage = leader.score - current.score;
    const action =
      !leader.current && scoreAdvantage >= switchThreshold
        ? "REVIEW_CHANGE"
        : "MAINTAIN";

    return {
      id: group.id,
      name: group.name,
      action,
      actionLabel:
        action === "REVIEW_CHANGE" ? "교체 비교" : "현재 구성 유지",
      leaderTicker: leader.ticker,
      leaderName: leader.name,
      currentTicker: current.ticker,
      currentName: current.name,
      scoreAdvantage,
      reason:
        action === "REVIEW_CHANGE"
          ? `후보 1위가 현재 편입보다 점수 우위 ${(scoreAdvantage * 100).toFixed(2)}%p`
          : `현재 편입 유지 또는 교체 우위가 기준 ${(switchThreshold * 100).toFixed(1)}%p 미만`,
      candidates,
    };
  });

  const reviewCount = evaluatedGroups.filter(
    (group) => group.action === "REVIEW_CHANGE",
  ).length;

  return {
    version: "KRW-V4.1-DAILY-20260727",
    asOf,
    profile,
    evaluationCadence: "daily",
    switchThreshold,
    transactionCostBps,
    slippageBps,
    taxBps,
    executionCostBps: transactionCostBps + slippageBps + taxBps,
    rebalanceBand,
    headline:
      reviewCount > 0
        ? `${reviewCount}개 그룹의 교체 후보를 비교해 보세요`
        : "오늘은 현재 구성을 유지하는 쪽이 우선입니다",
    summary: {
      groups: evaluatedGroups.length,
      maintain: evaluatedGroups.length - reviewCount,
      reviewChange: reviewCount,
    },
    executionGuide: [
      "장 마감 데이터로 후보 점수와 현재 편입의 차이를 확인합니다.",
      "교체 비교가 표시되면 상품명·티커·시장 거래 가능 여부를 다시 확인합니다.",
      `예상 실행비용 ${transactionCostBps + slippageBps + taxBps}bp(거래수수료·슬리피지·세금)를 포함해 순효과를 계산합니다.`,
      `목표 비중에서 ${(rebalanceBand * 100).toFixed(1)}%p 이상 벗어났는지 확인하고, 작은 차이는 불필요하게 교체하지 않습니다.`,
      "최종 실행 여부와 수량은 사용자가 가격·비용을 확인한 뒤 직접 결정합니다.",
    ],
    dataNotice:
      "가격 이력 범위가 짧은 상품은 장기 확신보다 오늘의 상대 비교에 활용합니다.",
    groups: evaluatedGroups,
  };
}
