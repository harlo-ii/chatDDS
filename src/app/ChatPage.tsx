// 커뮤니티 = ChatDDS 대화 화면. 질문 → /api/chat → ChatDDS(창조과학 RAG) 답변 + 출처.
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle, ArrowUp, Baby, Bone, BookMarked, Check, Copy, Dna, ExternalLink, Info,
  Mountain, RefreshCw, RotateCcw, Sparkles, Square, Telescope, User, Zap, type LucideIcon,
} from "lucide-react";
import type { ChatState, ChatMsg } from "../lib/useChat";

export interface ChatRequest {
  /** 입력창에 채워 둘 문장 */
  draft?: string;
  /** true면 바로 전송 */
  autoSend?: boolean;
}

const TOPICS: { label: string; icon: LucideIcon; color: string; q: string }[] = [
  { label: "우주·천문", icon: Telescope, color: "#2563EB", q: "별빛이 수십억 광년을 이동해 왔다면 우주는 오래된 것 아닌가요?" },
  { label: "지구·지질", icon: Mountain, color: "#0EA5E9", q: "노아의 홍수를 지지하는 지질학적 증거는 무엇인가요?" },
  { label: "생명·유전", icon: Dna, color: "#10B981", q: "DNA 정보는 어떻게 지적 설계를 보여주나요?" },
  { label: "화석·공룡", icon: Bone, color: "#F59E0B", q: "공룡과 사람이 함께 살았다는 증거가 있나요?" },
  { label: "창조와 진화", icon: Zap, color: "#6366F1", q: "창조론과 진화론의 가장 큰 차이는 무엇인가요?" },
  { label: "성경과 과학", icon: BookMarked, color: "#EC4899", q: "창세기의 6일 창조는 문자 그대로의 하루인가요?" },
  { label: "어린이·청소년", icon: Baby, color: "#14B8A6", q: "아이에게 창조과학을 어떻게 설명하면 좋을까요?" },
];

