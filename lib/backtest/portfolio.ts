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

export type RiskRules = {
  maxSingleAssetWeight: number;
  maxEquityWeight: number;
  maxDrawdown: number;
  rebalanceBand: number;
  maxAnnualizedTurnover: number;
};

export type DailyCandidateGroup = {
  id: string;
  name: string;
  candidates: Array<{
    asset: BacktestAsset;
    current: boolean;
  }>;
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

const LOCKED_PROFILE_WEIGHTS: Record<BacktestProfileCode, SleeveWeights> = {
  CONSERVATIVE: { ...PROFILE_WEIGHTS.CONSERVATIVE },
  MODERATE_CONSERVATIVE: { ...PROFILE_WEIGHTS.MODERATE_CONSERVATIVE },
  MODERATE: { ...PROFILE_WEIGHTS.MODERATE },
  GROWTH: { ...PROFILE_WEIGHTS.GROWTH },
  CONTEST: { ...PROFILE_WEIGHTS.CONTEST },
};

const PROFILE_RISK_RULES: Record<BacktestProfileCode, RiskRules> = {
  CONSERVATIVE: {
    maxSingleAssetWeight: 0.45,
    maxEquityWeight: 0.3,
    maxDrawdown: 0.25,
    rebalanceBand: 0.05,
    maxAnnualizedTurnover: 0.75,
  },
  MODERATE_CONSERVATIVE: {
    maxSingleAssetWeight: 0.4,
    maxEquityWeight: 0.5,
    maxDrawdown: 0.3,
    rebalanceBand: 0.05,
    maxAnnualizedTurnover: 1,
  },
  MODERATE: {
    maxSingleAssetWeight: 0.35,
    maxEquityWeight: 0.7,
    maxDrawdown: 0.35,
    rebalanceBand: 0.05,
    maxAnnualizedTurnover: 1.5,
  },
  GROWTH: {
    maxSingleAssetWeight: 0.35,
    maxEquityWeight: 0.9,
    maxDrawdown: 0.45,
    rebalanceBand: 0.03,
    maxAnnualizedTurnover: 2.5,
  },
  CONTEST: {
    maxSingleAssetWeight: 0.5,
    maxEquityWeight: 0.95,
    maxDrawdown: 0.6,
    rebalanceBand: 0.02,
    maxAnnualizedTurnover: 6,
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
  dailyAlternatives: {
    strategy: {
      id: "381170",
      name: "TIGER 미국테크TOP10 INDXX",
      yahooSymbol: "381170.KS",
      currency: "KRW" as const,
      market: "KRX" as const,
      krxDataset: "etf" as const,
      sleeve: "strategy" as const,
    },
    aiSemiconductor: {
      id: "005930",
      name: "삼성전자(주)",
      yahooSymbol: "005930.KS",
      currency: "KRW" as const,
      market: "KRX" as const,
      krxDataset: "stock" as const,
      sleeve: "stocks" as const,
    },
    healthcare: {
      id: "207940",
      name: "삼성바이오로직스(주)",
      yahooSymbol: "207940.KS",
      currency: "KRW" as const,
      market: "KRX" as const,
      krxDataset: "stock" as const,
      sleeve: "stocks" as const,
    },
    consumerDefensive: {
      id: "033780",
      name: "(주)케이티앤지",
      yahooSymbol: "033780.KS",
      currency: "KRW" as const,
      market: "KRX" as const,
      krxDataset: "stock" as const,
      sleeve: "stocks" as const,
    },
    mobility: {
      id: "000270",
      name: "기아(주)",
      yahooSymbol: "000270.KS",
      currency: "KRW" as const,
      market: "KRX" as const,
      krxDataset: "stock" as const,
      sleeve: "stocks" as const,
    },
    finance: {
      id: "055550",
      name: "(주)신한금융지주회사",
      yahooSymbol: "055550.KS",
      currency: "KRW" as const,
      market: "KRX" as const,
      krxDataset: "stock" as const,
      sleeve: "stocks" as const,
    },
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
  return getBacktestCadence(profile);
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

export function getRiskRules(profile: BacktestProfileCode): RiskRules {
  return { ...PROFILE_RISK_RULES[profile] };
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

function unweighted(
  asset: Omit<BacktestAsset, "weight">,
): BacktestAsset {
  return { ...asset, weight: 0 };
}

export function getDailyCandidateGroups(
  profile: BacktestProfileCode,
): DailyCandidateGroup[] {
  const currentTickers = new Set(
    getBacktestAssets(profile).map((asset) => asset.id),
  );
  const group = (
    id: string,
    name: string,
    candidates: Array<Omit<BacktestAsset, "weight">>,
  ): DailyCandidateGroup => ({
    id,
    name,
    candidates: candidates.map((asset) => ({
      asset: unweighted(asset),
      current: currentTickers.has(asset.id),
    })),
  });

  return [
    group("strategy-etf", "전략 ETF", [
      ASSETS.strategy,
      ASSETS.dailyAlternatives.strategy,
    ]),
    group("ai-semiconductor", "AI·반도체", [
      ASSETS.stocks[0],
      ASSETS.dailyAlternatives.aiSemiconductor,
    ]),
    group("healthcare", "헬스케어", [
      ASSETS.stocks[1],
      ASSETS.dailyAlternatives.healthcare,
    ]),
    group("consumer-defensive", "필수소비재", [
      ASSETS.stocks[2],
      ASSETS.dailyAlternatives.consumerDefensive,
    ]),
    group("mobility", "산업재·모빌리티", [
      ASSETS.stocks[3],
      ASSETS.dailyAlternatives.mobility,
    ]),
    group("finance", "금융", [
      ASSETS.stocks[4],
      ASSETS.dailyAlternatives.finance,
    ]),
  ];
}
