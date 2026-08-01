import assert from "node:assert/strict";
import test from "node:test";

import { runBacktest } from "../lib/backtest/engine.mjs";
import { createPointInTimeSelector } from "../lib/backtest/point-in-time.mjs";

function dailyPoints(buildValue, count = 75) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(2025, 0, 1 + index))
      .toISOString()
      .slice(0, 10);
    return { date, value: buildValue(index) };
  });
}

test("compounds adjusted prices without look-ahead", () => {
  const result = runBacktest({
    assets: [
      {
        id: "A",
        weight: 1,
        prices: [
          { date: "2026-01-02", value: 100 },
          { date: "2026-01-05", value: 110 },
          { date: "2026-01-06", value: 121 },
        ],
      },
    ],
    cadence: "quarterly",
    transactionCostBps: 0,
    annualRiskFreeRate: 0,
  });

  assert.ok(Math.abs(result.metrics.totalReturn - 0.21) < 1e-12);
  assert.equal(result.metrics.maximumDrawdown, 0);
  assert.equal(result.metrics.rebalances, 0);
  assert.equal(result.period.observations, 3);
  assert.equal(result.fullCurve.length, 3);
});

test("forward-fills non-overlapping market holidays after common inception", () => {
  const result = runBacktest({
    assets: [
      {
        id: "KR",
        weight: 0.5,
        prices: [
          { date: "2026-01-02", value: 100 },
          { date: "2026-01-06", value: 110 },
        ],
      },
      {
        id: "US",
        weight: 0.5,
        prices: [
          { date: "2026-01-05", value: 200 },
          { date: "2026-01-06", value: 200 },
        ],
      },
    ],
    cadence: "quarterly",
    transactionCostBps: 0,
    annualRiskFreeRate: 0,
  });

  assert.equal(result.period.start, "2026-01-05");
  assert.ok(Math.abs(result.metrics.totalReturn - 0.05) < 1e-12);
});

test("charges transaction costs only on scheduled rebalance turnover", () => {
  const noCost = runBacktest({
    assets: [
      {
        id: "A",
        weight: 0.5,
        prices: [
          { date: "2026-01-30", value: 100 },
          { date: "2026-02-02", value: 120 },
        ],
      },
      {
        id: "B",
        weight: 0.5,
        prices: [
          { date: "2026-01-30", value: 100 },
          { date: "2026-02-02", value: 100 },
        ],
      },
    ],
    cadence: "monthly",
    transactionCostBps: 0,
    annualRiskFreeRate: 0,
  });
  const withCost = runBacktest({
    assets: [
      {
        id: "A",
        weight: 0.5,
        prices: [
          { date: "2026-01-30", value: 100 },
          { date: "2026-02-02", value: 120 },
        ],
      },
      {
        id: "B",
        weight: 0.5,
        prices: [
          { date: "2026-01-30", value: 100 },
          { date: "2026-02-02", value: 100 },
        ],
      },
    ],
    cadence: "monthly",
    transactionCostBps: 100,
    annualRiskFreeRate: 0,
  });

  assert.equal(withCost.metrics.rebalances, 1);
  assert.ok(withCost.metrics.totalTurnover > 0);
  assert.ok(withCost.metrics.endingValue < noCost.metrics.endingValue);
  assert.ok(withCost.metrics.cumulativeCost > 0);
});

test("separates slippage and skips tiny scheduled rebalances", () => {
  const result = runBacktest({
    assets: [
      {
        id: "A",
        weight: 0.5,
        prices: [
          { date: "2026-01-30", value: 100 },
          { date: "2026-02-02", value: 101 },
        ],
      },
      {
        id: "B",
        weight: 0.5,
        prices: [
          { date: "2026-01-30", value: 100 },
          { date: "2026-02-02", value: 100 },
        ],
      },
    ],
    cadence: "monthly",
    transactionCostBps: 100,
    slippageBps: 50,
    rebalanceBand: 0.05,
    annualRiskFreeRate: 0,
  });

  assert.equal(result.metrics.rebalances, 0);
  assert.equal(result.metrics.skippedRebalances, 1);
  assert.equal(result.metrics.cumulativeSlippageCost, 0);
  assert.equal(result.metrics.executionCostBps, 150);
  assert.equal(result.dataQuality.totalMissingObservations, 0);
});

test("point-in-time selector never uses prices after the decision date", () => {
  const candidates = [
    {
      ticker: "STABLE",
      name: "Stable candidate",
      prices: dailyPoints((index) => 100 + index * 0.2),
    },
    {
      ticker: "SPIKE",
      name: "Later spike candidate",
      prices: dailyPoints((index) => (index < 65 ? 100 + index * 0.05 : 300)),
    },
  ];
  const selector = createPointInTimeSelector({
    fixedWeights: { CASH: 0.5 },
    groups: [{ id: "stocks", candidates }],
    groupWeights: { stocks: 0.5 },
  });
  const assets = ["CASH", "STABLE", "SPIKE"].map((id) => ({ id }));
  const beforeSpike = selector("2025-03-02", { assets });
  const afterSpike = selector("2025-03-15", { assets });

  assert.equal(beforeSpike.selected[0].ticker, "STABLE");
  assert.equal(afterSpike.selected[0].ticker, "SPIKE");
});
