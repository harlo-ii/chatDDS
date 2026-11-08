// GET /api/books?category=fossil&page=1   → 카테고리별 창조과학 도서 목록
// GET /api/books?q=다윈&page=1            → 표제 검색 (도서 페이지 검색창, 등록 신청 화면)
// 국립중앙도서관 ISBN 서지정보 API (https://www.nl.go.kr/seoji/SearchApi.do) 사용.

import { BOOK_QUERIES, CATEGORY_IDS, type ApiBook, type BooksResponse, type CategoryId } from "../shared/catalog";
import { ApiFailure, cached, clampInt, cleanText, fail, getJson, type Env, type HandlerResult } from "./common";

const SEOJI = "https://www.nl.go.kr/seoji/SearchApi.do";
const PAGE_SIZE = 12;
const CATEGORY_TTL = 6 * 60 * 60 * 1000;
const SEARCH_TTL = 60 * 60 * 1000;

async function seoji(params: Record<string, string>, key: string) {
  const qs = new URLSearchParams({ cert_key: key, result_style: "json", ...params });
  const json = await getJson(`${SEOJI}?${qs}`, 12000);
  if (json.RESULT === "ERROR" || json.ERR_CODE) {
    const code = String(json.ERR_CODE ?? "");
    if (code === "010" || code === "011") {
      throw new ApiFailure("INVALID_KEY", "국립중앙도서관 인증키가 유효하지 않습니다. NL_API_KEY 값을 확인하세요.");
    }
    throw new ApiFailure("UPSTREAM", `국립중앙도서관 API 오류(${code}): ${json.ERR_MESSAGE ?? "알 수 없는 오류"}`);
  }
  return json as { TOTAL_COUNT?: string; docs?: any[] };
}

const norm = (s: string) => s.replace(/[\s·:;,.!?()[\]'"「」『』<>-]/g, "").toLowerCase();

function toDate(s: string): string {
  const d = (s || "").replace(/\D/g, "");
  if (d.length >= 8) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  if (d.length >= 6) return `${d.slice(0, 4)}-${d.slice(4, 6)}`;
  if (d.length === 4) return d;
  return "";
}

function https(url: string): string {
  const u = (url || "").trim();
  if (!u) return "";
  return u.startsWith("http://") ? "https://" + u.slice(7) : u;
}

function mapDoc(d: any, category: CategoryId | ""): ApiBook | null {
  const isbn = String(d.EA_ISBN || d.SET_ISBN || "").trim();
  const title = cleanText(d.TITLE);
  if (!isbn || !title) return null;
  const vol = cleanText(d.VOL);
  return {
    id: isbn,
    isbn,
    title: vol ? `${title} ${vol}` : title,
    author: cleanText(d.AUTHOR),
    publisher: cleanText(d.PUBLISHER),
    publishDate: toDate(d.PUBLISH_PREDATE),
    cover: https(d.TITLE_URL),
    description: cleanText(d.BOOK_INTRODUCTION || d.BOOK_SUMMARY, 1200),
    kdc: cleanText(d.KDC),
    subject: cleanText(d.SUBJECT),
    pages: cleanText(d.PAGE),
    price: cleanText(d.PRE_PRICE || d.REAL_PRICE),
    category,
    // 내부 정렬·중복 제거용 (응답 직전에 제거)
    ...({ _ebook: d.EBOOK_YN === "Y" } as object),
  };
}

/** 같은 책의 종이책/전자책/개정판 중복을 하나로 합침 (표지 있는 종이책 우선) */
function dedupe(list: ApiBook[]): ApiBook[] {
  const byKey = new Map<string, ApiBook>();
  const score = (b: ApiBook) => (b.cover ? 2 : 0) + ((b as any)._ebook ? 0 : 1);
  for (const b of list) {
    const k = norm(b.title) + "|" + norm(b.author).slice(0, 8);
    const prev = byKey.get(k);
    if (!prev || score(b) > score(prev) || (score(b) === score(prev) && b.publishDate > prev.publishDate)) byKey.set(k, b);
  }
  return [...byKey.values()];
}

const strip = (b: ApiBook): ApiBook => {
  const { _ebook, ...rest } = b as ApiBook & { _ebook?: boolean };
  void _ebook;
  return rest;
};

async function loadCategory(category: CategoryId, key: string): Promise<ApiBook[]> {
  const queries = BOOK_QUERIES[category];
  const results = await Promise.allSettled(queries.map(q => seoji({ title: q, page_no: "1", page_size: "40" }, key)));

  const keyFail = results.find(r => r.status === "rejected" && (r.reason as ApiFailure)?.code === "INVALID_KEY");
  if (keyFail) throw (keyFail as PromiseRejectedResult).reason;
  if (results.every(r => r.status === "rejected")) throw (results[0] as PromiseRejectedResult).reason;

  const all: ApiBook[] = [];
  results.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    // 쿼리의 모든 단어가 제목에 들어 있는 책만 채택 (API의 형태소 검색이 넓게 잡는 경우 대비)
    const tokens = queries[i].split(/\s+/).map(norm).filter(Boolean);
    for (const d of r.value.docs ?? []) {
      const b = mapDoc(d, category);
      if (!b) continue;
      const t = norm(b.title + " " + (d.SERIES_TITLE ?? ""));
      if (tokens.every(tok => t.includes(tok))) all.push(b);
    }
  });

  return dedupe(all).sort((a, b) => Number(!!b.cover) - Number(!!a.cover) || b.publishDate.localeCompare(a.publishDate));
}

