"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { BacktestPanel } from "./backtest-panel";

type ProfileCode =
  | "CONSERVATIVE"
  | "MODERATE_CONSERVATIVE"
  | "MODERATE"
  | "GROWTH"
  | "CONTEST";

type AllocationId =
  | "market"
  | "strategy"
  | "stocks"
  | "government"
  | "credit"
  | "alternative"
  | "cash";

type HoldingKind = "ETF" | "개별주식" | "채권" | "대체자산" | "현금";
type HoldingFilter = "전체" | HoldingKind;

type Allocation = {
  id: AllocationId;
  label: string;
  percent: number;
  color: string;
};

type Profile = {
  code: ProfileCode;
  name: string;
  shortName: string;
  description: string;
  riskLevel: number;
  cadence: string;
  nextReview: string;
  allocations: Allocation[];
};

type Holding = {
  ticker: string;
  name: string;
  role: string;
  percent: number;
  kind: HoldingKind;
  sector: string;
  market: string;
  vehicle: string;
  rotation: string;
  sourceUrl: string;
  dynamic?: boolean;
};

const COLORS: Record<AllocationId, string> = {
  market: "#635bff",
  strategy: "#8d84ff",
  stocks: "#17a67a",
  government: "#3b82f6",
  credit: "#6db6ff",
  alternative: "#f5a524",
  cash: "#b7bfd1",
};

const ALLOCATION_LABELS: Record<AllocationId, string> = {
  market: "시장대표 ETF",
  strategy: "전략·섹터 ETF",
  stocks: "섹터 대표주 5종",
  government: "국채",
  credit: "우량 회사채",
  alternative: "대체자산",
  cash: "현금성자산",
};

const buildAllocations = (
  values: Record<AllocationId, number>,
): Allocation[] =>
  (Object.keys(values) as AllocationId[]).map((id) => ({
    id,
    label: ALLOCATION_LABELS[id],
    percent: values[id],
    color: COLORS[id],
  }));

const profiles: Profile[] = [
  {
    code: "CONSERVATIVE",
    name: "안정형",
    shortName: "원금 방어",
    description: "채권과 현금 중심으로 변동성을 낮추는 구성",
    riskLevel: 1,
    cadence: "분기",
    nextReview: "2026.10.30",
    allocations: buildAllocations({
      market: 10,
      strategy: 5,
      stocks: 5,
      government: 45,
      credit: 20,
      alternative: 5,
      cash: 10,
    }),
  },
  {
    code: "MODERATE_CONSERVATIVE",
    name: "안정추구형",
    shortName: "방어 + 수익",
    description: "채권을 중심으로 주식의 성장성을 더한 구성",
    riskLevel: 2,
    cadence: "분기",
    nextReview: "2026.10.30",
    allocations: buildAllocations({
      market: 20,
      strategy: 10,
      stocks: 10,
      government: 30,
      credit: 15,
      alternative: 5,
      cash: 10,
    }),
  },
  {
    code: "MODERATE",
    name: "중위험형",
    shortName: "균형 운용",
    description: "성장자산과 방어자산을 균형 있게 배분",
    riskLevel: 3,
    cadence: "분기",
    nextReview: "2026.10.30",
    allocations: buildAllocations({
      market: 25,
      strategy: 15,
      stocks: 20,
      government: 20,
      credit: 10,
      alternative: 5,
      cash: 5,
    }),
  },
  {
    code: "GROWTH",
    name: "성장형",
    shortName: "자본 성장",
    description: "ETF와 섹터 대표주 비중을 높인 장기 성장 구성",
    riskLevel: 4,
    cadence: "월간 점검 · 분기 교체",
    nextReview: "2026.08.31",
    allocations: buildAllocations({
      market: 30,
      strategy: 20,
      stocks: 30,
      government: 10,
      credit: 5,
      alternative: 3,
      cash: 2,
    }),
  },
  {
    code: "CONTEST",
    name: "대회형",
    shortName: "순위 경쟁",
    description: "주간 교체와 손실 제한을 적용하는 별도 고위험 구성",
    riskLevel: 5,
    cadence: "주간",
    nextReview: "매주 금요일",
    allocations: buildAllocations({
      market: 10,
      strategy: 30,
      stocks: 50,
      government: 0,
      credit: 0,
      alternative: 0,
      cash: 10,
    }),
  },
];

