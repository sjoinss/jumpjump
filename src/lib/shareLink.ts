import { validateCharacter, type Result } from "./validate";
import type { Character } from "./schema";

/**
 * 캐릭터 공유 링크 (서버 없이): 캐릭터 그림을 주소의 # 뒤에 담는다.
 *   https://…/jumpjump/#c=z<압축 base64url>
 * # 뒤는 브라우저가 서버로 보내지 않으므로 그림이 어디에도 올라가지 않는다 — 링크를 받은 사람의 브라우저에서만 풀린다.
 * 받은 값은 파일 불러오기와 똑같이 validateCharacter(+ 이미지는 verifyImages)를 거친 뒤에만 쓴다.
 */

/** 링크 안 데이터의 식별·버전 (형식을 바꾸면 v를 올린다) */
const APP = "jumpjump";
const VERSION = 1;
const KEY = "c";
/** 메신저가 잘라 먹지 않을 만한 길이. 넘으면 링크 대신 파일 내보내기를 안내한다 */
export const SHARE_LINK_MAX = 30000;

type Payload = { app: string; v: number; hero: unknown };

const hasCompression = () => typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * 캐릭터 → 공유 링크. base는 게임 주소(# 없이).
 * 압축을 못 쓰는 브라우저는 압축 없이("j" 접두) 담는다. 너무 길면 실패.
 */
export async function buildShareLink(hero: Character, base: string): Promise<Result<string>> {
  const json = JSON.stringify({ app: APP, v: VERSION, hero } satisfies Payload);
  const bytes = new TextEncoder().encode(json);
  const body = hasCompression() ? "z" + toBase64Url(await pipe(bytes, new CompressionStream("deflate-raw"))) : "j" + toBase64Url(bytes);
  if (body.length > SHARE_LINK_MAX) {
    return { ok: false, error: "그림이 커서 링크에 담을 수 없어요. 설정 → 데이터 관리에서 파일로 내보내 주세요." };
  }
  return { ok: true, value: `${base}#${KEY}=${body}` };
}

/** 주소의 # 부분에 공유 캐릭터가 있는지 (있으면 담긴 문자열) */
export function readShareHash(hash: string): string | null {
  const m = new RegExp(`^#?${KEY}=([A-Za-z0-9_-]+)$`).exec(hash);
  return m ? m[1] : null;
}

/** 링크 속 문자열 → 검사를 통과한 캐릭터 (이미지 재인코딩은 부르는 쪽이 verifyImages로) */
export async function parseShareBody(body: string): Promise<Result<Character>> {
  const bad = { ok: false as const, error: "링크가 잘렸거나 올바르지 않아요. 보낸 사람에게 링크를 다시 받아 주세요." };
  if (body.length > SHARE_LINK_MAX + 1) return bad;
  let json: string;
  try {
    const bytes = fromBase64Url(body.slice(1));
    if (body[0] === "z") {
      if (!hasCompression()) return { ok: false, error: "이 브라우저에서는 공유 링크를 열 수 없어요. 최신 브라우저로 열어 주세요." };
      json = new TextDecoder().decode(await pipe(bytes, new DecompressionStream("deflate-raw")));
    } else if (body[0] === "j") json = new TextDecoder().decode(bytes);
    else return bad;
  } catch {
    return bad;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return bad;
  }
  const p = raw as Partial<Payload> | null;
  if (!p || typeof p !== "object" || p.app !== APP) return bad;
  if (p.v !== VERSION) return { ok: false, error: "새 버전에서 만든 링크예요. 게임을 새로고침한 뒤 다시 열어 주세요." };
  return validateCharacter(p.hero, "공유받은 캐릭터");
}
