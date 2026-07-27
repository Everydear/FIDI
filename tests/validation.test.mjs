import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLiveReadiness,
  calculateConcentration,
  calculateRelativeStatistics,
} from "../lib/backtest/validation.mjs";

function curve(values) {
  return values.map((value, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, "0")}`,
    value,
    drawdown: 0,
  }));
}

test("calculates active risk and rolling benchmark win rate on aligned dates", () => {
  const statistics = calculateRelativeStatistics(
    curve([1, 1.02, 1.05, 1.08, 1.12]),
    curve([1, 1.01, 1.02, 1.03, 1.04]),
    2,
  );

  assert.ok(statistics.informationRatio > 0);
  assert.deepEqual(
    statistics.halfExcessReturns.map((value) => value > 0),
    [true, true],
  );
  assert.equal(statistics.rollingWindows, 3);
  assert.equal(statistics.rollingBeatRate, 1);
});

test("reports maximum holding and Herfindahl concentration", () => {
  const concentration = calculateConcentration([0.5, 0.3, 0.2]);
  assert.equal(concentration.maximumWeight, 0.5);
  assert.ok(Math.abs(concentration.herfindahlIndex - 0.38) < 1e-12);
});

test("holds live capital when policy and forward-OOS gates are incomplete", () => {
  const result = {
    period: { years: 2, observations: 5 },
    metrics: {
      totalReturn: 0.12,
      cagr: 0.06,
      maximumDrawdown: -0.08,
    },
    fullCurve: curve([1, 1.02, 1.05, 1.08, 1.12]),
  };
  const policyBenchmark = {
    metrics: {
      totalReturn: 0.04,
      cagr: 0.02,
      maximumDrawdown: -0.09,
    },
    fullCurve: curve([1, 1.01, 1.02, 1.03, 1.04]),
  };

  const readiness = buildLiveReadiness({
    profile: "MODERATE",
    result,
    policyBenchmark,
    costStress: {
      result: { metrics: { cagr: 0.05 } },
      policyBenchmark: { metrics: { cagr: 0.019 } },
    },
    delayedStart: {
      result: { metrics: { cagr: 0.055 } },
      policyBenchmark: { metrics: { cagr: 0.02 } },
    },
    alternateCadence: {
      cadence: "monthly",
      result: { metrics: { cagr: 0.058 } },
      policyBenchmark: { metrics: { cagr: 0.02 } },
    },
    currentWeights: { market: 25 },
    lockedWeights: { market: 35 },
    currentCadence: "quarterly",
    lockedCadence: "quarterly",
    krxAudit: {
      matched: 6,
      total: 6,
      maximumDifferencePercent: 0.1,
    },
    assetWeights: [0.5, 0.3, 0.2],
  });

  assert.equal(readiness.verdict, "HOLD");
  assert.equal(readiness.readyForLiveCapital, false);
  assert.ok(readiness.summary.failed >= 2);
  assert.ok(readiness.summary.pending >= 3);
  assert.equal(
    readiness.checks.find((check) => check.id === "forward-oos").status,
    "PENDING",
  );
});