const stockLeaders = [
  {
    ticker: "NVDA",
    name: "NVIDIA Corporation",
    sector: "AI·반도체",
    role: "성장 섹터 대표",
    market: "Nasdaq",
    vehicle: "미국 보통주",
    sourceUrl:
      "https://investor.nvidia.com/investor-resources/faqs/default.aspx",
  },
  {
    ticker: "JNJ",
    name: "Johnson & Johnson",
    sector: "헬스케어",
    role: "방어 섹터 대표",
    market: "NYSE",
    vehicle: "미국 보통주",
    sourceUrl:
      "https://www.investor.jnj.com/stock-info/default.aspx",
  },
  {
    ticker: "WMT",
    name: "Walmart Inc.",
    sector: "필수소비재",
    role: "경기 방어 대표",
    market: "Nasdaq",
    vehicle: "미국 보통주",
    sourceUrl: "https://stock.walmart.com/",
  },
  {
    ticker: "005380",
    name: "현대자동차(주)",
    sector: "산업재·모빌리티",
    role: "국내 산업 대표",
    market: "KRX",
    vehicle: "국내 보통주",
    sourceUrl:
      "https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummary&strIsurCd=00538",
  },
  {
    ticker: "105560",
    name: "(주)KB금융지주",
    sector: "금융",
    role: "국내 금융 대표",
    market: "KRX",
    vehicle: "국내 보통주",
    sourceUrl:
      "https://kind.krx.co.kr/common/companysummary.do?method=searchCompanySummary&strIsurCd=10556",
  },
];

const koreaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const lineupVerifiedAsOf = "2026.07.27";

