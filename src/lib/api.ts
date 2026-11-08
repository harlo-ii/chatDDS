// 클라이언트 데이터 훅. /api 가 없거나 키가 없으면 샘플 데이터로 대체하고 source="sample"로 알려줌.
import { useCallback, useEffect, useRef, useState } from "react";
import { CHANNELS, type ApiBook, type ApiError, type BooksResponse, type CategoryId, type VideosResponse } from "../../shared/catalog";
import { SAMPLE_BOOKS, SAMPLE_VIDEOS } from "./sample";

export type Source = "live" | "sample";

export interface Loaded<T> {
  data: T;
  source: Source;
  /** source가 sample일 때 그 이유 */
  note?: string;
}

class HttpError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** 샘플로 대체할 실패인지 (키 미설정 / 서버 없음 / 네트워크 차단) */
const isFallback = (e: unknown) => !(e instanceof HttpError) || e.code === "NO_KEY" || e.code === "NO_SERVER";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new HttpError("NO_SERVER", "API 서버가 연결되어 있지 않습니다.");
  const json = await res.json();
  if (!res.ok || (json as ApiError).error) {
    const err = (json as ApiError).error ?? { code: "UPSTREAM", message: `HTTP ${res.status}` };
    throw new HttpError(err.code, err.message);
  }
  return json as T;
}

const memo = new Map<string, Promise<unknown>>();
function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (!memo.has(key)) {
    const p = load();
    memo.set(key, p);
    p.catch(() => memo.delete(key));
  }
  return memo.get(key) as Promise<T>;
}

function noteFor(e: unknown, what: string) {
  if (e instanceof HttpError && e.code === "NO_KEY") return `${what} API 키가 설정되지 않아 샘플 데이터를 보여주고 있어요.`;
  return `${what} API에 연결할 수 없어 샘플 데이터를 보여주고 있어요.`;
}

// ─── 영상 ────────────────────────────────────────────────────────────────────

export function fetchVideos(): Promise<Loaded<VideosResponse>> {
  return once("videos", async () => {
    try {
      const data = await getJson<VideosResponse>("/api/videos?perChannel=10");
      return { data, source: "live" as const };
    } catch (e) {
      if (!isFallback(e)) throw e;
      return {
        data: { videos: SAMPLE_VIDEOS, channels: CHANNELS, fetchedAt: new Date().toISOString() },
        source: "sample" as const,
        note: noteFor(e, "YouTube"),
      };
    }
  });
}

export interface AsyncState<T> {
  status: "loading" | "ready" | "error";
  value?: Loaded<T>;
  error?: string;
  reload: () => void;
}

export function useVideos(): AsyncState<VideosResponse> {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<Omit<AsyncState<VideosResponse>, "reload">>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    setState(s => (s.value ? s : { status: "loading" }));
    fetchVideos().then(
      value => alive && setState({ status: "ready", value }),
      e => alive && setState({ status: "error", error: e instanceof Error ? e.message : String(e) })
    );
    return () => { alive = false; };
  }, [tick]);
  const reload = useCallback(() => { memo.delete("videos"); setTick(t => t + 1); }, []);
  return { ...state, reload };
}

// ─── 도서 ────────────────────────────────────────────────────────────────────

export interface BookQuery {
  category?: CategoryId | "all";
  q?: string;
}

function sampleBooks({ category, q }: BookQuery, page: number): BooksResponse {
  let list = SAMPLE_BOOKS;
  if (q) list = list.filter(b => b.title.includes(q) || b.author.includes(q));
  else if (category && category !== "all") list = list.filter(b => b.category === category);
  return { books: page === 1 ? list : [], total: list.length, page, hasMore: false };
}

export function fetchBooks(query: BookQuery, page = 1): Promise<Loaded<BooksResponse>> {
  const params = new URLSearchParams({ page: String(page) });
  if (query.q) params.set("q", query.q);
  else if (query.category && query.category !== "all") params.set("category", query.category);
  const url = `/api/books?${params}`;
  return once(url, async () => {
    try {
      return { data: await getJson<BooksResponse>(url), source: "live" as const };
    } catch (e) {
      if (!isFallback(e)) throw e;
      return { data: sampleBooks(query, page), source: "sample" as const, note: noteFor(e, "국립중앙도서관") };
    }
  });
}

export interface BooksState {
  status: "idle" | "loading" | "ready" | "error";
  books: ApiBook[];
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  source?: Source;
  note?: string;
  error?: string;
  loadMore: () => void;
  reload: () => void;
}

/** enabled=false면 요청하지 않음 (검색어 입력 전 등) */
export function useBooks(query: BookQuery, enabled = true): BooksState {
  const key = `${query.category ?? "all"}|${query.q ?? ""}`;
  const [tick, setTick] = useState(0);
  const [s, setS] = useState<Omit<BooksState, "loadMore" | "reload">>({ status: "idle", books: [], total: 0, hasMore: false, loadingMore: false });
  const pageRef = useRef(1);
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    if (!enabled) { setS({ status: "idle", books: [], total: 0, hasMore: false, loadingMore: false }); return; }
    let alive = true;
    pageRef.current = 1;
    setS({ status: "loading", books: [], total: 0, hasMore: false, loadingMore: false });
    fetchBooks(query, 1).then(
      v => alive && setS({ status: "ready", books: v.data.books, total: v.data.total, hasMore: v.data.hasMore, loadingMore: false, source: v.source, note: v.note }),
      e => alive && setS({ status: "error", books: [], total: 0, hasMore: false, loadingMore: false, error: e instanceof Error ? e.message : String(e) })
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, tick]);

  const loadMore = useCallback(() => {
    const myKey = keyRef.current;
    const next = pageRef.current + 1;
    setS(prev => ({ ...prev, loadingMore: true }));
    fetchBooks(query, next).then(
      v => {
        if (keyRef.current !== myKey) return;
        pageRef.current = next;
        setS(prev => {
          const seen = new Set(prev.books.map(b => b.id));
          return { ...prev, books: [...prev.books, ...v.data.books.filter(b => !seen.has(b.id))], hasMore: v.data.hasMore, loadingMore: false };
        });
      },
      () => keyRef.current === myKey && setS(prev => ({ ...prev, loadingMore: false, hasMore: false }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => {
    for (const k of [...memo.keys()]) if (k.startsWith("/api/books")) memo.delete(k);
    setTick(t => t + 1);
  }, []);

  return { ...s, loadMore, reload };
}

// ─── ChatDDS ─────────────────────────────────────────────────────────────────

export interface ChatTurn { role: "user" | "assistant"; content: string }
export interface ChatSource { title: string; url: string; score?: number }
export interface ChatReply { answer: string; sources: ChatSource[] }

/** /api/chat 호출. 서버가 ChatDDS로 중계 (키는 서버에만 있음) */
export async function askChat(messages: ChatTurn[], signal?: AbortSignal): Promise<ChatReply> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new Error("서버에 연결할 수 없습니다. 개발 서버(npm run dev)가 실행 중인지 확인하세요.");
  }
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new Error("ChatDDS는 서버(/api)가 있는 환경에서만 동작합니다.");
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  return json as ChatReply;
}
