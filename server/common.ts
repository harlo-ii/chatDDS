import type { ApiError } from "../shared/catalog";

export type Env = Record<string, string | undefined>;

export interface HandlerResult {
  status: number;
  body: unknown;
  /** Cache-Control max-age (초). 에러 응답엔 붙이지 않음 */
  maxAge?: number;
}

export class ApiFailure extends Error {
  constructor(public code: ApiError["error"]["code"], message: string, public status = 502) {
    super(message);
  }
}

export function fail(e: unknown): HandlerResult {
  if (e instanceof ApiFailure) {
    return { status: e.status, body: { error: { code: e.code, message: e.message } } satisfies ApiError };
  }
  const message = e instanceof Error ? e.message : String(e);
  return { status: 502, body: { error: { code: "UPSTREAM", message } } satisfies ApiError };
}

// ─── 메모리 캐시 (서버 인스턴스 단위, 쿼터 절약용) ─────────────────────────────

const store = new Map<string, { expires: number; value: Promise<unknown> }>();

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as Promise<T>;
  const value = load();
  store.set(key, { expires: Date.now() + ttlMs, value });
  // 실패한 요청은 캐시에 남기지 않음
  value.catch(() => store.delete(key));
  return value;
}

export async function getJson(url: string, timeoutMs = 10000): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } });
  } catch (e) {
    throw new ApiFailure("UPSTREAM", `외부 API 연결 실패: ${e instanceof Error ? e.message : e}`);
  }
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ApiFailure("UPSTREAM", `외부 API 응답을 해석할 수 없습니다 (HTTP ${res.status})`);
  }
  return Object.assign(json ?? {}, { __status: res.status });
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·" };

export function cleanText(s: unknown, max = 0): string {
  if (typeof s !== "string") return "";
  let t = s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (max && t.length > max) t = t.slice(0, max).trimEnd() + "…";
  return t;
}

export function clampInt(v: string | null, def: number, min: number, max: number) {
  const n = Number.parseInt(v ?? "", 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}
