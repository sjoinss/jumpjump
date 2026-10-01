import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchSkinByName, isValidMcName } from "../src/editor/skinFetch";

const png = () => new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]), { status: 200, headers: { "content-type": "image/png" } });

test("마인크래프트 아이디 규칙: 영문·숫자·밑줄 3~16자", () => {
  for (const ok of ["Notch", "abc", "a_b_c", "Player1234567890"]) assert.ok(isValidMcName(ok), ok);
  for (const bad of ["ab", "한글이름", "has space", "toolong_name_12345", "a-b", ""]) assert.ok(!isValidMcName(bad), bad);
});

test("스킨 받아오기: minotar에서 받으면 PNG 파일, 아이디만 주소에 담는다", async () => {
  const urls: string[] = [];
  const r = await fetchSkinByName(" Notch ", (async (url: string) => {
    urls.push(url);
    return png();
  }) as typeof fetch);
  assert.ok(r.ok);
  assert.equal(r.ok && r.file.name, "Notch.png");
  assert.deepEqual(urls, ["https://minotar.net/skin/Notch"]);
});

test("스킨 받아오기: 없는 아이디(404)는 찾을 수 없다고, 잘못된 아이디는 요청하지 않는다", async () => {
  let calls = 0;
  const notFound = (async () => {
    calls++;
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  const r = await fetchSkinByName("nobody_here", notFound);
  assert.ok(!r.ok && r.message.includes("찾을 수 없어요"));
  assert.equal(calls, 1, "mc-heads는 없는 아이디에도 기본 스킨을 주므로 넘어가지 않음");

  const bad = await fetchSkinByName("a b", notFound);
  assert.ok(!bad.ok && bad.message.includes("3~16자"));
  assert.equal(calls, 1);
});

test("스킨 받아오기: minotar에 닿지 못하면 mc-heads로, 둘 다 안 되면 연결 확인 안내", async () => {
  const urls: string[] = [];
  const r = await fetchSkinByName("Notch", (async (url: string) => {
    urls.push(url);
    if (url.includes("minotar")) throw new TypeError("network");
    return png();
  }) as typeof fetch);
  assert.ok(r.ok);
  assert.deepEqual(urls, ["https://minotar.net/skin/Notch", "https://mc-heads.net/skin/Notch"]);

  const down = await fetchSkinByName("Notch", (async () => {
    throw new TypeError("offline");
  }) as typeof fetch);
  assert.ok(!down.ok && down.message.includes("인터넷"));
});
