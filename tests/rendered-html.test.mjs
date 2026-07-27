import assert from "node:assert/strict";
import test from "node:test";

function latestKoreaDateLabel(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}.${parts.month}.${parts.day}`;
}

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: {
        accept: "text/html",
        host: "localhost",
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the FIDI portfolio dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /FIDI/);
  assert.match(html, /KRW Dynamic V4/);
  assert.match(html, /투자자 유형/);
  assert.match(html, /중위험형/);
  assert.match(html, /대회형/);
  assert.match(html, /현재 투자 구성/);
  assert.match(html, /클릭 한 번에 설계하세요/);
  assert.doesNotMatch(html, /ETF에만 몰아넣지 않습니다/);
  assert.match(html, /오늘 가격으로 구성 확인/);
  assert.match(html, /오늘 구성 확인/);
  assert.match(html, /Massive 미국 종가·배당/);
  assert.match(html, /교체·비용 확인 순서/);
  assert.match(html, /매일 점검/);
  assert.match(html, /투자 유형별로 확인하기/);
  assert.match(html, /FUNETF/);
  assert.match(html, /네이버 금융/);
  assert.match(html, /TIGER 미국S&amp;P500/);
  assert.match(html, /TIGER 미국나스닥100/);
  assert.match(html, /NVIDIA Corporation/);
  assert.match(html, /현대자동차\(주\)/);
  assert.match(html, /KODEX 종합채권\(AA-이상\) 액티브/);
  assert.match(html, /KODEX 머니마켓액티브/);
  assert.doesNotMatch(html, /ETF-RANK|CORE-01|STOCK-01|KR GOV 3Y/);
  assert.doesNotMatch(html, /codex-preview/);
  assert.doesNotMatch(html, /react-loading-skeleton/);
});

test("includes responsive and accessible controls", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /aria-pressed/);
  assert.match(html, /type="range"/);
  assert.match(html, /type="search"/);
  assert.match(html, /lang="ko"/);
  assert.match(html, /현재 투자 구성/);
  assert.match(html, /구성 기준일/);
  assert.match(html, new RegExp(latestKoreaDateLabel().replaceAll(".", "\\.")));
  assert.match(html, /상품 확인일/);
  assert.match(html, /최신 시세/);
  assert.match(html, /매수·매도 주문을 대신하지 않습니다/);
  assert.match(html, /선택안 링크 복사/);
  assert.match(html, /목표 비중/);
  assert.match(html, /자산 비중은 투자 성향에 맞춰 정하고/);
  assert.match(html, /종목은 최신 데이터로 고릅니다/);
  assert.doesNotMatch(html, /모델 편입 · 교체 대상/);
  assert.doesNotMatch(html, /자동 주문/);
  assert.doesNotMatch(html, /연 8~12%/);
});
