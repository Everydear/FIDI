import assert from "node:assert/strict";
import test from "node:test";

import {
  buildValidationGuide,
  calculateConcentration,
  calculateRelativeStatistics,
  calculateWalkForwardStatistics,
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

test("scores a temporal holdout without looking into the test window", () => {
  const start = Date.UTC(2020, 0, 1);
  const portfolio = Array.from({ length: 900 }, (_, index) => ({
    date: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
    value: 100 * 1.001 ** index,
  }));
  const benchmark = Array.from({ length: 900 }, (_, index) => ({
    date: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
    value: 100 * 1.0005 ** index,
  }));

  const result = calculateWalkForwardStatistics(portfolio, benchmark, {
    minimumTrainObservations: 252,
    testWindow: 126,
  });

  assert.equal(result.status, "CHECKED");
  assert.ok(result.folds.length >= 2);
  assert.equal(result.folds[0].trainObservations, 252);
  assert.ok(result.meanExcessCagr > 0);
  assert.equal(result.validationMethod, "expanding-window-temporal-holdout-v2");
  assert.ok(result.confidenceInterval95.lower > 0);
  assert.ok(result.regimeBreakdown.some((regime) => regime.regime === "UP"));
  assert.equal(result.worstFold.regime, "UP");
});

test("turns validation evidence into a neutral operating guide", () => {
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

  const guidance = buildValidationGuide({
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

  assert.equal(guidance.mode, "GUIDANCE");
  assert.equal(
    guidance.checks.find((check) => check.id === "same-risk-benchmark").status,
    "REVIEW",
  );
  assert.equal(guidance.decision.grade, "LIMITED_DATA");
  assert.ok(guidance.summary.limitedData >= 1);
  assert.ok(guidance.summary.inProgress >= 2);
  assert.ok(guidance.summary.action >= 1);
  assert.equal(
    guidance.checks.find((check) => check.id === "forward-oos").status,
    "IN_PROGRESS",
  );
  assert.equal(
    guidance.checks.find((check) => check.id === "sample-length").status,
    "LIMITED_DATA",
  );
  assert.ok(
    guidance.checks.every(
      (check) => !["FAIL", "PENDING", "HOLD"].includes(check.status),
    ),
  );
});
