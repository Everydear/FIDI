export type BacktestProfileCode =
  | "CONSERVATIVE"
  | "MODERATE_CONSERVATIVE"
  | "MODERATE"
  | "GROWTH"
  | "CONTEST";

export type BacktestAsset = {
  id: string;
  name: string;
  yahooSymbol: string;
  currency: "KRW" | "USD";
  market: "KRX" | "US";
  krxDataset?: "stock" | "etf";
  sleeve: Sleeve;
  weight: number;
};

export type Sleeve =
  | "market"
  | "strategy"
  | "stocks"
  | "government"
  | "credit"
  | "alternative"
  | "cash";

export type SleeveWeights = {
  market: number;
  strategy: number;
  stocks: number;
  government: number;
  credit: number;
  alternative: number;
  cash: number;
};

export type RebalanceCadence = "weekly" | "monthly" | "quarterly";

const PROFILE_WEIGHTS: Record<BacktestProfileCode, SleeveWeights> = {
  CONSERVATIVE: {
    market: 10,
    strategy: 5,
    stocks: 5,
    government: 45,
    credit: 20,
    alternative: 5,
    cash: 10,
  },
  MODERATE_CONSERVATIVE: {
    market: 20,
    strategy: 10,
    stocks: 10,
    government: 30,
    credit: 15,
    alternative: 5,
    cash: 10,
  },
  MODERATE: {
    market: 25,
    strategy: 15,
    stocks: 20,
    government: 20,
    credit: 10,
    alternative: 5,
    cash: 5,
  },
  GROWTH: {
    market: 30,
    strategy: 20,
    stocks: 30,
    government: 10,
    credit: 5,
    alternative: 3,
    cash: 2,
  },
  CONTEST: {
    market: 10,
    strategy: 30,
    stocks: 50,
    government: 0,
    credit: 0,
    alternative: 0,
    cash: 10,
  },
};

const LOCKED_PROFILE_WEIGHTS: Record<BacktestProfileCode, SleeveWeights> = {
  CONSERVATIVE: {
    market: 15,
    strategy: 3,
    stocks: 2,
    government: 45.5,
    credit: 19.5,
    alternative: 5,
    cash: 10,
  },
  MODERATE_CONSERVATIVE: {
    market: 25,
    strategy: 7,
    stocks: 3,
    government: 38.5,
    credit: 16.5,
    alternative: 5,
    cash: 5,
  },
  MODERATE: {
    market: 35,
    strategy: 10,
    stocks: 5,
    government: 28,
    credit: 12,
    alternative: 7,
    cash: 3,
  },
  GROWTH: {
    market: 50,
    strategy: 15,
    stocks: 5,
    government: 14,
    credit: 6,
    alternative: 7,
    cash: 3,
  },
  CONTEST: {
    market: 10,
    strategy: 30,
    stocks: 50,
    government: 0,
    credit: 0,
    alternative: 0,
    cash: 10,
  },
};

