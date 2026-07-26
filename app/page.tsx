"use client";

import {
  useMemo,
  useState,
  type CSSProperties,
} from "react";

type ProfileCode =
  | "CONSERVATIVE"
  | "MODERATE_CONSERVATIVE"
  | "MODERATE"
  | "GROWTH"
  | "CONTEST";

type AllocationId =
  | "market"
  | "factor"
  | "stocks"
  | "government"
  | "credit"
  | "gold"
  | "cash";

type Allocation = {
  id: AllocationId;
  label: string;
  percent: number;
  color: string;
};

type Profile = {
  code: ProfileCode;
  name: string;
  description: string;
  riskLevel: number;
  cadence: string;
  nextReview: string;
  allocations: Allocation[];
  cagr: string;
  drawdown: string;
};

type Holding = {
  ticker: string;
  name: string;
  role: string;
  percent: number;
  kind: "ETF" | "주식" | "채권" | "대체" | "현금";
  pending?: boolean;
};

const COLORS: Record<AllocationId, string> = {
  market: "#2f7d79",
  factor: "#5368c7",
  stocks: "#e46f5a",
  government: "#75a6c8",
  credit: "#9a84b6",
  gold: "#d7a33d",
  cash: "#b9c0c6",
};

const allocationLabels: Record<AllocationId, string> = {
  market: "시장 ETF",
  factor: "전술·팩터 ETF",
  stocks: "개별주 5종목",
  government: "국채",
  credit: "우량 회사채",
  gold: "금",
  cash: "원화 현금성",
};

const buildAllocations = (
  values: Record<AllocationId, number>,
): Allocation[] =>
  (Object.keys(values) as AllocationId[]).map((id) => ({
    id,
    label: allocationLabels[id],
    percent: values[id],
    color: COLORS[id],
  }));

const profiles: Profile[] = [
  {
    code: "CONSERVATIVE",
    name: "안정형",
    description: "낙폭 방어와 현금흐름을 우선합니다.",
    riskLevel: 1,
    cadence: "분기",
    nextReview: "2026.10.30",
    cagr: "6.94%",
    drawdown: "-9.63%",
    allocations: buildAllocations({
      market: 15,
      factor: 3,
      stocks: 2,
      government: 45.5,
      credit: 19.5,
      gold: 5,
      cash: 10,
    }),
  },
  {
    code: "MODERATE_CONSERVATIVE",
    name: "안정추구형",
    description: "채권 중심에 성장 노출을 더합니다.",
    riskLevel: 2,
    cadence: "분기",
    nextReview: "2026.10.30",
    cagr: "9.17%",
    drawdown: "-10.24%",
    allocations: buildAllocations({
      market: 25,
      factor: 7,
      stocks: 3,
      government: 38.5,
      credit: 16.5,
      gold: 5,
      cash: 5,
    }),
  },
  {
    code: "MODERATE",
    name: "중위험형",
    description: "성장과 방어를 균형 있게 배분합니다.",
    riskLevel: 3,
    cadence: "분기",
    nextReview: "2026.10.30",
    cagr: "11.59%",
    drawdown: "-14.63%",
    allocations: buildAllocations({
      market: 35,
      factor: 10,
      stocks: 5,
      government: 28,
      credit: 12,
      gold: 7,
      cash: 3,
    }),
  },
  {
    code: "GROWTH",
    name: "성장형",
    description: "장기 성장과 주식 위험예산을 확대합니다.",
    riskLevel: 4,
    cadence: "분기",
    nextReview: "2026.10.30",
    cagr: "14.27%",
    drawdown: "-20.82%",
    allocations: buildAllocations({
      market: 50,
      factor: 15,
      stocks: 5,
      government: 14,
      credit: 6,
      gold: 7,
      cash: 3,
    }),
  },
  {
    code: "CONTEST",
    name: "대회형",
    description: "단기 순위 경쟁을 위한 별도 고위험 프로필입니다.",
    riskLevel: 5,
    cadence: "주간",
    nextReview: "대회 규정 입력 후",
    cagr: "집계 전",
    drawdown: "-10% 중단",
    allocations: buildAllocations({
      market: 10,
      factor: 30,
      stocks: 50,
      government: 0,
      credit: 0,
      gold: 0,
      cash: 10,
    }),
  },
];

const stockTemplates = [
  {
    ticker: "NVDA",
    name: "NVIDIA",
    role: "AI·반도체 성장",
  },
  {
    ticker: "JNJ",
    name: "Johnson & Johnson",
    role: "방어적 헬스케어",
  },
  {
    ticker: "WMT",
    name: "Walmart",
    role: "필수소비재",
  },
  {
    ticker: "005380",
    name: "현대차",
    role: "산업·경기민감",
  },
  {
    ticker: "105560",
    name: "KB금융",
    role: "금융",
  },
];

