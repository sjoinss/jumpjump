/**
 * 빌드(out/) 뒤에 서비스 워커를 만든다 (npm run build의 postbuild).
 * Next 정적 내보내기는 파일 이름에 해시가 붙어 매번 바뀌므로, out/의 파일 목록을 사전 캐시 목록으로 넣고
 * 파일 내용 전체의 해시를 버전으로 쓴다 → 하나라도 바뀌면 sw.js가 달라져 브라우저가 새 버전을 알아챈다.
 * 실행: node scripts/make-sw.mts  (Node 23.6+ 타입 제거 지원 필요)
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OUT = "out";
/** 미리 받지 않을 것: 소스맵, 서비스 워커 자신, 404 페이지 묶음, 점으로 시작하는 파일(.nojekyll 등은 서버가 안 줄 수 있음) */
const SKIP = [/\.map$/, /^sw\.js$/, /^404/, /^_not-found/, /(^|\/)\./];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(OUT)
  .map((f) => relative(OUT, f).split(sep).join("/"))
  .filter((f) => !SKIP.some((re) => re.test(f)))
  .sort();

const hash = createHash("sha256");
for (const f of files) {
  hash.update(f);
  hash.update(readFileSync(join(OUT, f)));
}
const version = hash.digest("hex").slice(0, 12);

// 페이지 주소("./")는 앱 셸(index.html)로 대신하므로 목록에는 파일만 넣는다
const template = readFileSync("scripts/sw.template.js", "utf8");
const sw = template.replace("__VERSION__", version).replace("__PRECACHE__", JSON.stringify(files, null, 2));
writeFileSync(join(OUT, "sw.js"), sw);

const bytes = files.reduce((s, f) => s + statSync(join(OUT, f)).size, 0);
console.log(`sw.js: ${files.length}개 파일 (${(bytes / 1024).toFixed(0)}KB) 사전 캐시, 버전 ${version}`);