export async function handleBooks(params: URLSearchParams, env: Env): Promise<HandlerResult> {
  const key = env.NL_API_KEY;
  if (!key) return fail(new ApiFailure("NO_KEY", "서버에 NL_API_KEY가 설정되지 않았습니다.", 503));

  const page = clampInt(params.get("page"), 1, 1, 100);
  const q = (params.get("q") ?? "").trim().slice(0, 60);
  const category = (params.get("category") ?? "") as CategoryId;

  try {
    if (q) {
      const body = await cached(`books:q:${q}:${page}`, SEARCH_TTL, async (): Promise<BooksResponse> => {
        const json = await seoji({ title: q, page_no: String(page), page_size: String(PAGE_SIZE) }, key);
        const books = dedupe((json.docs ?? []).map(d => mapDoc(d, "")).filter((b): b is ApiBook => !!b)).map(strip);
        const total = Number(json.TOTAL_COUNT ?? books.length) || 0;
        return { books, total, page, hasMore: page * PAGE_SIZE < total };
      });
      return { status: 200, body, maxAge: 1800 };
    }

    const cats: CategoryId[] = CATEGORY_IDS.includes(category) ? [category] : CATEGORY_IDS;
    const lists = await Promise.all(cats.map(c => cached(`books:cat:${c}`, CATEGORY_TTL, () => loadCategory(c, key))));
    // '전체'는 카테고리별 결과를 번갈아 섞어 한쪽으로 쏠리지 않게 함
    const merged: ApiBook[] = [];
    if (lists.length === 1) merged.push(...lists[0]);
    else {
      const seen = new Set<string>();
      for (let i = 0; lists.some(l => i < l.length); i++) {
        for (const l of lists) {
          const b = l[i];
          if (b && !seen.has(b.id)) { seen.add(b.id); merged.push(b); }
        }
      }
    }
    const start = (page - 1) * PAGE_SIZE;
    const body: BooksResponse = {
      books: merged.slice(start, start + PAGE_SIZE).map(strip),
      total: merged.length,
      page,
      hasMore: start + PAGE_SIZE < merged.length,
    };
    return { status: 200, body, maxAge: 3600 };
  } catch (e) {
    return fail(e);
  }
}
