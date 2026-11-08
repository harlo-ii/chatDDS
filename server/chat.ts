// POST /api/chat  { messages: [{ role: "user" | "assistant", content: string }] }
// ChatDDS(창조과학 RAG 챗봇, OpenAI Chat Completions 호환) 프록시. 키는 서버 env(CHATDDS_API_KEY)에만 둠.

import { ApiFailure, fail, type Env, type HandlerResult } from "./common";

const BASE = "https://chatdds-biz-server.onrender.com/v1";
const MODEL = "gpt-5.4";
const TIMEOUT = 100_000; // 보통 20~30초, 콜드스타트 시 더 걸림
const MAX_TURNS = 20;
const MAX_CHARS = 4000;

export interface ChatMessage { role: "user" | "assistant"; content: string }
export interface ChatSource { title: string; url: string; score?: number }
export interface ChatResponse { answer: string; sources: ChatSource[] }

function validate(body: unknown): ChatMessage[] {
  const msgs = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(msgs) || msgs.length === 0) throw new ApiFailure("BAD_REQUEST", "messages가 비어 있습니다.", 400);
  const clean = msgs.slice(-MAX_TURNS).map(m => {
    const role = (m as ChatMessage)?.role;
    const content = String((m as ChatMessage)?.content ?? "").trim().slice(0, MAX_CHARS);
    if ((role !== "user" && role !== "assistant") || !content) throw new ApiFailure("BAD_REQUEST", "메시지 형식이 올바르지 않습니다.", 400);
    return { role, content };
  });
  if (clean[clean.length - 1].role !== "user") throw new ApiFailure("BAD_REQUEST", "마지막 메시지는 질문이어야 합니다.", 400);
  return clean;
}

/** GET /api/chat — 브라우저로 열었을 때 키 설정 여부만 알려 주는 상태 확인용 */
export async function handleChatStatus(_p: URLSearchParams, env: Env): Promise<HandlerResult> {
  const keyConfigured = !!env.CHATDDS_API_KEY;
  return {
    status: keyConfigured ? 200 : 503,
    body: {
      ok: keyConfigured,
      keyConfigured,
      usage: 'POST /api/chat  { "messages": [{ "role": "user", "content": "질문" }] }',
    },
  };
}

export async function handleChat(body: unknown, env: Env): Promise<HandlerResult> {
  const key = env.CHATDDS_API_KEY;
  if (!key) return fail(new ApiFailure("NO_KEY", "서버에 CHATDDS_API_KEY가 설정되지 않았습니다.", 503));
  try {
    const messages = validate(body);
    let res: Response;
    try {
      res = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: MODEL, messages }),
        signal: AbortSignal.timeout(TIMEOUT),
      });
    } catch (e) {
      const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      throw new ApiFailure("UPSTREAM", timeout ? "ChatDDS 응답 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요." : "ChatDDS 서버에 연결할 수 없습니다.", 504);
    }

    const json: any = await res.json().catch(() => ({}));
    if (res.status === 401) throw new ApiFailure("INVALID_KEY", "ChatDDS API 키가 유효하지 않습니다. CHATDDS_API_KEY 값을 확인하세요.");
    if (!res.ok || json.error) {
      const msg: string = json.error?.message ?? `HTTP ${res.status}`;
      throw new ApiFailure("UPSTREAM", `ChatDDS 서버 오류: ${msg}`, 502);
    }

    const answer: string = json.answer ?? json.choices?.[0]?.message?.content ?? "";
    const sources: ChatSource[] = Array.isArray(json.sources)
      ? json.sources
          .filter((s: any) => s && typeof s.url === "string" && /^https?:\/\//.test(s.url))
          .map((s: any) => ({ title: String(s.title || s.url), url: s.url, score: typeof s.score === "number" ? s.score : undefined }))
      : [];
    if (!answer) throw new ApiFailure("UPSTREAM", "ChatDDS가 빈 답변을 보냈습니다.");
    return { status: 200, body: { answer, sources } satisfies ChatResponse };
  } catch (e) {
    return fail(e);
  }
}
