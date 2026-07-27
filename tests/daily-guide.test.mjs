import assert from "node:assert/strict";
import test from "node:test";

import { buildDailyGuide } from "../lib/backtest/daily-guide.mjs";

function series(rate, length = 65) {
  const start = Date.UTC(2026, 0, 1);
  return Array.from({ length }, (_, index) => ({
    date: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
    value: 100 * (1 + rate) ** index,
  }));
}

test("compares candidates daily and only flags a material score advantage", () => {
  const guide = buildDailyGuide({
    profile: "MODERATE",
    transactionCostBps: 20,
    groups: [
      {
        id: "ai",
        name: "AI·반도체",
        candidates: [
          {
            ticker: "CURRENT",
            name: "현재 편입",
            current: true,
            prices: series(0),
          },
          {
            ticker: "ALT",
            name: "대안 후보",
            current: false,
            prices: series(0.01),
          },
        ],
      },
      {
        id: "healthcare",
        name: "헬스케어",
        candidates: [
          {
            ticker: "CURRENT-2",
            name: "현재 편입 2",
            current: true,
            prices: series(0.006),
          },
          {
            ticker: "ALT-2",
            name: "대안 후보 2",
            current: false,
            prices: series(0.005),
          },
        ],
      },
    ],
  });

  assert.equal(guide.evaluationCadence, "daily");
  assert.equal(guide.orderMode, "manual-approval");
  assert.equal(guide.switchThreshold, 0.03);
  assert.equal(guide.summary.reviewChange, 1);
  assert.equal(guide.groups[0].action, "REVIEW_CHANGE");
  assert.equal(guide.groups[0].leaderTicker, "ALT");
  assert.equal(guide.groups[1].action, "MAINTAIN");
  assert.equal(guide.groups[1].currentTicker, "CURRENT-2");
});

test("uses a lower comparison threshold for the contest profile", () => {
  const guide = buildDailyGuide({
    profile: "CONTEST",
    transactionCostBps: 30,
    groups: [
      {
        id: "strategy",
        name: "전략 ETF",
        candidates: [
          {
            ticker: "CURRENT",
            name: "현재 편입",
            current: true,
            prices: series(0),
          },
          {
            ticker: "ALT",
            name: "대안 후보",
            current: false,
            prices: series(0.001),
          },
        ],
      },
    ],
  });

  assert.equal(guide.switchThreshold, 0.02);
  assert.equal(guide.groups[0].action, "REVIEW_CHANGE");
});
