import assert from "node:assert/strict";
import test from "node:test";

import { parseKrxClosingPrices } from "../lib/backtest/krx.mjs";

test("parses the current KRX ISU_CD daily-market schema", () => {
  const prices = parseKrxClosingPrices([
    { ISU_CD: "360750", TDD_CLSPRC: "26,965" },
    { ISU_CD: "105560", TDD_CLSPRC: "171500" },
  ]);

  assert.equal(prices.get("360750"), 26_965);
  assert.equal(prices.get("105560"), 171_500);
});

test("keeps compatibility with the former KRX short-code field", () => {
  const prices = parseKrxClosingPrices([
    { ISU_SRT_CD: "005380", TDD_CLSPRC: 266_500 },
  ]);

  assert.equal(prices.get("005380"), 266_500);
});