const ASSETS = {
  market: {
    id: "360750",
    name: "TIGER 미국S&P500",
    yahooSymbol: "360750.KS",
    currency: "KRW" as const,
    market: "KRX" as const,
    krxDataset: "etf" as const,
    sleeve: "market" as const,
  },
  strategy: {
    id: "133690",
    name: "TIGER 미국나스닥100",
    yahooSymbol: "133690.KS",
    currency: "KRW" as const,
    market: "KRX" as const,
    krxDataset: "etf" as const,
    sleeve: "strategy" as const,
  },
  contestStrategy: {
    id: "381170",
    name: "TIGER 미국테크TOP10 INDXX",
    yahooSymbol: "381170.KS",
    currency: "KRW" as const,
    market: "KRX" as const,
    krxDataset: "etf" as const,
    sleeve: "strategy" as const,
  },
  stocks: [
    {
      id: "NVDA",
      name: "NVIDIA Corporation",
      yahooSymbol: "NVDA",
      currency: "USD" as const,
      market: "US" as const,
      sleeve: "stocks" as const,
    },
    {
      id: "JNJ",
      name: "Johnson & Johnson",
      yahooSymbol: "JNJ",
      currency: "USD" as const,
      market: "US" as const,
      sleeve: "stocks" as const,
    },
    {
      id: "WMT",
      name: "Walmart Inc.",
      yahooSymbol: "WMT",
      currency: "USD" as const,
      market: "US" as const,
      sleeve: "stocks" as const,
    },
    {
      id: "005380",
      name: "현대자동차(주)",
      yahooSymbol: "005380.KS",
      currency: "KRW" as const,
      market: "KRX" as const,
      krxDataset: "stock" as const,
      sleeve: "stocks" as const,
    },
    {
      id: "105560",
      name: "(주)KB금융지주",
      yahooSymbol: "105560.KS",
      currency: "KRW" as const,
      market: "KRX" as const,
      krxDataset: "stock" as const,
      sleeve: "stocks" as const,
    },
  ],
  government: {
    id: "114820",
    name: "TIGER 국채3년",
    yahooSymbol: "114820.KS",
    currency: "KRW" as const,
    market: "KRX" as const,
    krxDataset: "etf" as const,
    sleeve: "government" as const,
  },
  credit: {
    id: "273130",
    name: "KODEX 종합채권(AA-이상) 액티브",
    yahooSymbol: "273130.KS",
    currency: "KRW" as const,
    market: "KRX" as const,
    krxDataset: "etf" as const,
    sleeve: "credit" as const,
  },
  alternative: {
    id: "132030",
    name: "KODEX 골드선물(H)",
    yahooSymbol: "132030.KS",
    currency: "KRW" as const,
    market: "KRX" as const,
    krxDataset: "etf" as const,
    sleeve: "alternative" as const,
  },
  cash: {
    id: "488770",
    name: "KODEX 머니마켓액티브",
    yahooSymbol: "488770.KS",
    currency: "KRW" as const,
    market: "KRX" as const,
    krxDataset: "etf" as const,
    sleeve: "cash" as const,
  },
};

function weighted(
  asset: Omit<BacktestAsset, "weight">,
  percent: number,
): BacktestAsset {
  return { ...asset, weight: percent / 100 };
}

export function isBacktestProfileCode(
  value: string | null,
): value is BacktestProfileCode {
  return Boolean(value && value in PROFILE_WEIGHTS);
}

export function getBacktestCadence(
  profile: BacktestProfileCode,
): RebalanceCadence {
  if (profile === "CONTEST") return "weekly";
  if (profile === "GROWTH") return "monthly";
  return "quarterly";
}

export function getLockedCadence(
  profile: BacktestProfileCode,
): RebalanceCadence {
  return profile === "CONTEST" ? "weekly" : "quarterly";
}

export function getProfileWeights(
  profile: BacktestProfileCode,
): SleeveWeights {
  return { ...PROFILE_WEIGHTS[profile] };
}

export function getLockedProfileWeights(
  profile: BacktestProfileCode,
): SleeveWeights {
  return { ...LOCKED_PROFILE_WEIGHTS[profile] };
}

export function getBacktestAssets(
  profile: BacktestProfileCode,
): BacktestAsset[] {
  const weights = PROFILE_WEIGHTS[profile];
  const assets: BacktestAsset[] = [weighted(ASSETS.market, weights.market)];

  if (profile === "CONTEST") {
    assets.push(
      weighted(ASSETS.strategy, weights.strategy / 2),
      weighted(ASSETS.contestStrategy, weights.strategy / 2),
    );
  } else {
    assets.push(weighted(ASSETS.strategy, weights.strategy));
  }

  const stockWeight = weights.stocks / ASSETS.stocks.length;
  assets.push(...ASSETS.stocks.map((asset) => weighted(asset, stockWeight)));

  for (const key of [
    "government",
    "credit",
    "alternative",
    "cash",
  ] as const) {
    if (weights[key] > 0) assets.push(weighted(ASSETS[key], weights[key]));
  }

  return assets.filter((asset) => asset.weight > 0);
}
