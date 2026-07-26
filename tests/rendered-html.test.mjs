import assert from "node:assert/strict";
import test from "node:test";

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
  assert.match(html, /포트폴리오/);
  assert.match(html, /FUNETF/);
  assert.match(html, /네이버금융/);
  assert.doesNotMatch(html, /codex-preview/);
  assert.doesNotMatch(html, /react-loading-skeleton/);
});

test("includes responsive and accessible controls", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /aria-pressed/);
  assert.match(html, /type="range"/);
  assert.match(html, /lang="ko"/);
  assert.match(html, /현재 편입 구조/);
  assert.match(html, /교체도 규칙대로/);
});