// ─── 가벼운 마크다운 렌더러 (HTML 주입 없이 React 요소로만 만듦) ───────────────

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={`${key}-${i++}`} className="font-semibold text-foreground">{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={`${key}-${i++}`} className="px-1 py-0.5 rounded bg-slate-100 text-[0.9em]">{t.slice(1, -1)}</code>);
    else {
      const [, label, href] = /\[([^\]]+)\]\(([^)]+)\)/.exec(t)!;
      out.push(<a key={`${key}-${i++}`} href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">{label}</a>);
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flushPara = () => {
    if (para.length) {
      const k = `p${blocks.length}`;
      blocks.push(<p key={k}>{para.map((l, i) => <Fragment key={i}>{i > 0 && <br />}{inline(l, `${k}-${i}`)}</Fragment>)}</p>);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const k = `l${blocks.length}`;
      const items = list.items.map((it, i) => <li key={i}>{inline(it, `${k}-${i}`)}</li>);
      blocks.push(list.ordered
        ? <ol key={k} className="list-decimal pl-5 space-y-1">{items}</ol>
        : <ul key={k} className="list-disc pl-5 space-y-1">{items}</ul>);
      list = null;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^#{1,4}\s+(.*)$/.exec(line);
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if (h) { flushPara(); flushList(); blocks.push(<p key={`h${blocks.length}`} className="font-bold text-foreground pt-1">{inline(h[1], `h${blocks.length}`)}</p>); continue; }
    if (ul || ol) {
      flushPara();
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
      list.items.push((ul ?? ol)![1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return <div className="space-y-3">{blocks}</div>;
}

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

// ─── 메시지 ──────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* 클립보드 권한 없음 */ }
  };
  return (
    <button onClick={copy} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
      {done ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}{done ? "복사됨" : "복사"}
    </button>
  );
}

function Message({ m, userName, onRetry, isLast }: { m: ChatMsg; userName: string; onRetry: () => void; isLast: boolean }) {
  if (m.role === "user") {
    return (
      <div id={`msg-${m.id}`} className="flex justify-end gap-3 scroll-mt-24">
        <div className="max-w-[85%] sm:max-w-[75%] bg-primary text-white rounded-2xl rounded-tr-md px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {m.content}
        </div>
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 hidden sm:flex" title={userName}>
          <User size={14} className="text-primary" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
        <Sparkles size={14} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-muted-foreground mb-1.5">ChatDDS</p>
        {m.error ? (
          <div className="bg-red-50 border border-red-100 text-red-700 rounded-2xl rounded-tl-md px-4 py-3 text-sm">
            <p className="flex items-start gap-2"><AlertCircle size={15} className="flex-shrink-0 mt-0.5" /><span className="break-words">{m.content}</span></p>
            {isLast && (
              <button onClick={onRetry} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline">
                <RefreshCw size={12} />다시 시도
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="bg-card border border-border rounded-2xl rounded-tl-md px-5 py-4 text-[15px] text-foreground/90 leading-relaxed break-words">
              <Markdown text={m.content} />
            </div>
            {m.sources && m.sources.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">참고 자료 {m.sources.length}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {m.sources.slice(0, 6).map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-secondary/40 transition-colors min-w-0">
                      <span className="w-5 h-5 rounded-md bg-secondary text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 tabular-nums">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-foreground truncate">{s.title}</span>
                        <span className="block text-xs text-muted-foreground truncate">{hostOf(s.url)}</span>
                      </span>
                      <ExternalLink size={12} className="text-muted-foreground flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-2 flex items-center gap-3">
              <CopyButton text={m.content} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── 페이지 ──────────────────────────────────────────────────────────────────

export default function ChatPage({ chat, userName, request }: { chat: ChatState; userName: string; request?: ChatRequest }) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const handled = useRef<ChatRequest | undefined>(undefined);
  const { msgs, pending, elapsed } = chat;
  const lastUnanswered = msgs.length > 0 && msgs[msgs.length - 1].role === "user" && !pending;

  // 다른 화면에서 넘어온 질문 처리 (홈 질문창, 영상·도서 상세의 "ChatDDS에게 묻기")
  useEffect(() => {
    if (!request || handled.current === request) return;
    handled.current = request;
    if (request.autoSend && request.draft) chat.send(request.draft);
    else if (request.draft) { setInput(request.draft); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [request, chat]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: msgs.length ? "smooth" : "auto", block: "end" });
  }, [msgs.length, pending]);

  // 입력창 높이 자동 조절
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, [input]);

  const submit = () => {
    if (!input.trim() || pending) return;
    chat.send(input);
    setInput("");
  };

  const pick = (q: string) => {
    if (pending) return;
    if (msgs.length === 0) chat.send(q);
    else { setInput(q); inputRef.current?.focus(); }
  };

  const questions = msgs.filter(m => m.role === "user");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[232px_minmax(0,1fr)] gap-8 items-start">
      {/* 사이드: 주제별 질문 · 이번 대화 */}
      <aside className="hidden lg:flex flex-col gap-6 sticky top-20">
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">주제별로 물어보기</p>
          <div className="flex flex-col gap-1">
            {TOPICS.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.label} onClick={() => pick(t.q)} disabled={pending} title={t.q}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm text-foreground hover:bg-card hover:shadow-sm transition-all text-left disabled:opacity-50">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${t.color}18` }}>
                    <Icon size={14} style={{ color: t.color }} />
                  </span>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {questions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">이번 대화의 질문</p>
            <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
              {questions.map(q => (
                <button key={q.id} onClick={() => document.getElementById(`msg-${q.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="text-left px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-card truncate transition-colors">
                  {q.content}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground leading-relaxed">
          <p className="flex items-center gap-1.5 font-semibold text-foreground mb-1.5"><Info size={13} className="text-primary" />ChatDDS 안내</p>
          창조과학 자료를 검색해 출처와 함께 답해요. 답변에 20~30초 정도 걸리고, 중요한 내용은 참고 자료에서 직접 확인하세요.
        </div>
      </aside>

      {/* 대화 영역 */}
      <section className="min-w-0 flex flex-col min-h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">커뮤니티</h1>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-secondary px-2 py-0.5 rounded-full">
                <Sparkles size={11} />ChatDDS
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">궁금한 창조과학 질문을 ChatDDS에게 물어보세요.</p>
          </div>
          {msgs.length > 0 && (
            <button onClick={() => { chat.reset(); setInput(""); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-secondary transition-colors flex-shrink-0">
              <RotateCcw size={14} />새 대화
            </button>
          )}
        </div>

        <div className="flex-1 w-full max-w-3xl mx-auto">
          {msgs.length === 0 ? (
            <div className="py-6 sm:py-10">
              <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center mb-5 shadow-lg shadow-primary/20">
                <Sparkles size={22} className="text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2" style={{ textWrap: "balance" }}>{userName}님, 무엇이 궁금하세요?</h2>
              <p className="text-muted-foreground mb-8">우주의 나이부터 화석, DNA, 성경 해석까지. 질문하면 창조과학 자료를 찾아 답해 드려요.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TOPICS.slice(0, 6).map(t => {
                  const Icon = t.icon;
                  return (
                    <button key={t.label} onClick={() => pick(t.q)}
                      className="group text-left p-4 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: t.color }}>
                        <Icon size={13} />{t.label}
                      </span>
                      <span className="block text-sm text-foreground leading-snug group-hover:text-primary transition-colors">{t.q}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {msgs.map((m, i) => (
                <Message key={m.id} m={m} userName={userName} onRetry={chat.retry} isLast={i === msgs.length - 1} />
              ))}

              {pending && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Sparkles size={14} className="text-white animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">ChatDDS</p>
                    <div className="inline-flex items-center gap-3 bg-card border border-border rounded-2xl rounded-tl-md px-4 py-3">
                      <span className="flex gap-1">
                        {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />)}
                      </span>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        자료를 찾고 답변을 쓰는 중 · {elapsed}초
                      </span>
                    </div>
                    {elapsed >= 35 && <p className="text-xs text-muted-foreground mt-1.5">서버가 잠에서 깨는 중이면 1분 넘게 걸릴 수 있어요.</p>}
                  </div>
                </div>
              )}

              {lastUnanswered && (
                <div className="flex items-center gap-2 pl-11 text-sm text-muted-foreground">
                  답변을 받지 못한 질문이에요.
                  <button onClick={chat.retry} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"><RefreshCw size={13} />다시 보내기</button>
                </div>
              )}
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* 입력창 */}
        <div className="sticky bottom-0 z-10 pt-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] bg-gradient-to-t from-background via-background to-background/0">
          <form className="w-full max-w-3xl mx-auto" onSubmit={e => { e.preventDefault(); submit(); }}>
            <div className="flex items-end gap-2 bg-card border border-border rounded-2xl p-2 pl-4 shadow-lg shadow-black/5 focus-within:border-primary transition-colors">
              <label htmlFor="community-question" className="sr-only">질문</label>
              <textarea
                id="community-question"
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
                }}
                placeholder={pending ? "답변을 기다리는 중이에요…" : "창조과학에 대해 질문해 보세요"}
                className="flex-1 min-w-0 resize-none bg-transparent py-2 text-[15px] text-foreground outline-none placeholder:text-slate-400 max-h-[180px]"
              />
              {pending ? (
                <button type="button" onClick={chat.stop} aria-label="중지" title="중지"
                  className="flex-shrink-0 w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-slate-700 transition-colors">
                  <Square size={13} fill="currentColor" />
                </button>
              ) : (
                <button type="submit" disabled={!input.trim()} aria-label="보내기"
                  className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-blue-600 transition-colors disabled:opacity-40">
                  <ArrowUp size={17} />
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground text-center mt-2"><span className="hidden sm:inline">Enter로 보내기 · Shift+Enter 줄바꿈 · </span>ChatDDS의 답변은 정확하지 않을 수 있어요</p>
          </form>
        </div>
      </section>
    </div>
  );
}
