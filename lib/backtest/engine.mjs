const DAYS_PER_YEAR = 365.25;
const TRADING_DAYS_PER_YEAR = 252;

function assertFinitePositive(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`);
  }
}

function mean(values) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function sampleStandardDeviation(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

function scheduleKey(date, cadence) {
  if (cadence === "monthly") return date.slice(0, 7);
  if (cadence === "quarterly") {
    const month = Number(date.slice(5, 7));
    return `${date.slice(0, 4)}-Q${Math.floor((month - 1) / 3) + 1}`;
  }
  if (cadence === "weekly") {
    const current = new Date(`${date}T00:00:00Z`);
    const day = current.getUTCDay() || 7;
    current.setUTCDate(current.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));
    const week = Math.ceil(
      ((current.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
    );
    return `${current.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  throw new Error(`Unsupported rebalance cadence: ${cadence}`);
}

function prepareMatrix(assets) {
  if (!Array.isArray(assets) || assets.length === 0) {
    throw new Error("At least one asset is required");
  }

  const totalWeight = assets.reduce((sum, asset) => sum + asset.weight, 0);
  if (Math.abs(totalWeight - 1) > 1e-8) {
    throw new Error(`Target weights must sum to 1, received ${totalWeight}`);
  }

  const normalized = assets.map((asset) => {
    if (!asset.id || !Array.isArray(asset.prices) || asset.prices.length < 2) {
      throw new Error(`Asset ${asset.id || "(unknown)"} has insufficient prices`);
    }
    const prices = new Map();
    for (const point of asset.prices) {
      assertFinitePositive(point.value, `${asset.id} price on ${point.date}`);
      prices.set(point.date, point.value);
    }
    const dates = [...prices.keys()].sort();
    return {
      ...asset,
      prices,
      firstDate: dates[0],
      lastDate: dates.at(-1),
    };
  });

  const startDate = normalized
    .map((asset) => asset.firstDate)
    .sort()
    .at(-1);
  const endDate = normalized
    .map((asset) => asset.lastDate)
    .sort()
    .at(0);
  const dates = [
    ...new Set(
      normalized.flatMap((asset) =>
        [...asset.prices.keys()].filter(
          (date) => date >= startDate && date <= endDate,
        ),
      ),
    ),
  ].sort();

  if (dates.length < 2) {
    throw new Error("The assets do not share a usable date range");
  }

  const lastValues = new Map(
    normalized.map((asset) => {
      const priorDate = [...asset.prices.keys()]
        .filter((date) => date <= startDate)
        .sort()
        .at(-1);
      return [asset.id, priorDate ? asset.prices.get(priorDate) : undefined];
    }),
  );
  const matrix = [];
  for (const date of dates) {
    const row = [];
    for (const asset of normalized) {
      const exactValue = asset.prices.get(date);
      if (exactValue !== undefined) lastValues.set(asset.id, exactValue);
      const value = lastValues.get(asset.id);
      if (value === undefined) {
        throw new Error(`Missing ${asset.id} price at common start ${date}`);
      }
      row.push(value);
    }
    matrix.push(row);
  }

  return { assets: normalized, dates, matrix, startDate, endDate };
}

function calculateWinningMonths(curve) {
  const monthEnds = [];
  for (const point of curve) {
    const month = point.date.slice(0, 7);
    const previous = monthEnds.at(-1);
    if (previous?.month === month) {
      previous.value = point.value;
    } else {
      monthEnds.push({ month, value: point.value });
    }
  }

  let wins = 0;
  let comparisons = 0;
  for (let index = 1; index < monthEnds.length; index += 1) {
    comparisons += 1;
    if (monthEnds[index].value > monthEnds[index - 1].value) wins += 1;
  }
  return comparisons ? wins / comparisons : 0;
}

function compactCurve(curve, maximumPoints = 180) {
  if (curve.length <= maximumPoints) return curve;
  const result = [];
  const stride = (curve.length - 1) / (maximumPoints - 1);
  for (let index = 0; index < maximumPoints; index += 1) {
    result.push(curve[Math.round(index * stride)]);
  }
  return result;
}

/**
 * Runs a long-only, total-return backtest with calendar rebalancing.
 * Prices must already be expressed in the same base currency.
 */
export function runBacktest({
  assets,
  cadence = "quarterly",
  transactionCostBps = 15,
  annualRiskFreeRate = 0,
}) {
  const prepared = prepareMatrix(assets);
  const targetWeights = prepared.assets.map((asset) => asset.weight);
  let weights = [...targetWeights];
  let nav = 1;
  let peak = 1;
  let maximumDrawdown = 0;
  let totalTurnover = 0;
  let cumulativeCost = 0;
  let rebalances = 0;
  const dailyReturns = [];
  const curve = [{ date: prepared.dates[0], value: nav, drawdown: 0 }];
  let previousSchedule = scheduleKey(prepared.dates[0], cadence);

  for (let day = 1; day < prepared.dates.length; day += 1) {
    const assetReturns = prepared.matrix[day].map(
      (value, index) => value / prepared.matrix[day - 1][index] - 1,
    );
    const grossReturn = weights.reduce(
      (sum, weight, index) => sum + weight * assetReturns[index],
      0,
    );
    const navBeforeCost = nav * (1 + grossReturn);

    weights = weights.map(
      (weight, index) => (weight * (1 + assetReturns[index])) / (1 + grossReturn),
    );
    nav = navBeforeCost;

    const currentSchedule = scheduleKey(prepared.dates[day], cadence);
    if (currentSchedule !== previousSchedule) {
      const turnover =
        weights.reduce(
          (sum, weight, index) => sum + Math.abs(targetWeights[index] - weight),
          0,
        ) / 2;
      const costRate = turnover * (transactionCostBps / 10_000);
      const cost = nav * costRate;
      nav -= cost;
      cumulativeCost += cost;
      totalTurnover += turnover;
      weights = [...targetWeights];
      rebalances += 1;
      previousSchedule = currentSchedule;
    }

    const netReturn = nav / curve.at(-1).value - 1;
    dailyReturns.push(netReturn);
    peak = Math.max(peak, nav);
    const drawdown = nav / peak - 1;
    maximumDrawdown = Math.min(maximumDrawdown, drawdown);
    curve.push({
      date: prepared.dates[day],
      value: nav,
      drawdown,
    });
  }

  const elapsedDays = Math.max(
    1,
    (Date.parse(prepared.endDate) - Date.parse(prepared.startDate)) / 86_400_000,
  );
  const elapsedYears = elapsedDays / DAYS_PER_YEAR;
  const totalReturn = nav - 1;
  const cagr = nav ** (1 / elapsedYears) - 1;
  const annualVolatility =
    sampleStandardDeviation(dailyReturns) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  const sharpe =
    annualVolatility > 0
      ? (cagr - annualRiskFreeRate) / annualVolatility
      : null;

  return {
    period: {
      start: prepared.startDate,
      end: prepared.endDate,
      calendarDays: Math.round(elapsedDays),
      years: elapsedYears,
      observations: prepared.dates.length,
    },
    metrics: {
      totalReturn,
      cagr,
      annualVolatility,
      maximumDrawdown,
      sharpe,
      winningMonths: calculateWinningMonths(curve),
      endingValue: nav,
      totalTurnover,
      annualizedTurnover: totalTurnover / elapsedYears,
      cumulativeCost,
      rebalances,
    },
    curve: compactCurve(curve),
    fullCurve: curve,
  };
}
