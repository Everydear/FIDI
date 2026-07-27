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
  assert.match(html, /현재 모델 편입안/);
  assert.match(html, /오늘 데이터로 운용 가이드 만들기/);
  assert.match(html, /오늘 운용 가이드 계산/);
  assert.match(html, /Massive 미국 종가·배당/);
  assert.match(html, /교체·비용·승인 가이드/);
  assert.match(html, /매일 점검/);
  assert.match(html, /유형별 주기로 실행/);
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
  assert.match(html, /현재 모델 편입안/);
  assert.match(html, /최신 편입 기준일/);
  assert.match(html, new RegExp(latestKoreaDateLabel().replaceAll(".", "\\.")));
  assert.match(html, /라인업 검증일/);
  assert.match(html, /실시간 시세/);
  assert.match(html, /미연동/);
  assert.match(html, /선택안 링크 복사/);
  assert.match(html, /목표 자산배분/);
  assert.match(html, /종목은 데이터로/);
  assert.doesNotMatch(html, /모델 편입 · 교체 대상/);
  assert.doesNotMatch(html, /연 8~12%/);
});
