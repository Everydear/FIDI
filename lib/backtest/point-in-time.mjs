import { analyzeSeries } from "./daily-guide.mjs";

function assertWeightTotal(weights) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (Math.abs(total - 1) > 1e-8) {
    throw new Error(`시점별 목표 비중 합계가 1이 아닙니다 (${total}).`);
  }
}

function latestCandidate(candidate, asOf) {
  const points = candidate.prices.filter((point) => point.date <= asOf);
  const analysis = analyzeSeries(points, asOf);
  return {
    ...candidate,
    ...analysis,
  };
}

/**
 * Builds a target-weight callback that only uses observations available on
 * the rebalance date. The callback is intentionally independent from the
 * portfolio engine so its decisions can be inspected and tested separately.
 */
export function createPointInTimeSelector({
  fixedWeights,
  groups,
  groupWeights,
}) {
  const fixedEntries = Object.entries(fixedWeights);
  return (date, { assets }) => {
    const targetByTicker = new Map(fixedEntries);
    const selected = [];

    for (const group of groups) {
      const weight = groupWeights[group.id] ?? 0;
      if (weight <= 0) continue;
      const ranked = group.candidates
        .map((candidate) => latestCandidate(candidate, date))
        .sort((left, right) => {
          if (right.score !== left.score) return right.score - left.score;
          return left.ticker.localeCompare(right.ticker);
        });
      const leader = ranked[0];
      if (!leader) {
        throw new Error(`시점별 후보가 없습니다 (${group.id}, ${date}).`);
      }
      targetByTicker.set(leader.ticker, weight);
      selected.push({
        groupId: group.id,
        ticker: leader.ticker,
        name: leader.name,
        score: leader.score,
        scoreBreakdown: leader.scoreBreakdown,
        latestDate: leader.latestDate,
      });
    }

    const weights = assets.map((asset) => targetByTicker.get(asset.id) ?? 0);
    assertWeightTotal(weights);
    return { weights, selected };
  };
}

export function selectionWarmupDate(groups, minimumObservations = 61) {
  const dates = groups.flatMap((group) =>
    group.candidates.map((candidate) =>
      candidate.prices
        .slice()
        .sort((left, right) => left.date.localeCompare(right.date))
        .at(minimumObservations - 1)?.date,
    ),
  );
  if (dates.some((date) => !date)) {
    throw new Error(
      `시점별 후보 백테스트에 필요한 ${minimumObservations}개 관측치가 부족합니다.`,
    );
  }
  return dates.sort().at(-1);
}
