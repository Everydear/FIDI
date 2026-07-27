/**
 * @typedef {{
 *   ISU_CD?: string;
 *   ISU_SRT_CD?: string;
 *   TDD_CLSPRC?: string | number;
 * }} KrxClosingPriceRow
 */

/**
 * KRX changed the daily-market code field from ISU_SRT_CD to ISU_CD in the
 * 2026 response schema. Accept both names so older and current payloads audit
 * against the same six-digit ticker.
 *
 * @param {KrxClosingPriceRow[]} rows
 * @returns {Map<string, number>}
 */
export function parseKrxClosingPrices(rows) {
  const prices = new Map();

  for (const row of rows) {
    const code = row.ISU_SRT_CD ?? row.ISU_CD;
    const value =
      typeof row.TDD_CLSPRC === "string"
        ? Number(row.TDD_CLSPRC.replaceAll(",", ""))
        : Number(row.TDD_CLSPRC);

    if (code && Number.isFinite(value) && value > 0) {
      prices.set(code, value);
    }
  }

  return prices;
}
