// ChatDDS 대화 상태. App 최상단에서 한 번만 만들어서 페이지를 오가도 대화가 유지됨.
// 브라우저 localStorage에 마지막 대화를 저장해 새로고침해도 이어짐 (실패해도 동작엔 영향 없음).
import { useCallback, useEffect, useRef, useState } from "react";
import { askChat, type ChatSource } from "./api";

export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  error?: boolean;
  at: number;
}

const STORE_KEY = "dds-chat-v1";
const TIMEOUT = 110_000;
const uid = () => Math.random().toString(36).slice(2, 10);

function load(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const list = raw ? (JSON.parse(raw) as ChatMsg[]) : [];
    return Array.isArray(list) ? list.filter(m => !m.error).slice(-40) : [];
  } catch {
    return [];
  }
}

export interface ChatState {
  msgs: ChatMsg[];
  pending: boolean;
  elapsed: number;
  send: (text: string) => void;
  retry: () => void;
  stop: () => void;
  reset: () => void;
}

export function useChat(): ChatState {
  const [msgs, setMsgs] = useState<ChatMsg[]>(load);
  const [pending, setPending] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(msgs.filter(m => !m.error).slice(-40))); } catch { /* 저장 불가 환경 */ }
  }, [msgs]);

  useEffect(() => {
    if (!pending) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [pending]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(async (history: ChatMsg[]) => {
    setMsgs(history);
    setPending(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, TIMEOUT);
    try {
      const reply = await askChat(history.map(({ role, content }) => ({ role, content })), ctrl.signal);
      setMsgs(m => [...m, { id: uid(), role: "assistant", content: reply.answer, sources: reply.sources, at: Date.now() }]);
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      if (aborted && !timedOut) return; // 사용자가 중지
      const text = aborted ? "응답이 너무 오래 걸려 요청을 중단했어요. 다시 시도해 주세요." : e instanceof Error ? e.message : String(e);
      setMsgs(m => [...m, { id: uid(), role: "assistant", content: text, error: true, at: Date.now() }]);
    } finally {
      clearTimeout(timer);
      if (abortRef.current === ctrl) abortRef.current = null;
      setPending(false);
    }
  }, []);

  const send = useCallback((text: string) => {
    const q = text.trim();
    if (!q || abortRef.current) return;
    const history = msgsRef.current.filter(m => !m.error);
    run([...history, { id: uid(), role: "user", content: q.slice(0, 4000), at: Date.now() }]);
  }, [run]);

  const retry = useCallback(() => {
    const list = msgsRef.current.filter(m => !m.error);
    if (list.length && list[list.length - 1].role === "user" && !abortRef.current) run(list);
  }, [run]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPending(false);
    // 답을 못 받은 마지막 질문은 입력창으로 돌려보낼 수 있도록 남겨 둠 (retry 가능)
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPending(false);
    setMsgs([]);
  }, []);

  return { msgs, pending, elapsed, send, retry, stop, reset };
}