const contestStockSlots = [
  "섹터 리더 01",
  "섹터 리더 02",
  "섹터 리더 03",
  "섹터 리더 04",
  "섹터 리더 05",
];

const krw = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

function getHoldings(profile: Profile): Holding[] {
  const value = Object.fromEntries(
    profile.allocations.map((allocation) => [
      allocation.id,
      allocation.percent,
    ]),
  ) as Record<AllocationId, number>;

  if (profile.code === "CONTEST") {
    return [
      {
        ticker: "AUTO-CORE",
        name: "시장 ETF 1개",
        role: "대회 허용시장 내 동적 선정",
        percent: value.market,
        kind: "ETF",
        pending: true,
      },
      {
        ticker: "AUTO-ETF 01",
        name: "전술 ETF",
        role: "주간 점수 상위",
        percent: value.factor / 2,
        kind: "ETF",
        pending: true,
      },
      {
        ticker: "AUTO-ETF 02",
        name: "전술 ETF",
        role: "주간 점수 상위",
        percent: value.factor / 2,
        kind: "ETF",
        pending: true,
      },
      ...contestStockSlots.map((name, index) => ({
        ticker: `AUTO-${String(index + 1).padStart(2, "0")}`,
        name,
        role: "서로 다른 섹터에서 선정",
        percent: value.stocks / 5,
        kind: "주식" as const,
        pending: true,
      })),
      {
        ticker: "KRW CASH",
        name: "원화 현금성 자산",
        role: "손실 통제·기회 대기",
        percent: value.cash,
        kind: "현금",
      },
    ];
  }

  const holdings: Holding[] = [
    {
      ticker: "ITOT",
      name: "iShares Core S&P Total U.S. Stock Market ETF",
      role: "미국 전체시장",
      percent: value.market,
      kind: "ETF",
    },
    {
      ticker: "MTUM",
      name: "iShares MSCI USA Momentum Factor ETF",
      role: "정적 모멘텀 팩터",
      percent: value.factor,
      kind: "ETF",
    },
    ...stockTemplates.map((stock) => ({
      ...stock,
      percent: value.stocks / stockTemplates.length,
      kind: "주식" as const,
    })),
  ];

  if (value.government > 0) {
    holdings.push({
      ticker: "IEF",
      name: "미국 중기 국채 프록시",
      role: "국채 슬리브",
      percent: value.government,
      kind: "채권",
    });
  }
  if (value.credit > 0) {
    holdings.push({
      ticker: "IGIB",
      name: "우량 회사채 프록시",
      role: "투자등급 신용",
      percent: value.credit,
      kind: "채권",
    });
  }
  if (value.gold > 0) {
    holdings.push({
      ticker: "IAU",
      name: "iShares Gold Trust",
      role: "금·위기 분산",
      percent: value.gold,
      kind: "대체",
    });
  }
  if (value.cash > 0) {
    holdings.push({
      ticker: "KRW CASH",
      name: "원화 3개월 현금성 지수",
      role: "유동성·안전자산",
      percent: value.cash,
      kind: "현금",
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

function amountLabel(amount: number) {
  if (amount >= 100_000_000 && amount % 100_000_000 === 0) {
    return `${amount / 100_000_000}억원`;
  }
  if (amount >= 10_000_000 && amount % 10_000_000 === 0) {
    return `${amount / 10_000_000}천만원`;
  }
  return krw.format(amount);
}

export default function Home() {
  const [profileCode, setProfileCode] =
    useState<ProfileCode>("MODERATE");
  const [amount, setAmount] = useState(100_000_000);
  const profile = profiles.find(
    (candidate) => candidate.code === profileCode,
  )!;
  const holdings = useMemo(() => getHoldings(profile), [profile]);
  const riskAssets = profile.allocations
    .filter((item) =>
      ["market", "factor", "stocks"].includes(item.id),
    )
    .reduce((sum, item) => sum + item.percent, 0);
  const donutStyle = {
    "--donut": createDonut(profile.allocations),
  } as CSSProperties;

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="FIDI 홈">
          <span className="brand-mark">F</span>
          <span>
            <strong>FIDI</strong>
            <small>Portfolio Lab</small>
          </span>
        </a>
        <nav aria-label="주요 메뉴">
          <a href="#portfolio">포트폴리오</a>
          <a href="#holdings">편입종목</a>
          <a href="#rotation">교체규칙</a>
        </nav>
        <span className="model-pill">
          <i />
          KRW Dynamic V4
        </span>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">FIDI PORTFOLIO LAB · VERIFIED 34/34</p>
          <h1>
            투자자 유형을 고르면
            <br />
            <em>포트폴리오가 완성됩니다.</em>
          </h1>
          <p className="hero-description">
            자산군 비중은 위험성향에 맞춰 지키고, ETF와 개별주는
            시장 변화에 따라 규칙으로 다시 고릅니다.
          </p>
          <div className="hero-facts">
            <span>5개 투자자 유형</span>
            <span>ETF·주식 동적 선정</span>
            <span>원화 기준</span>
          </div>
        </div>

        <div className="hero-board" aria-label="운용 구조 요약">
          <div className="board-top">
            <span>운용 구조</span>
            <strong>비중은 정책으로, 종목은 규칙으로</strong>
          </div>
          <div className="flow-row">
            <div>
              <span>01</span>
              <strong>유형 선택</strong>
              <small>위험예산 확정</small>
            </div>
            <b>→</b>
            <div>
              <span>02</span>
              <strong>자산 배분</strong>
              <small>7개 슬리브</small>
            </div>
            <b>→</b>
            <div>
              <span>03</span>
              <strong>종목 선정</strong>
              <small>분기·주간 교체</small>
            </div>
          </div>
          <div className="board-note">
            <span className="pulse" />
            현재 일반형 초기종목은 V3에서 승계
          </div>
        </div>
      </section>

      <section className="selector-section" aria-labelledby="selector-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">STEP 01</p>
            <h2 id="selector-title">나의 투자자 유형</h2>
          </div>
          <p>유형을 바꾸면 아래 포트폴리오가 즉시 재계산됩니다.</p>
        </div>

        <div className="profile-grid" role="list">
          {profiles.map((candidate) => {
            const active = candidate.code === profileCode;
            return (
              <button
                className={`profile-card ${active ? "active" : ""}`}
                key={candidate.code}
                onClick={() => setProfileCode(candidate.code)}
                aria-pressed={active}
                type="button"
              >
                <span className="profile-topline">
                  <span className="risk-dots" aria-label={`위험도 ${candidate.riskLevel}`}>
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
                <span>{candidate.description}</span>
                <b>{active ? "선택됨" : "선택하기"}</b>
              </button>
            );
          })}
        </div>
      </section>

      <section className="portfolio-section" id="portfolio">
        <div className="section-heading">
          <div>
            <p className="eyebrow">STEP 02</p>
            <h2>{profile.name} 포트폴리오</h2>
          </div>
          <div className="amount-control">
            <span>투자금액</span>
            <strong>{amountLabel(amount)}</strong>
          </div>
        </div>

        <div className="amount-presets" aria-label="투자금액 선택">
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
          <label>
            <span className="sr-only">투자금액 조절</span>
            <input
              type="range"
              min="10000000"
              max="500000000"
              step="10000000"
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
            />
          </label>
        </div>

        {profile.code === "CONTEST" && (
          <div className="contest-alert" role="status">
            <span>대회형 활성화 전 확인</span>
            <strong>
              대회 규정 URL과 허용시장을 입력하면 실제 후보종목이
              채워집니다.
            </strong>
          </div>
        )}

        <div className="portfolio-grid">
          <article className="allocation-card">
            <div
              className="donut"
              style={donutStyle}
              aria-label={`${profile.name} 자산배분 도넛 차트`}
            >
              <div>
                <small>위험자산</small>
                <strong>{riskAssets}%</strong>
                <span>총 {amountLabel(amount)}</span>
              </div>
            </div>
            <div className="allocation-summary">
              <span>정기검토</span>
              <strong>{profile.cadence}</strong>
              <span>다음 검토</span>
              <strong>{profile.nextReview}</strong>
            </div>
            <p>
              비중은 유형 정책으로 유지하며, 편입종목만 점수와
              교체완충 규칙에 따라 변경됩니다.
            </p>
          </article>

          <article className="allocation-list-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">ALLOCATION</p>
                <h3>자산군별 목표비중</h3>
              </div>
              <span>합계 100%</span>
            </div>
            <div className="allocation-list">
              {profile.allocations
                .filter((allocation) => allocation.percent > 0)
                .map((allocation) => (
                  <div className="allocation-row" key={allocation.id}>
                    <span
                      className="color-dot"
                      style={{ background: allocation.color }}
                    />
                    <div>
                      <span>{allocation.label}</span>
                      <div className="bar">
                        <i
                          style={{
                            width: `${allocation.percent}%`,
                            background: allocation.color,
                          }}
                        />
                      </div>
                    </div>
                    <strong>{allocation.percent}%</strong>
                    <b>{krw.format((amount * allocation.percent) / 100)}</b>
                  </div>
                ))}
            </div>
          </article>

          <aside className="metric-stack">
            <article>
              <span>참고 연환산</span>
              <strong>{profile.cagr}</strong>
              <small>
                {profile.code === "CONTEST"
                  ? "대회 시작 후 집계"
                  : "현재 구성종목 소급 참고치"}
              </small>
            </article>
            <article>
              <span>
                {profile.code === "CONTEST"
                  ? "계좌 손실중단"
                  : "참고 최대낙폭"}
              </span>
              <strong>{profile.drawdown}</strong>
              <small>
                {profile.code === "CONTEST"
                  ? "일간 -3% · 주간 -6%"
                  : "실전 성과가 아닌 진단값"}
              </small>
            </article>
            <article className="verified-card">
              <span>정책 검증</span>
              <strong>34 / 34</strong>
              <small>설정·선별 규칙 테스트 PASS</small>
            </article>
          </aside>
        </div>
      </section>

      <section className="holdings-section" id="holdings">
        <div className="section-heading">
          <div>
            <p className="eyebrow">STEP 03</p>
            <h2>현재 편입 구조</h2>
          </div>
          <p>
            {profile.code === "CONTEST"
              ? "대회 규정 확인 후 슬롯별 실제 종목을 선정합니다."
              : "초기 V3 종목이며 첫 동적 검토부터 변경될 수 있습니다."}
          </p>
        </div>

        <div className="holding-grid">
          {holdings.map((holding) => (
            <article
              className={`holding-card ${holding.pending ? "pending" : ""}`}
              key={`${holding.ticker}-${holding.role}`}
            >
              <div className="ticker-row">
                <span>{holding.ticker.slice(0, 2)}</span>
                <div>
                  <strong>{holding.ticker}</strong>
                  <small>{holding.kind}</small>
                </div>
                {holding.pending && <b>선정 대기</b>}
              </div>
              <h3>{holding.name}</h3>
              <p>{holding.role}</p>
              <div className="holding-value">
                <strong>{holding.percent}%</strong>
                <span>{krw.format((amount * holding.percent) / 100)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rotation-section" id="rotation">
        <div className="rotation-copy">
          <p className="eyebrow">DYNAMIC SELECTION</p>
          <h2>
            무조건 고정하지 않고,
            <br />
            <em>교체도 규칙대로.</em>
          </h2>
          <p>
            후보사이트의 현재 목록을 과거에 소급하지 않습니다. 각
            검토일의 출처와 시각을 저장하고 다음 거래일부터 반영합니다.
          </p>
          <div className="source-links">
            <a
              href="https://www.funetf.co.kr/"
              target="_blank"
              rel="noreferrer"
            >
              FUNETF <span>ETF 후보 확인 ↗</span>
            </a>
            <a
              href="https://finance.naver.com/sise/"
              target="_blank"
              rel="noreferrer"
            >
              네이버금융 <span>개별주 후보 확인 ↗</span>
            </a>
          </div>
        </div>

        <div className="rotation-timeline">
          <article>
            <span>01</span>
            <div>
              <small>후보 생성</small>
              <h3>규모·유동성 필터</h3>
              <p>저유동성, 투자경고, 레버리지·인버스를 먼저 제외합니다.</p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <small>점수 계산</small>
              <h3>다기간 모멘텀</h3>
              <p>21·63·126·252일 수익률과 변동성·비용을 함께 봅니다.</p>
            </div>
          </article>
          <article>
            <span>03</span>
            <div>
              <small>교체 판단</small>
              <h3>완충값과 최소보유</h3>
              <p>조금 좋아진 후보로 자주 갈아타지 않도록 회전율을 통제합니다.</p>
            </div>
          </article>
          <article>
            <span>04</span>
            <div>
              <small>실행</small>
              <h3>사람 검토 후 반영</h3>
              <p>선정 결과는 주문 지시가 아니며, 다음 거래일 실행을 원칙으로 합니다.</p>
            </div>
          </article>
        </div>
      </section>

      <footer>
        <div>
          <span className="brand-mark">F</span>
          <strong>FIDI Portfolio Lab</strong>
        </div>
        <p>
          본 화면은 투자정책 시각화 및 연구용입니다. 과거 참고성과는
          미래수익을 보장하지 않으며 실제 주문 전 상품 적격성과 비용을
          확인해야 합니다.
        </p>
        <span>KRW Dynamic V4 · 2026.07.26</span>
      </footer>
    </main>
  );
}
