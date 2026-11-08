// ChatDDS 플로팅 챗봇. 화면 오른쪽 아래 버튼 → 대화 패널.
import { useEffect, useRef, useState } from "react";
import { AlertCircle, ExternalLink, RefreshCw, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { askChat, type ChatSource, type ChatTurn } from "../lib/api";

interface Msg extends ChatTurn {
  id: string;
  sources?: ChatSource[];
  error?: boolean;
}

const SUGGESTIONS = [
  "노아의 홍수 증거는?",
  "캄브리아기 대폭발은 무엇인가요?",
  "젊은 지구론과 오랜 지구론의 차이는?",
  "DNA가 지적 설계의 증거인 이유는?",
];

const uid = () => Math.random().toString(36).slice(2);

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

export default function ChatWidget({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!pending) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [pending]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, pending]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text: string, history: Msg[] = msgs) => {
    const q = text.trim();
    if (!q || pending) return;
    const userMsg: Msg = { id: uid(), role: "user", content: q };
    const next = [...history.filter(m => !m.error), userMsg];
    setMsgs(next);
    setInput("");
    setPending(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), 110_000);
    try {
      const reply = await askChat(next.map(({ role, content }) => ({ role, content })), ctrl.signal);
      setMsgs(m => [...m, { id: uid(), role: "assistant", content: reply.answer, sources: reply.sources }]);
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      setMsgs(m => [...m, { id: uid(), role: "assistant", error: true, content: aborted ? "응답이 너무 오래 걸려 요청을 중단했어요. 다시 시도해 주세요." : (e instanceof Error ? e.message : String(e)) }]);
    } finally {
      clearTimeout(timer);
      setPending(false);
    }
  };

  const retry = () => {
    const lastUser = [...msgs].reverse().find(m => m.role === "user");
    if (!lastUser) return;
    const idx = msgs.lastIndexOf(lastUser);
    send(lastUser.content, msgs.slice(0, idx));
  };

  const reset = () => {
    abortRef.current?.abort();
    setMsgs([]);
    setPending(false);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed z-40 flex items-center gap-2 h-12 pl-4 pr-5 rounded-full bg-primary text-white shadow-lg shadow-primary/30 hover:bg-blue-600 active:scale-95 transition-all text-sm font-semibold"
          style={{ right: "calc(20px + env(safe-area-inset-right, 0px))", bottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}
          aria-label="ChatDDS 열기"
        >
          <Sparkles size={17} />ChatDDS에게 묻기
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="ChatDDS"
          className="fixed z-50 flex flex-col bg-card border border-border shadow-2xl shadow-black/15 overflow-hidden inset-x-0 bottom-0 h-[85vh] rounded-t-3xl sm:left-auto sm:right-5 sm:bottom-5 sm:h-[min(640px,calc(100vh-120px))] sm:w-[400px] sm:rounded-3xl"
        >
          {/* 헤더 */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-gradient-to-r from-[#1E40AF] to-[#2563EB] text-white">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Sparkles size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">ChatDDS</p>
              <p className="text-xs text-blue-100 leading-tight">창조과학 자료 기반 AI 답변</p>
            </div>
            {msgs.length > 0 && (
              <button onClick={reset} aria-label="새 대화" title="새 대화" className="p-2 rounded-lg hover:bg-white/15 transition-colors">
                <RotateCcw size={16} />
              </button>
            )}
            <button onClick={() => setOpen(false)} aria-label="닫기" className="p-2 rounded-lg hover:bg-white/15 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* 대화 */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-4 bg-background">
            {msgs.length === 0 && (
              <div className="pt-4">
                <p className="text-base font-bold text-foreground mb-1">{userName}님, 무엇이 궁금하세요?</p>
                <p className="text-sm text-muted-foreground mb-5">창조과학 자료를 찾아보고 출처와 함께 답해 드려요. 답변까지 보통 20~30초 걸려요.</p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)} className="text-left px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground hover:border-primary/40 hover:bg-secondary/50 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map(m =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] bg-primary text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">{m.content}</div>
                </div>
              ) : m.error ? (
                <div key={m.id} className="flex gap-2 items-start">
                  <div className="max-w-[90%] bg-red-50 border border-red-100 text-red-700 rounded-2xl rounded-bl-md px-4 py-3 text-sm">
                    <p className="flex items-start gap-2"><AlertCircle size={15} className="flex-shrink-0 mt-0.5" /><span className="break-words">{m.content}</span></p>
                    <button onClick={retry} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline">
                      <RefreshCw size={12} />다시 시도
                    </button>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex flex-col items-start gap-2">
                  <div className="max-w-[92%] bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">{m.content}</div>
                  {m.sources && m.sources.length > 0 && (
                    <div className="max-w-[92%] w-full">
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5 px-1">참고 자료</p>
                      <div className="flex flex-col gap-1.5">
                        {m.sources.slice(0, 5).map((s, i) => (
                          <a key={i} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/60 hover:bg-secondary text-xs text-foreground transition-colors min-w-0">
                            <span className="w-4 h-4 rounded bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 tabular-nums">{i + 1}</span>
                            <span className="truncate flex-1">{s.title}</span>
                            <span className="text-muted-foreground flex-shrink-0">{hostOf(s.url)}</span>
                            <ExternalLink size={11} className="text-muted-foreground flex-shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}

            {pending && (
              <div className="flex items-center gap-3">
                <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  자료 찾는 중 {elapsed}초{elapsed >= 35 && " · 서버가 깨어나는 중일 수 있어요"}
                </span>
              </div>
            )}
          </div>

          {/* 입력 */}
          <form
            className="flex items-end gap-2 p-3 border-t border-border bg-card"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}
            onSubmit={e => { e.preventDefault(); send(input); }}
          >
            <textarea
              id="chatdds-input"
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); }
              }}
              placeholder={pending ? "답변을 기다리는 중…" : "질문을 입력하세요"}
              disabled={pending}
              className="flex-1 min-w-0 resize-none max-h-32 bg-slate-50 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors disabled:opacity-60"
            />
            <button type="submit" disabled={pending || !input.trim()} aria-label="보내기" className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-blue-600 transition-colors disabled:opacity-40">
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
