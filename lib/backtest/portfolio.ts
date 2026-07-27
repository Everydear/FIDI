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
  eodhdSymbol: string;
  currency: "KRW" | "USD";
  weight: number;
};

type SleeveWeights = {
  market: number;
  strategy: number;
  stocks: number;
  government: number;
  credit: number;
  alternative: number;
  cash: number;
};

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

const ASSETS = {
  market: {
    id: "360750",
    name: "TIGER 미국S&P500",
    yahooSymbol: "360750.KS",
    eodhdSymbol: "360750.KO",
    currency: "KRW" as const,
  },
  strategy: {
    id: "133690",
    name: "TIGER 미국나스닥100",
    yahooSymbol: "133690.KS",
    eodhdSymbol: "133690.KO",
    currency: "KRW" as const,
  },
  contestStrategy: {
    id: "381170",
    name: "TIGER 미국테크TOP10 INDXX",
    yahooSymbol: "381170.KS",
    eodhdSymbol: "381170.KO",
    currency: "KRW" as const,
  },
  stocks: [
    {
      id: "NVDA",
      name: "NVIDIA Corporation",
      yahooSymbol: "NVDA",
      eodhdSymbol: "NVDA.US",
      currency: "USD" as const,
    },
    {
      id: "JNJ",
      name: "Johnson & Johnson",
      yahooSymbol: "JNJ",
      eodhdSymbol: "JNJ.US",
      currency: "USD" as const,
    },
    {
      id: "WMT",
      name: "Walmart Inc.",
      yahooSymbol: "WMT",
      eodhdSymbol: "WMT.US",
      currency: "USD" as const,
    },
    {
      id: "005380",
      name: "현대자동차(주)",
      yahooSymbol: "005380.KS",
      eodhdSymbol: "005380.KO",
      currency: "KRW" as const,
    },
    {
      id: "105560",
      name: "(주)KB금융지주",
      yahooSymbol: "105560.KS",
      eodhdSymbol: "105560.KO",
      currency: "KRW" as const,
    },
  ],
  government: {
    id: "114820",
    name: "TIGER 국채3년",
    yahooSymbol: "114820.KS",
    eodhdSymbol: "114820.KO",
    currency: "KRW" as const,
  },
  credit: {
    id: "273130",
    name: "KODEX 종합채권(AA-이상) 액티브",
    yahooSymbol: "273130.KS",
    eodhdSymbol: "273130.KO",
    currency: "KRW" as const,
  },
  alternative: {
    id: "132030",
    name: "KODEX 골드선물(H)",
    yahooSymbol: "132030.KS",
    eodhdSymbol: "132030.KO",
    currency: "KRW" as const,
  },
  cash: {
    id: "488770",
    name: "KODEX 머니마켓액티브",
    yahooSymbol: "488770.KS",
    eodhdSymbol: "488770.KO",
    currency: "KRW" as const,
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
): "weekly" | "monthly" | "quarterly" {
  if (profile === "CONTEST") return "weekly";
  if (profile === "GROWTH") return "monthly";
  return "quarterly";
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