function latestKoreaDateLabel(date = new Date()) {
  const parts = Object.fromEntries(
    koreaDateFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}.${parts.month}.${parts.day}`;
}

function useLatestKoreaDate() {
  const [label, setLabel] = useState(() => latestKoreaDateLabel());

  useEffect(() => {
    const refresh = () => setLabel(latestKoreaDateLabel());
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return label;
}

const filterOptions: HoldingFilter[] = [
  "전체",
  "ETF",
  "개별주식",
  "채권",
  "대체자산",
  "현금",
];

const krw = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

function amountLabel(amount: number) {
  if (amount >= 100_000_000 && amount % 100_000_000 === 0) {
    return `${amount / 100_000_000}억원`;
  }
  if (amount >= 10_000_000 && amount % 10_000_000 === 0) {
    return `${amount / 10_000_000}천만원`;
  }
  return krw.format(amount);
}

function buildHoldings(profile: Profile): Holding[] {
  const weight = Object.fromEntries(
    profile.allocations.map((allocation) => [
      allocation.id,
      allocation.percent,
    ]),
  ) as Record<AllocationId, number>;

  if (profile.code === "CONTEST") {
    return [
      {
        ticker: "360750",
        name: "TIGER 미국S&P500",
        role: "시장대표 코어 ETF",
        percent: weight.market,
        kind: "ETF",
        sector: "시장대표",
        market: "KRX",
        vehicle: "해외주식형 ETF",
        rotation: "주간",
        sourceUrl:
          "https://www.tigeretf.com/upload/etf/20250708095909002749.pdf",
        dynamic: true,
      },
      {
        ticker: "133690",
        name: "TIGER 미국나스닥100",
        role: "대형 성장주 모멘텀",
        percent: weight.strategy / 2,
        kind: "ETF",
        sector: "미국 성장주",
        market: "KRX",
        vehicle: "해외주식형 ETF",
        rotation: "주간",
        sourceUrl:
          "https://www.tigeretf.com/upload/etf/20241007062827005440.pdf",
        dynamic: true,
      },
      {
        ticker: "381170",
        name: "TIGER 미국테크TOP10 INDXX",
        role: "미국 빅테크 집중 전략",
        percent: weight.strategy / 2,
        kind: "ETF",
        sector: "미국 테크",
        market: "KRX",
        vehicle: "해외주식형 ETF",
        rotation: "주간",
        sourceUrl:
          "https://www.tigeretf.com/upload/etf/20240509105027005590.pdf",
        dynamic: true,
      },
      ...stockLeaders.map((stock) => ({
        ...stock,
        percent: weight.stocks / stockLeaders.length,
        kind: "개별주식" as const,
        rotation: "주간",
        dynamic: true,
      })),
      {
        ticker: "488770",
        name: "KODEX 머니마켓액티브",
        role: "손실 통제 및 투자 대기자금",
        percent: weight.cash,
        kind: "현금",
        sector: "현금성",
        market: "KRX",
        vehicle: "머니마켓 ETF",
        rotation: "상시",
        sourceUrl:
          "https://www.samsungfund.com/etf/product/view.do?id=2ETFO1",
      },
    ];
  }

  const holdings: Holding[] = [
    {
      ticker: "360750",
      name: "TIGER 미국S&P500",
      role: "장기 시장수익률의 중심축",
      percent: weight.market,
      kind: "ETF",
      sector: "시장대표",
      market: "KRX",
      vehicle: "해외주식형 ETF",
      rotation: "연 1회 검토",
      sourceUrl:
        "https://www.tigeretf.com/upload/etf/20250708095909002749.pdf",
    },
    {
      ticker: "133690",
      name: "TIGER 미국나스닥100",
      role: "현재 전략 ETF 1순위",
      percent: weight.strategy,
      kind: "ETF",
      sector: "미국 성장주",
      market: "KRX",
      vehicle: "해외주식형 ETF",
      rotation: profile.code === "GROWTH" ? "월간 점검" : "분기",
      sourceUrl:
        "https://www.tigeretf.com/upload/etf/20241007062827005440.pdf",
      dynamic: true,
    },
    ...stockLeaders.map((stock) => ({
      ...stock,
      percent: weight.stocks / stockLeaders.length,
      kind: "개별주식" as const,
      rotation: profile.code === "GROWTH" ? "월간 점검" : "분기",
      dynamic: true,
    })),
  ];

  if (weight.government > 0) {
    holdings.push({
      ticker: "114820",
      name: "TIGER 국채3년",
      role: "국고채 3년 구간 변동성 완충",
      percent: weight.government,
      kind: "채권",
      sector: "국채 ETF",
      market: "KRX",
      vehicle: "국내채권형 ETF",
      rotation: "분기",
      sourceUrl:
        "https://www.tigeretf.com/upload/etf/20250708095820005220.pdf",
    });
  }

  if (weight.credit > 0) {
    holdings.push({
      ticker: "273130",
      name: "KODEX 종합채권(AA-이상) 액티브",
      role: "AA- 이상 우량채권 이자수익",
      percent: weight.credit,
      kind: "채권",
      sector: "종합채권 ETF",
      market: "KRX",
      vehicle: "국내채권형 ETF",
      rotation: "분기",
      sourceUrl:
        "https://www.samsungfund.com/etf/product/view.do?id=2ETF88",
    });
  }

  if (weight.alternative > 0) {
    holdings.push({
      ticker: "132030",
      name: "KODEX 골드선물(H)",
      role: "환헤지 금 선물 분산",
      percent: weight.alternative,
      kind: "대체자산",
      sector: "금 선물 ETF",
      market: "KRX",
      vehicle: "원자재 ETF",
      rotation: "분기",
      sourceUrl:
        "https://www.samsungfund.com/etf/product/view.do?id=2ETF24",
    });
  }

  if (weight.cash > 0) {
    holdings.push({
      ticker: "488770",
      name: "KODEX 머니마켓액티브",
      role: "유동성과 리밸런싱 대기자금",
      percent: weight.cash,
      kind: "현금",
      sector: "현금성",
      market: "KRX",
      vehicle: "머니마켓 ETF",
      rotation: "상시",
      sourceUrl:
        "https://www.samsungfund.com/etf/product/view.do?id=2ETFO1",
    });
  }

  return holdings;
}

function createDonut(allocations: Allocation[]) {
  let cursor = 0;
  const segments = allocations
    .filter((allocation) => allocation.percent > 0)
    .map((allocation) => {
      const start = cursor;
      cursor += allocation.percent;
      return `${allocation.color} ${start}% ${cursor}%`;
    });
  return `conic-gradient(${segments.join(", ")})`;
}

export default function Home() {
  const [profileCode, setProfileCode] =
    useState<ProfileCode>("MODERATE");
  const [amount, setAmount] = useState(100_000_000);
  const [holdingFilter, setHoldingFilter] =
    useState<HoldingFilter>("전체");
  const [query, setQuery] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const holdingsAsOf = useLatestKoreaDate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedProfile = params.get("profile");
    const sharedAmount = Number(params.get("amount"));

    if (
      sharedProfile &&
      profiles.some((candidate) => candidate.code === sharedProfile)
    ) {
      setProfileCode(sharedProfile as ProfileCode);
    }
    if (
      Number.isFinite(sharedAmount) &&
      sharedAmount >= 10_000_000 &&
      sharedAmount <= 500_000_000
    ) {
      setAmount(sharedAmount);
    }
  }, []);

  const profile = profiles.find(
    (candidate) => candidate.code === profileCode,
  )!;
  const holdings = useMemo(() => buildHoldings(profile), [profile]);
  const filteredHoldings = holdings.filter((holding) => {
    const matchesKind =
      holdingFilter === "전체" || holding.kind === holdingFilter;
    const keyword = query.trim().toLocaleLowerCase("ko-KR");
    const matchesQuery =
      keyword.length === 0 ||
      [
        holding.ticker,
        holding.name,
        holding.sector,
        holding.role,
        holding.market,
        holding.vehicle,
      ]
        .join(" ")
        .toLocaleLowerCase("ko-KR")
        .includes(keyword);
    return matchesKind && matchesQuery;
  });
  const riskAssets = profile.allocations
    .filter((item) =>
      ["market", "strategy", "stocks"].includes(item.id),
    )
    .reduce((sum, item) => sum + item.percent, 0);
  const defenseAssets = profile.allocations
    .filter((item) =>
      ["government", "credit", "cash"].includes(item.id),
    )
    .reduce((sum, item) => sum + item.percent, 0);
  const donutStyle = {
    "--donut": createDonut(profile.allocations),
  } as CSSProperties;

  async function sharePortfolio() {
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set("profile", profile.code);
    shareUrl.searchParams.set("amount", String(amount));
    shareUrl.hash = "portfolio";
    window.history.replaceState({}, "", shareUrl);

    try {
      await navigator.clipboard.writeText(shareUrl.toString());
      setShareStatus("선택안 링크를 복사했습니다.");
    } catch {
      setShareStatus("주소창의 링크를 복사해 공유해 주세요.");
    }
  }

  return (
    <main id="top">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="FIDI 홈">
          <span className="brand-mark">F</span>
          <span>
            <strong>FIDI</strong>
            <small>KRW PORTFOLIO LAB</small>
          </span>
        </a>
        <nav aria-label="주요 메뉴">
          <a href="#profile">투자자 유형</a>
          <a href="#portfolio">자산배분</a>
          <a href="#holdings">편입종목</a>
          <a href="#backtest">백테스트</a>
          <a href="#rules">운용규칙</a>
        </nav>
        <span className="status-pill">
          <i />
          KRW Dynamic V4
        </span>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="service-badge">FIDI ASSET ALLOCATION</span>
          <h1>
            투자 성향별로
            <br />
            ETF·주식·채권을
            <br />
            <em>한눈에 설계하세요.</em>
          </h1>
          <p>
            ETF에만 몰아넣지 않습니다. 시장 ETF, 섹터별 대표주 5개,
            채권, 대체자산, 현금을 투자자 유형에 맞춰 나누고 종목은
            정해진 규칙으로 다시 고릅니다.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#profile">
              내 포트폴리오 만들기 <span>→</span>
            </a>
            <a className="text-action" href="#rules">
              선정 원칙 보기
            </a>
          </div>
        </div>

        <aside className="hero-panel" aria-label="서비스 요약">
          <div className="hero-panel-top">
            <span>PORTFOLIO ENGINE</span>
            <strong>자산배분은 안정적으로,<br />종목선정은 유연하게.</strong>
          </div>
          <div className="mini-allocation" aria-hidden="true">
            <i style={{ width: "40%" }} />
            <i style={{ width: "20%" }} />
            <i style={{ width: "25%" }} />
            <i style={{ width: "15%" }} />
          </div>
          <div className="engine-steps">
            <div>
              <b>01</b>
              <span>성향 진단</span>
            </div>
            <div>
              <b>02</b>
              <span>비중 설계</span>
            </div>
            <div>
              <b>03</b>
              <span>종목 교체</span>
            </div>
          </div>
          <p>
            <i />
            5개 투자자 유형 · 7개 자산 슬리브 · 5개 주식 섹터
          </p>
        </aside>
      </section>

      <section className="overview-strip" aria-label="모델 특징">
        <article>
          <span>투자자 유형</span>
          <strong>5</strong>
          <small>안정형부터 대회형까지</small>
        </article>
        <article>
          <span>자산 구분</span>
          <strong>4+</strong>
          <small>주식 · ETF · 채권 · 현금</small>
        </article>
        <article>
          <span>대표주 섹터</span>
          <strong>5</strong>
          <small>성장과 방어를 함께 구성</small>
        </article>
        <article>
          <span>운용 주기</span>
          <strong>주간~분기</strong>
          <small>유형별 교체 속도 차등</small>
        </article>
      </section>

      <section className="profile-section" id="profile">
        <div className="section-heading">
          <div>
            <span className="step-label">STEP 01</span>
            <h2>어떤 방식으로 운용할까요?</h2>
          </div>
          <p>
            유형을 바꾸면 자산 비중과 종목별 투자금이 즉시 다시
            계산됩니다.
          </p>
        </div>

        <div className="profile-grid" role="list">
          {profiles.map((candidate) => {
            const active = candidate.code === profileCode;
            return (
              <button
                className={`profile-card ${active ? "active" : ""}`}
                key={candidate.code}
                onClick={() => {
                  setProfileCode(candidate.code);
                  setHoldingFilter("전체");
                  setQuery("");
                }}
                aria-pressed={active}
                type="button"
              >
                <span className="profile-card-top">
                  <span className="risk-bars" aria-label={`위험도 ${candidate.riskLevel}`}>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <i
                        className={level <= candidate.riskLevel ? "filled" : ""}
                        key={level}
                      />
                    ))}
                  </span>
                  <small>RISK {candidate.riskLevel}</small>
                </span>
                <strong>{candidate.name}</strong>
                <b>{candidate.shortName}</b>
                <span>{candidate.description}</span>
                <em>{active ? "선택됨" : "선택하기"} →</em>
              </button>
            );
          })}
        </div>
      </section>

      <section className="portfolio-section" id="portfolio">
        <div className="portfolio-titlebar">
          <div>
            <span className="step-label">STEP 02 · ASSET MIX</span>
            <h2>{profile.name} 포트폴리오</h2>
            <p>{profile.description}</p>
          </div>
          <div className="amount-display">
            <span>총 투자금액</span>
            <strong>{krw.format(amount)}</strong>
          </div>
        </div>

        <div className="amount-toolbar">
          <div className="amount-presets" aria-label="투자금액 빠른 선택">
            {[10_000_000, 50_000_000, 100_000_000, 300_000_000].map(
              (value) => (
                <button
                  className={amount === value ? "active" : ""}
                  key={value}
                  onClick={() => setAmount(value)}
                  type="button"
                >
                  {amountLabel(value)}
                </button>
              ),
            )}
          </div>
          <label className="amount-slider">
            <span className="sr-only">투자금액 조절</span>
            <input
              type="range"
              min="10000000"
              max="500000000"
              step="10000000"
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
            />
            <small>1천만원</small>
            <small>5억원</small>
          </label>
        </div>

        {profile.code === "CONTEST" && (
          <div className="contest-notice" role="status">
            <span>대회 모드</span>
            <p>
              대회 규정과 허용시장을 먼저 입력한 뒤 주간 점수 상위
              후보를 확정합니다. 일간 -3%, 주간 -6%, 누적 -10%를
              손실 통제 기준으로 사용합니다.
            </p>
          </div>
        )}

        <div className="portfolio-dashboard">
          <article className="donut-card">
            <div className="card-title">
              <div>
                <span>ASSET ALLOCATION</span>
                <h3>목표 자산배분</h3>
              </div>
              <small>합계 100%</small>
            </div>
            <div className="donut-wrap">
              <div
                className="donut"
                style={donutStyle}
                aria-label={`${profile.name} 자산배분 도넛 차트`}
              >
                <div>
                  <small>성장자산</small>
                  <strong>{riskAssets}%</strong>
                  <span>{krw.format((amount * riskAssets) / 100)}</span>
                </div>
              </div>
              <div className="donut-legend">
                {profile.allocations
                  .filter((allocation) => allocation.percent > 0)
                  .map((allocation) => (
                    <div key={allocation.id}>
                      <i style={{ background: allocation.color }} />
                      <span>{allocation.label}</span>
                      <strong>{allocation.percent}%</strong>
                    </div>
                  ))}
              </div>
            </div>
          </article>

          <article className="allocation-table-card">
            <div className="card-title">
              <div>
                <span>KRW TARGET</span>
                <h3>자산별 투자금액</h3>
              </div>
              <small>{profile.cadence} 리밸런싱</small>
            </div>
            <div className="allocation-table">
              {profile.allocations
                .filter((allocation) => allocation.percent > 0)
                .map((allocation) => (
                  <div className="allocation-row" key={allocation.id}>
                    <span
                      className="allocation-icon"
                      style={{
                        color: allocation.color,
                        background: `${allocation.color}18`,
                      }}
                    >
                      {allocation.label.slice(0, 1)}
                    </span>
                    <div>
                      <strong>{allocation.label}</strong>
                      <span className="allocation-bar">
                        <i
                          style={{
                            width: `${allocation.percent}%`,
                            background: allocation.color,
                          }}
                        />
                      </span>
                    </div>
                    <b>{allocation.percent}%</b>
                    <em>
                      {krw.format((amount * allocation.percent) / 100)}
                    </em>
                  </div>
                ))}
            </div>
          </article>

          <aside className="metric-column">
            <article className="metric-card">
              <span>성장 / 방어</span>
              <strong>
                {riskAssets}<small> / {defenseAssets}</small>
              </strong>
              <p>대체자산은 별도 분산 비중</p>
            </article>
            <article className="metric-card">
              <span>성과 검증</span>
              <strong>실데이터</strong>
              <p>아래 백테스트에서 직접 계산</p>
            </article>
            <article className="metric-card accent">
              <span>검증 전 숫자</span>
              <strong>사용 안 함</strong>
              <p>다음 점검 {profile.nextReview}</p>
            </article>
          </aside>
        </div>
      </section>

      <section className="holdings-section" id="holdings">
        <div className="section-heading">
          <div>
            <span className="step-label">STEP 03 · HOLDINGS</span>
            <h2>현재 모델 편입안</h2>
          </div>
          <p>
            실제 거래 가능한 공식 상품명과 티커를 표시합니다. 현재
            버전은 규칙 기반 모델안이며 실시간 시세와 주문은 연결되지
            않았습니다.
          </p>
        </div>

        <div className="data-status-panel" role="note" aria-label="데이터 상태">
          <div>
            <span>화면 조회일</span>
            <strong>{holdingsAsOf}</strong>
            <small>한국시간 자동 갱신</small>
          </div>
          <div>
            <span>라인업 검증일</span>
            <strong>{lineupVerifiedAsOf}</strong>
            <small>상품명·티커 확인</small>
          </div>
          <div className="pending">
            <span>실시간 시세</span>
            <strong>미연동</strong>
            <small>주문 전 별도 확인</small>
          </div>
          <div className="pending">
            <span>자동 주문</span>
            <strong>미연동</strong>
            <small>전략 설계 전용</small>
          </div>
        </div>

        <div className="holdings-toolbar">
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="종목명, 티커 또는 섹터로 검색"
              aria-label="편입종목 검색"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")}>
                지우기
              </button>
            )}
          </label>
          <div className="holding-filters" aria-label="자산 종류 필터">
            {filterOptions.map((option) => (
              <button
                className={holdingFilter === option ? "active" : ""}
                key={option}
                onClick={() => setHoldingFilter(option)}
                aria-pressed={holdingFilter === option}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="holdings-meta">
          <span>
            <i />
            최신 편입 기준일 {holdingsAsOf}
          </span>
          <strong>{filteredHoldings.length}개 상품 표시</strong>
        </div>

        <div className="holdings-card">
          <div className="holdings-table holdings-header" aria-hidden="true">
            <span>자산군</span>
            <span>공식 상품명</span>
            <span>시장 · 티커</span>
            <span>운용 역할</span>
            <span>비중</span>
            <span>투자금액</span>
          </div>
          <div className="holding-rows">
            {filteredHoldings.length > 0 ? (
              filteredHoldings.map((holding) => (
                <article
                  className="holdings-table holding-row"
                  key={`${holding.ticker}-${holding.kind}`}
                >
                  <div className="holding-category">
                    <span className={`kind-icon kind-${holding.kind}`}>
                      {holding.kind === "개별주식"
                        ? "S"
                        : holding.kind === "채권"
                          ? "B"
                          : holding.kind === "현금"
                            ? "₩"
                            : holding.kind === "대체자산"
                              ? "A"
                              : "E"}
                    </span>
                    <div>
                      <small>{holding.kind}</small>
                      <strong>{holding.sector}</strong>
                    </div>
                  </div>
                  <div className="holding-product">
                    <a
                      href={holding.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${holding.name} 상품정보 열기`}
                    >
                      {holding.name}
                      <span>↗</span>
                    </a>
                    <small>{holding.vehicle}</small>
                    <b className={holding.dynamic ? "dynamic" : ""}>
                      {holding.dynamic
                        ? "정기 교체 검토"
                        : "모델 기준 편입"}
                    </b>
                  </div>
                  <div className="holding-code">
                    <span>{holding.market}</span>
                    <strong>{holding.ticker}</strong>
                  </div>
                  <p className="holding-role">
                    {holding.role}
                    <small>{holding.rotation} 검토</small>
                  </p>
                  <strong className="holding-percent">
                    {holding.percent}%
                  </strong>
                  <strong className="holding-amount">
                    {krw.format((amount * holding.percent) / 100)}
                  </strong>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <strong>검색 결과가 없습니다.</strong>
                <span>다른 종목명이나 섹터를 입력해 보세요.</span>
              </div>
            )}
          </div>
        </div>
        <p className="data-note">
          화면 조회일은 한국시간 {holdingsAsOf}로 자동 갱신되지만,
          상품 라인업은 {lineupVerifiedAsOf}에 공식 명칭과 티커를
          확인한 규칙 기반 모델안입니다. 채권·현금성·대체자산 슬리브는
          증권계좌에서 거래 가능한 ETF로 구현했습니다. 가격, 거래 가능
          여부, 세금과 수수료는 주문 직전에 다시 확인해야 합니다.
        </p>
      </section>

      <BacktestPanel
        profileCode={profile.code}
        profileName={profile.name}
      />

      <section className="rules-section" id="rules">
        <div className="rules-intro">
          <span className="step-label">DYNAMIC SELECTION RULE</span>
          <h2>
            비중은 정책으로,
            <br />
            <em>종목은 데이터로.</em>
          </h2>
          <p>
            한 번 고른 ETF와 주식을 영구 보유하는 구조가 아닙니다.
            정해진 날짜에 같은 기준으로 다시 평가해 교체 여부를
            결정합니다.
          </p>
          <div className="model-phase" aria-label="자동화 진행 상태">
            <div>
              <span>현재 V4</span>
              <strong>비중 계산 · 실상품 라인업</strong>
            </div>
            <div>
              <span>NEXT</span>
              <strong>시세 API · 자동 점수 · 교체 신호</strong>
            </div>
          </div>
          <div className="source-list">
            <a
              href="https://www.funetf.co.kr/"
              target="_blank"
              rel="noreferrer"
            >
              <span>ETF 탐색</span>
              <strong>FUNETF ↗</strong>
            </a>
            <a
              href="https://finance.naver.com/sise/"
              target="_blank"
              rel="noreferrer"
            >
              <span>국내 종목 확인</span>
              <strong>네이버 금융 ↗</strong>
            </a>
            <a
              href="https://www.indexergo.com/index?group=usstock&frq=L&select=simpleView"
              target="_blank"
              rel="noreferrer"
            >
              <span>섹터 리더 확인</span>
              <strong>IndexErgo ↗</strong>
            </a>
          </div>
        </div>

        <div className="rule-flow">
          <article>
            <span>01</span>
            <div>
              <small>UNIVERSE</small>
              <h3>후보군 만들기</h3>
              <p>
                거래 가능 ETF와 국내·미국 섹터 대표주를 모으고,
                거래대금과 운용기간이 부족한 종목은 제외합니다.
              </p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <small>SCORE</small>
              <h3>같은 기준으로 점수화</h3>
              <p>
                중기 모멘텀, 변동성, 거래대금, 비용, 섹터 중복도를
                합산해 자산군 안에서 순위를 계산합니다.
              </p>
            </div>
          </article>
          <article>
            <span>03</span>
            <div>
              <small>CONTROL</small>
              <h3>교체 비용과 위험 제한</h3>
              <p>
                기존 종목보다 충분히 높은 점수일 때만 교체하고, 단일
                종목·섹터·환율 노출 상한을 함께 적용합니다.
              </p>
            </div>
          </article>
          <article>
            <span>04</span>
            <div>
              <small>REBALANCE</small>
              <h3>유형별 주기로 실행</h3>
              <p>
                일반 유형은 월간 점검·분기 리밸런싱, 대회형은 주간
                교체와 별도 손실중단 규칙을 사용합니다.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="closing-panel">
        <div className="closing-copy">
          <span>FIDI KRW DYNAMIC V4</span>
          <h2>지금 선택한 {profile.name} 구성을 링크로 공유하세요.</h2>
        </div>
        <div className="closing-actions">
          <button type="button" onClick={sharePortfolio}>
            선택안 링크 복사 <span>↗</span>
          </button>
          <a href="#portfolio">
            다시 보기 <span>↑</span>
          </a>
          <small aria-live="polite">{shareStatus}</small>
        </div>
      </section>

      <footer>
        <div className="footer-brand">
          <span className="brand-mark">F</span>
          <strong>FIDI</strong>
        </div>
        <p>
          본 화면은 투자전략 설계를 위한 모델 예시이며 투자 권유가
          아닙니다. 과거 데이터와 모델 가정은 미래 수익을 보장하지
          않습니다.
        </p>
        <span>KRW Dynamic V4 · 2026</span>
      </footer>
    </main>
  );
}
