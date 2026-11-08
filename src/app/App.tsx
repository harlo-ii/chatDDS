import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Bell, Bookmark, User, Home, PlayCircle, BookOpen, MessageSquare,
  ChevronRight, ChevronDown, X, Check, AlertCircle, Clock, Eye,
  Plus, ArrowLeft, Calendar,
  Menu, Globe, Microscope, Layers, Dna, Bone, Zap, BookMarked, Baby,
  Send, ExternalLink, RefreshCw, ShieldCheck, AlertTriangle,
  CheckCircle, XCircle, Telescope, Mountain,
  Lock, LogIn, LogOut, Eye as EyeIcon, EyeOff, UserPlus, Sparkles
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ApiBook, ApiVideo, CategoryId } from "../../shared/catalog";
import { useBooks, useVideos, type Source } from "../lib/api";
import ChatPage, { type ChatRequest } from "./ChatPage";
import { useChat } from "../lib/useChat";

// ─── Auth Types ───────────────────────────────────────────────────────────────

interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
}

const ACCOUNTS: { username: string; password: string; user: AuthUser }[] = [
  {
    username: "admin",
    password: "admin1234",
    user: { id: "u_admin", username: "admin", displayName: "관리자", isAdmin: true },
  },
  {
    username: "user1",
    password: "user1234",
    user: { id: "u1", username: "user1", displayName: "일반사용자", isAdmin: false },
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

type Page = "home" | "videos" | "video-detail" | "books" | "book-detail" | "community" | "search" | "admin" | "book-register";
type ToastType = "success" | "error" | "info";

type Video = ApiVideo;
type Book = ApiBook & { status?: "pending" | "reviewing" | "supplement" | "approved" | "rejected" };

// ─── Mock Data ────────────────────────────────────────────────────────────────

const CATEGORIES: { id: CategoryId; label: string; icon: typeof Telescope; color: string }[] = [
  { id: "astronomy", label: "우주·천문", icon: Telescope, color: "#2563EB" },
  { id: "geology", label: "지구·지질", icon: Mountain, color: "#0EA5E9" },
  { id: "genetics", label: "생명·유전", icon: Dna, color: "#10B981" },
  { id: "fossil", label: "화석·공룡", icon: Bone, color: "#F59E0B" },
  { id: "creation", label: "창조와 진화", icon: Zap, color: "#6366F1" },
  { id: "bible", label: "성경과 과학", icon: BookMarked, color: "#EC4899" },
  { id: "children", label: "어린이·청소년", icon: Baby, color: "#14B8A6" },
];

type AdminBook = Book & { applicant: string; reason: string; appliedDate: string };

const MOCK_ADMIN_BOOKS: AdminBook[] = [
  {
    id: "ab1",
    title: "진화론의 붕괴",
    author: "하룬 야햐",
    publisher: "글로벌콘텐츠",
    publishDate: "2020-07-15",
    isbn: "9788996785774",
    cover: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=300&h=400&fit=crop&auto=format",
    description: "진화론의 과학적 근거가 얼마나 취약한지를 방대한 자료를 통해 증명합니다.",
    category: "creation",
    kdc: "", subject: "", pages: "", price: "",
    status: "pending",
    applicant: "진리탐구자",
    reason: "DDS 커뮤니티에 아직 등록되지 않은 중요한 창조과학 도서입니다.",
    appliedDate: "2024-03-19",
  },
  {
    id: "ab2",
    title: "화석이 말하는 창조",
    author: "두에인 기쉬",
    publisher: "한국창조과학회",
    publishDate: "2017-04-10",
    isbn: "9788991907263",
    cover: "https://images.unsplash.com/photo-1550399105-c4db5fb85c18?w=300&h=400&fit=crop&auto=format",
    description: "화석 기록을 창조론적 시각으로 해석한 연구서.",
    category: "fossil",
    kdc: "", subject: "", pages: "", price: "",
    status: "reviewing",
    applicant: "화석학도",
    reason: "화석 분야의 중요 참고 도서로 커뮤니티에 공유하고 싶습니다.",
    appliedDate: "2024-03-17",
  },
];

// ─── Utility ──────────────────────────────────────────────────────────────────

function formatNum(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`;
  return n.toString();
}

function formatDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diff === 0) return "오늘";
  if (diff < 7) return `${diff}일 전`;
  if (diff < 30) return `${Math.floor(diff / 7)}주 전`;
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending:   { label: "검토 대기", color: "#64748B", bg: "#F1F5F9" },
    reviewing: { label: "검토 중",   color: "#D97706", bg: "#FEF3C7" },
    supplement:{ label: "보완 요청", color: "#7C3AED", bg: "#EDE9FE" },
    approved:  { label: "승인 완료", color: "#059669", bg: "#D1FAE5" },
    rejected:  { label: "반려",      color: "#DC2626", bg: "#FEE2E2" },
  };
  const s = map[status] || map["pending"];
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 whitespace-nowrap" style={{ color: s.color, background: s.bg }}>
      {status === "approved" && <CheckCircle size={10} />}
      {status === "rejected" && <XCircle size={10} />}
      {status === "reviewing" && <Clock size={10} />}
      {status === "supplement" && <AlertTriangle size={10} />}
      {s.label}
    </span>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />;
}

function VideoCard({ video, onClick, onSave, saved }: { video: Video; onClick: () => void; onSave: () => void; saved: boolean }) {
  return (
    <div className="group bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border border-border flex flex-col" onClick={onClick}>
      <div className="relative overflow-hidden bg-slate-100">
        <img src={video.thumbnail} alt={video.title} loading="lazy" className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300" />
        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-mono">{video.duration}</span>
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 mb-2">{video.title}</h3>
        <p className="text-xs text-muted-foreground mb-3 truncate">{video.channel}</p>
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Eye size={11} />{formatNum(video.views)}</span>
            <span>{formatDate(video.date)}</span>
          </div>
          <button aria-label="저장" onClick={e => { e.stopPropagation(); onSave(); }} className={`p-1.5 rounded-lg transition-colors ${saved ? "text-primary bg-secondary" : "text-muted-foreground hover:text-primary hover:bg-secondary"}`}>
            <Bookmark size={14} fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** 표지 이미지. 국중도 데이터에 표지가 없거나 로드 실패 시 제목으로 만든 대체 표지 */
function BookCover({ book, className = "" }: { book: Pick<Book, "cover" | "title" | "category">; className?: string }) {
  const [failed, setFailed] = useState(false);
  const color = CATEGORIES.find(c => c.id === book.category)?.color ?? "#2563EB";
  if (book.cover && !failed) {
    return <img src={book.cover} alt={book.title} loading="lazy" onError={() => setFailed(true)} className={`w-full h-full object-cover ${className}`} />;
  }
  return (
    <div className={`w-full h-full flex flex-col justify-between p-1.5 text-white ${className}`} style={{ background: `linear-gradient(160deg, ${color}, ${color}cc)` }} aria-label={book.title}>
      <BookOpen size={10} className="opacity-70" />
      <span className="text-[9px] leading-tight font-semibold line-clamp-4 break-keep">{book.title}</span>
    </div>
  );
}

function BookCard({ book, onClick, onSave, saved }: { book: Book; onClick: () => void; onSave: () => void; saved: boolean }) {
  const cat = CATEGORIES.find(c => c.id === book.category);
  return (
    <div className="group bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border border-border flex flex-col" onClick={onClick}>
      <div className="p-5 flex gap-4 flex-1">
        <div className="flex-shrink-0 w-16 h-24 bg-slate-100 rounded-lg overflow-hidden shadow-sm">
          <BookCover book={book} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 mb-1">{book.title}</h3>
          <p className="text-xs text-muted-foreground mb-0.5 line-clamp-1">{book.author || "저자 미상"}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">{book.publisher}{book.publishDate && ` · ${book.publishDate.slice(0, 4)}`}</p>
          {cat && (
            <div className="mt-2">
              <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{cat.label}</span>
            </div>
          )}
        </div>
      </div>
      <div className="px-5 pb-4 flex justify-end">
        <button aria-label="저장" onClick={e => { e.stopPropagation(); onSave(); }} className={`p-1.5 rounded-lg transition-colors ${saved ? "text-primary bg-secondary" : "text-muted-foreground hover:text-primary hover:bg-secondary"}`}>
          <Bookmark size={14} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
    </div>
  );
}

/** 데이터 출처 표시: 실시간(초록 점) / 샘플(주황) */
function SourceBadge({ source, live, note }: { source?: Source; live: string; note?: string }) {
  if (!source) return <span className="text-sm text-muted-foreground">불러오는 중…</span>;
  if (source === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{live}
      </span>
    );
  }
  return (
    <span title={note} className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
      <AlertTriangle size={11} />샘플 데이터
    </span>
  );
}

function SampleNotice({ note }: { note?: string }) {
  if (!note) return null;
  return (
    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm mb-6">
      <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
      <span>{note} <span className="text-amber-700/80">README의 API 키 설정을 참고하세요.</span></span>
    </div>
  );
}

function VideoGridSkeleton({ count = 8, cols = "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" }: { count?: number; cols?: string }) {
  return (
    <div className={`grid grid-cols-1 ${cols} gap-4`}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-card rounded-2xl border border-border overflow-hidden">
          <Skeleton className="aspect-video rounded-none" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3 mt-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function BookGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-card rounded-2xl border border-border p-5 flex gap-4">
          <Skeleton className="w-16 h-24 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MoreButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <div className="mt-8 flex justify-center">
      <button onClick={onClick} disabled={loading} className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-secondary transition-colors disabled:opacity-60">
        {loading ? <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> : <ChevronDown size={15} />}
        더 보기
      </button>
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose, message]);
  const bg = type === "success" ? "bg-emerald-500" : type === "error" ? "bg-red-500" : "bg-primary";
  return (
    <div className={`fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 ${bg} text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-medium max-w-[calc(100vw-32px)]`} style={{ bottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
      {type === "success" && <CheckCircle size={16} className="flex-shrink-0" />}
      {type === "error" && <AlertCircle size={16} className="flex-shrink-0" />}
      {type === "info" && <AlertCircle size={16} className="flex-shrink-0" />}
      {message}
      <button aria-label="닫기" onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mb-4">
        <Icon size={28} className="text-primary opacity-60" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs">{desc}</p>
    </div>
  );
}

function ErrorState({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
        <AlertCircle size={28} className="text-red-400" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-2">불러오기 실패</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">{message || "데이터를 불러오는 중 오류가 발생했습니다."}</p>
      <button onClick={onRetry} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors">
        <RefreshCw size={14} />다시 시도
      </button>
    </div>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────

function LoginPage({ onLogin, onShowToast }: {
  onLogin: (user: AuthUser) => void;
  onShowToast: (msg: string, type: ToastType) => void;
}) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [suName, setSuName] = useState("");
  const [suDisplay, setSuDisplay] = useState("");
  const [suPw, setSuPw] = useState("");
  const [suPw2, setSuPw2] = useState("");

  const handleLogin = () => {
    setError("");
    if (!username.trim() || !password) { setError("아이디와 비밀번호를 입력해 주세요."); return; }
    setLoading(true);
    setTimeout(() => {
      const match = ACCOUNTS.find(a => a.username === username && a.password === password);
      setLoading(false);
      if (match) {
        onShowToast(`${match.user.displayName}님, 환영합니다!`, "success");
        onLogin(match.user);
      } else {
        setError("아이디 또는 비밀번호가 올바르지 않습니다.");
      }
    }, 600);
  };

  const handleSignup = () => {
    setError("");
    if (!suName.trim() || !suDisplay.trim() || !suPw) { setError("모든 항목을 입력해 주세요."); return; }
    if (suPw !== suPw2) { setError("비밀번호가 일치하지 않습니다."); return; }
    if (ACCOUNTS.find(a => a.username === suName)) { setError("이미 사용 중인 아이디입니다."); return; }
    setLoading(true);
    setTimeout(() => {
      const newUser: AuthUser = { id: `u_${Date.now()}`, username: suName, displayName: suDisplay, isAdmin: false };
      ACCOUNTS.push({ username: suName, password: suPw, user: newUser });
      setLoading(false);
      onShowToast("회원가입이 완료되었습니다!", "success");
      onLogin(newUser);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-8 relative overflow-hidden" style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-300/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
            <Layers size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">DDS</h1>
          <p className="text-sm text-muted-foreground mt-1">창조과학 지식 커뮤니티</p>
        </div>

        <div className="bg-card border border-border rounded-3xl shadow-xl shadow-black/5 overflow-hidden">
          <div className="flex border-b border-border">
            <button
              onClick={() => { setTab("login"); setError(""); }}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${tab === "login" ? "text-primary border-b-2 border-primary bg-secondary/30" : "text-muted-foreground hover:text-foreground"}`}
            >
              로그인
            </button>
            <button
              onClick={() => { setTab("signup"); setError(""); }}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${tab === "signup" ? "text-primary border-b-2 border-primary bg-secondary/30" : "text-muted-foreground hover:text-foreground"}`}
            >
              회원가입
            </button>
          </div>

          <div className="p-6 space-y-4">
            {tab === "login" ? (
              <>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="login-id" className="text-xs font-semibold text-muted-foreground block mb-1.5">아이디</label>
                    <div className="flex items-center gap-3 bg-slate-50 border border-border rounded-xl px-4 h-11 focus-within:border-primary transition-colors">
                      <User size={14} className="text-muted-foreground flex-shrink-0" />
                      <input
                        id="login-id"
                        className="flex-1 min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-slate-400"
                        placeholder="아이디를 입력하세요"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleLogin()}
                        autoComplete="username"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="login-pw" className="text-xs font-semibold text-muted-foreground block mb-1.5">비밀번호</label>
                    <div className="flex items-center gap-3 bg-slate-50 border border-border rounded-xl px-4 h-11 focus-within:border-primary transition-colors">
                      <Lock size={14} className="text-muted-foreground flex-shrink-0" />
                      <input
                        id="login-pw"
                        type={showPw ? "text" : "password"}
                        className="flex-1 min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-slate-400"
                        placeholder="비밀번호를 입력하세요"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleLogin()}
                        autoComplete="current-password"
                      />
                      <button type="button" aria-label="비밀번호 표시" onClick={() => setShowPw(!showPw)} className="text-muted-foreground hover:text-foreground transition-colors">
                        {showPw ? <EyeOff size={14} /> : <EyeIcon size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-xs">
                    <AlertCircle size={13} className="flex-shrink-0" />{error}
                  </div>
                )}

                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full h-11 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-blue-600 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm shadow-primary/20"
                >
                  {loading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <><LogIn size={15} />로그인</>}
                </button>

                <div className="bg-slate-50 border border-border rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium">테스트 계정</p>
                  <div className="space-y-1">
                    <button type="button" onClick={() => { setUsername("admin"); setPassword("admin1234"); }} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                      <ShieldCheck size={11} className="text-primary" />
                      <span>관리자: <span className="font-mono text-foreground">admin</span> / <span className="font-mono text-foreground">admin1234</span></span>
                    </button>
                    <button type="button" onClick={() => { setUsername("user1"); setPassword("user1234"); }} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                      <User size={11} className="text-slate-400" />
                      <span>일반: <span className="font-mono text-foreground">user1</span> / <span className="font-mono text-foreground">user1234</span></span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  {[
                    { id: "su-id", label: "아이디", val: suName, set: setSuName, placeholder: "영문·숫자 조합", type: "text" },
                    { id: "su-name", label: "닉네임", val: suDisplay, set: setSuDisplay, placeholder: "표시될 이름", type: "text" },
                    { id: "su-pw", label: "비밀번호", val: suPw, set: setSuPw, placeholder: "8자 이상 권장", type: "password" },
                    { id: "su-pw2", label: "비밀번호 확인", val: suPw2, set: setSuPw2, placeholder: "비밀번호를 다시 입력", type: "password" },
                  ].map(({ id, label, val, set, placeholder, type }) => (
                    <div key={id}>
                      <label htmlFor={id} className="text-xs font-semibold text-muted-foreground block mb-1.5">{label}</label>
                      <input
                        id={id}
                        type={type}
                        className="w-full bg-slate-50 border border-border rounded-xl px-4 h-11 text-sm text-foreground outline-none focus:border-primary transition-colors placeholder:text-slate-400"
                        placeholder={placeholder}
                        value={val}
                        onChange={e => set(e.target.value)}
                      />
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-xs">
                    <AlertCircle size={13} className="flex-shrink-0" />{error}
                  </div>
                )}

                <button
                  onClick={handleSignup}
                  disabled={loading}
                  className="w-full h-11 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-blue-600 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <><UserPlus size={15} />가입하기</>}
                </button>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          로그인하면 DDS <span className="text-primary underline cursor-pointer">이용약관</span> 및 <span className="text-primary underline cursor-pointer">개인정보처리방침</span>에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({ currentPage, onNav, notifCount, user, onLogout, savedCount }: { currentPage: Page; onNav: (p: Page) => void; notifCount: number; user: AuthUser; onLogout: () => void; savedCount: number }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navItems = [
    { page: "home" as Page, label: "홈", icon: Home },
    { page: "videos" as Page, label: "영상", icon: PlayCircle },
    { page: "books" as Page, label: "도서", icon: BookOpen },
    { page: "community" as Page, label: "커뮤니티", icon: MessageSquare },
  ];

  const isActive = (page: Page) => {
    if (currentPage === page) return true;
    if (page === "videos") return currentPage === "video-detail";
    if (page === "books") return currentPage === "book-detail" || currentPage === "book-register";
    return false;
  };

  return (
    <header className="fixed left-0 right-0 z-40 backdrop-blur-xl bg-white/80 border-b border-border" style={{ top: 0, paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="max-w-7xl mx-auto h-14 flex items-center justify-between gap-4" style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}>
        <button onClick={() => onNav("home")} className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Layers size={16} className="text-white" />
          </div>
          <span className="font-bold text-foreground text-base tracking-tight hidden sm:block">DDS</span>
        </button>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(({ page, label }) => (
            <button key={page} onClick={() => onNav(page)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive(page) ? "bg-secondary text-primary" : "text-muted-foreground hover:text-foreground hover:bg-slate-100"}`}>
              {label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <button aria-label="검색" onClick={() => onNav("search")} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors">
            <Search size={18} />
          </button>
          <button aria-label="알림" className="relative p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors">
            <Bell size={18} />
            {notifCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />}
          </button>
          <button aria-label="저장한 콘텐츠" className="relative p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors hidden sm:block">
            <Bookmark size={18} />
            {savedCount > 0 && <span className="absolute top-1 right-0.5 min-w-4 h-4 px-1 bg-primary text-white text-[10px] leading-4 rounded-full font-semibold">{savedCount}</span>}
          </button>
          {user.isAdmin && (
            <button aria-label="관리자" onClick={() => onNav("admin")} className="hidden sm:flex p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors" title="관리자">
              <ShieldCheck size={18} />
            </button>
          )}

          <div className="relative ml-1" ref={profileRef}>
            <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 pl-1 pr-2 h-8 rounded-full bg-secondary hover:bg-blue-100 transition-colors">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                {user.isAdmin ? <ShieldCheck size={12} className="text-white" /> : <User size={12} className="text-white" />}
              </div>
              <span className="text-xs font-semibold text-foreground hidden sm:block max-w-[72px] truncate">{user.displayName}</span>
              <ChevronDown size={12} className={`text-muted-foreground transition-transform ${profileOpen ? "rotate-180" : ""}`} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-10 w-52 bg-card border border-border rounded-2xl shadow-xl shadow-black/10 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      {user.isAdmin ? <ShieldCheck size={16} className="text-primary" /> : <User size={16} className="text-primary" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                    </div>
                  </div>
                  {user.isAdmin && (
                    <div className="mt-2 inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-semibold">
                      <ShieldCheck size={10} />관리자
                    </div>
                  )}
                </div>
                <div className="p-1.5">
                  <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-foreground hover:bg-slate-50 transition-colors">
                    <User size={14} className="text-muted-foreground" />내 프로필
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-foreground hover:bg-slate-50 transition-colors">
                    <Bookmark size={14} className="text-muted-foreground" />저장한 콘텐츠
                  </button>
                  {user.isAdmin && (
                    <button onClick={() => { onNav("admin"); setProfileOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-foreground hover:bg-slate-50 transition-colors">
                      <ShieldCheck size={14} className="text-muted-foreground" />관리자 패널
                    </button>
                  )}
                  <div className="border-t border-border my-1" />
                  <button onClick={() => { setProfileOpen(false); onLogout(); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors">
                    <LogOut size={14} />로그아웃
                  </button>
                </div>
              </div>
            )}
          </div>

          <button aria-label="메뉴" onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors ml-1">
            <Menu size={18} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-border bg-white/95 py-3 flex flex-col gap-1" style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}>
          {navItems.map(({ page, label, icon: Icon }) => (
            <button key={page} onClick={() => { onNav(page); setMenuOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive(page) ? "bg-secondary text-primary" : "text-foreground hover:bg-slate-100"}`}>
              <Icon size={16} />{label}
            </button>
          ))}
          {user.isAdmin && (
            <button onClick={() => { onNav("admin"); setMenuOpen(false); }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-slate-100">
              <ShieldCheck size={16} className="text-primary" />관리자 패널
            </button>
          )}
          <div className="border-t border-border mt-1 pt-2">
            <button onClick={() => { setMenuOpen(false); onLogout(); }} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 w-full">
              <LogOut size={16} />로그아웃
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

// ─── Home Page ────────────────────────────────────────────────────────────────

function HomePage({ onNav, savedVideos, onSaveVideo, savedBooks, onSaveBook }: {
  onNav: (p: Page, data?: unknown) => void;
  savedVideos: string[]; onSaveVideo: (id: string) => void;
  savedBooks: string[]; onSaveBook: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [ask, setAsk] = useState("");
  const [selectedCat, setSelectedCat] = useState<CategoryId | null>(null);
  const videos = useVideos();
  const books = useBooks({ category: selectedCat ?? "all" });

  const allVideos = videos.value?.data.videos ?? [];
  const filteredVideos = (selectedCat ? allVideos.filter(v => v.categories.includes(selectedCat)) : allVideos).slice(0, 4);

  return (
    <div className="space-y-12 pb-16">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E40AF] via-[#2563EB] to-[#3B82F6] text-white p-6 sm:p-12 lg:p-16">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium mb-6">
            <Microscope size={14} />창조과학 지식 플랫폼
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4" style={{ textWrap: "balance" }}>
            창조과학을 발견하고,<br />배우고, 함께 나누세요
          </h1>
          <p className="text-blue-100 text-base sm:text-lg mb-8 leading-relaxed">
            우주·지구·생명의 기원을 성경적 관점에서 탐구하는<br className="hidden sm:block" />커뮤니티에 오신 것을 환영합니다.
          </p>
          <div className="flex gap-3">
            <div className="flex-1 min-w-0 flex items-center gap-3 bg-white rounded-2xl px-4 h-12 shadow-lg max-w-lg">
              <Search size={16} className="text-slate-400 flex-shrink-0" />
              <input
                id="hero-search"
                className="flex-1 min-w-0 bg-transparent text-foreground text-sm outline-none placeholder:text-slate-400"
                placeholder="영상, 도서, 게시글 통합 검색..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && query.trim() && onNav("search", query.trim())}
              />
            </div>
            <button onClick={() => query.trim() && onNav("search", query.trim())} className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 h-12 rounded-2xl text-sm font-semibold transition-colors flex-shrink-0">
              검색
            </button>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-foreground">주제별 탐색</h2>
          {selectedCat && <button onClick={() => setSelectedCat(null)} className="text-sm text-primary hover:underline">전체 보기</button>}
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 sm:gap-3">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const active = selectedCat === cat.id;
            return (
              <button key={cat.id} onClick={() => setSelectedCat(active ? null : cat.id)}
                className={`flex flex-col items-center gap-2 p-2 sm:p-3 rounded-2xl border transition-all duration-150 min-w-0 ${active ? "border-primary bg-secondary shadow-sm" : "border-border bg-card hover:border-primary/30 hover:bg-secondary/50"}`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${cat.color}18` }}>
                  <Icon size={18} style={{ color: cat.color }} />
                </div>
                <span className={`text-xs font-medium leading-tight text-center break-keep ${active ? "text-primary" : "text-foreground"}`}>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3 mb-5">
          <h2 className="text-xl font-bold text-foreground">최신 영상</h2>
          <button onClick={() => onNav("videos")} className="text-sm text-primary font-medium hover:underline flex items-center gap-1 flex-shrink-0">
            전체 보기 <ChevronRight size={14} />
          </button>
        </div>

        {videos.status === "loading" ? (
            <VideoGridSkeleton count={4} cols="sm:grid-cols-2 lg:grid-cols-4" />
          ) : videos.status === "error" ? (
            <ErrorState message={videos.error} onRetry={videos.reload} />
          ) : filteredVideos.length === 0 ? (
            <EmptyState icon={PlayCircle} title="이 주제의 최신 영상이 없습니다" desc="다른 주제를 선택하거나 영상 메뉴에서 전체 영상을 둘러보세요." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredVideos.map(v => (
                <VideoCard key={v.id} video={v} onClick={() => onNav("video-detail", v)} onSave={() => onSaveVideo(v.id)} saved={savedVideos.includes(v.id)} />
              ))}
            </div>
          )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-foreground">추천 도서</h2>
          <button onClick={() => onNav("books")} className="text-sm text-primary font-medium hover:underline flex items-center gap-1">전체 보기 <ChevronRight size={14} /></button>
        </div>
        {books.status === "loading" || books.status === "idle" ? (
          <BookGridSkeleton count={3} />
        ) : books.status === "error" ? (
          <ErrorState message={books.error} onRetry={books.reload} />
        ) : books.books.length === 0 ? (
          <EmptyState icon={BookOpen} title="이 주제의 도서가 없습니다" desc="다른 주제를 선택해 보세요." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.books.slice(0, 3).map(b => (
              <BookCard key={b.id} book={b} onClick={() => onNav("book-detail", b)} onSave={() => onSaveBook(b.id)} saved={savedBooks.includes(b.id)} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="lg:w-80 flex-shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-secondary px-2.5 py-1 rounded-full mb-3">
              <Sparkles size={12} />ChatDDS 커뮤니티
            </span>
            <h2 className="text-xl font-bold text-foreground mb-1" style={{ textWrap: "balance" }}>궁금한 건 바로 물어보세요</h2>
            <p className="text-sm text-muted-foreground">창조과학 자료를 찾아 출처와 함께 답해 드려요.</p>
          </div>
          <div className="flex-1 min-w-0">
            <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (ask.trim()) onNav("community", { draft: ask.trim(), autoSend: true } satisfies ChatRequest); }}>
              <div className="flex-1 min-w-0 flex items-center gap-3 bg-slate-50 border border-border rounded-2xl px-4 h-12 focus-within:border-primary transition-colors">
                <MessageSquare size={16} className="text-muted-foreground flex-shrink-0" />
                <input id="home-ask" className="flex-1 min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-slate-400"
                  placeholder="예: 노아의 홍수 증거는?" value={ask} onChange={e => setAsk(e.target.value)} />
              </div>
              <button type="submit" disabled={!ask.trim()} className="flex items-center gap-1.5 bg-primary text-white px-5 h-12 rounded-2xl text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-40 flex-shrink-0">
                <Send size={14} />질문
              </button>
            </form>
            <div className="flex flex-wrap gap-2 mt-3">
              {["캄브리아기 대폭발이란?", "젊은 지구론의 근거는?", "공룡은 언제 살았나요?"].map(q => (
                <button key={q} onClick={() => onNav("community", { draft: q, autoSend: true } satisfies ChatRequest)}
                  className="px-3 py-1.5 rounded-full border border-border bg-card text-xs text-foreground hover:border-primary/40 hover:text-primary transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Category Chips (shared) ──────────────────────────────────────────────────

function CategoryChips({ value, onChange, dim = false }: { value: string; onChange: (v: string) => void; dim?: boolean }) {
  return (
    <div className={`flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide transition-opacity ${dim ? "opacity-50" : ""}`}>
      <button onClick={() => onChange("all")} className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${value === "all" ? "bg-primary text-white" : "bg-card border border-border text-foreground hover:bg-secondary"}`}>
        전체
      </button>
      {CATEGORIES.map(cat => (
        <button key={cat.id} onClick={() => onChange(cat.id)} className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${value === cat.id ? "bg-primary text-white" : "bg-card border border-border text-foreground hover:bg-secondary"}`}>
          {cat.label}
        </button>
      ))}
    </div>
  );
}

function formatUpdated(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} 업데이트`;
}

// ─── Videos Page ──────────────────────────────────────────────────────────────

const VIDEO_PAGE = 12;

function VideosPage({ onNav, savedVideos, onSaveVideo }: { onNav: (p: Page, d?: unknown) => void; savedVideos: string[]; onSaveVideo: (id: string) => void }) {
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [channel, setChannel] = useState("all");
  const [visible, setVisible] = useState(VIDEO_PAGE);
  const state = useVideos();
  const data = state.value?.data;
  const live = state.value?.source === "live";

  useEffect(() => setVisible(VIDEO_PAGE), [selectedCat, channel]);

  const filtered = (data?.videos ?? []).filter(v =>
    (selectedCat === "all" || v.categories.includes(selectedCat as CategoryId)) &&
    (channel === "all" || v.channelId === channel)
  );

  return (
    <div className="pb-16">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-foreground">영상</h1>
        <SourceBadge source={state.value?.source} note={state.value?.note} live={data ? `${data.channels.length}개 채널 · ${formatUpdated(data.fetchedAt)}` : ""} />
      </div>

      <SampleNotice note={state.value?.note} />

      <CategoryChips value={selectedCat} onChange={setSelectedCat} />

      {live && data && (
        <div className="flex items-center gap-2 mb-6">
          <label htmlFor="channel-filter" className="text-sm text-muted-foreground flex-shrink-0">채널</label>
          <div className="relative min-w-0">
            <select id="channel-filter" value={channel} onChange={e => setChannel(e.target.value)}
              className="appearance-none h-10 max-w-full rounded-xl border border-border bg-card pl-4 pr-9 text-sm font-medium text-foreground outline-none focus:border-primary cursor-pointer">
              <option value="all">모든 채널</option>
              {data.channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          <span className="text-sm text-muted-foreground ml-1 tabular-nums">{filtered.length}개</span>
        </div>
      )}

      {state.status === "loading" ? (
        <VideoGridSkeleton />
      ) : state.status === "error" ? (
        <ErrorState message={state.error} onRetry={state.reload} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={PlayCircle} title="조건에 맞는 영상이 없습니다" desc="최근 업로드 중 이 주제에 해당하는 영상이 없어요. 다른 주제나 채널을 선택해 보세요." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.slice(0, visible).map(v => (
              <VideoCard key={v.id} video={v} onClick={() => onNav("video-detail", v)} onSave={() => onSaveVideo(v.id)} saved={savedVideos.includes(v.id)} />
            ))}
          </div>
          {visible < filtered.length && <MoreButton onClick={() => setVisible(n => n + VIDEO_PAGE)} loading={false} />}
        </>
      )}
    </div>
  );
}

// ─── Video Detail Page ────────────────────────────────────────────────────────

function VideoDetailPage({ video, onBack, onNav, savedVideos, onSaveVideo }: {
  video: Video; onBack: () => void; onNav: (p: Page, d?: unknown) => void;
  savedVideos: string[]; onSaveVideo: (id: string) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const state = useVideos();
  const isSample = video.id.startsWith("sample-");
  const all = state.value?.data.videos ?? [];
  const related = all
    .filter(v => v.id !== video.id)
    .map(v => ({ v, score: (v.channelId && v.channelId === video.channelId ? 1 : 0) + v.categories.filter(c => video.categories.includes(c)).length * 2 }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || b.v.date.localeCompare(a.v.date))
    .slice(0, 5)
    .map(x => x.v);
  const longDesc = video.description.length > 220;

  return (
    <div className="pb-16">
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm transition-colors">
        <ArrowLeft size={16} />목록으로
      </button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-lg max-w-full">
            {playing && !isSample ? (
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            ) : (
              <>
                <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                <button aria-label="재생" onClick={() => setPlaying(true)} disabled={isSample} className="absolute inset-0 flex items-center justify-center group">
                  <span className="w-16 h-16 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:bg-black/80 transition-colors">
                    <PlayCircle size={32} className="text-white" />
                  </span>
                </button>
                <div className="absolute bottom-3 left-3 text-xs bg-black/60 text-white px-2 py-1 rounded-lg flex items-center gap-1.5 pointer-events-none">
                  <Globe size={10} />{isSample ? "샘플 영상" : "YouTube 공식 플레이어"}
                </div>
              </>
            )}
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-3 leading-snug">{video.title}</h1>
            <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-border">
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{video.channel}</span>
                <span className="flex items-center gap-1"><Eye size={13} />{formatNum(video.views)}</span>
                <span className="flex items-center gap-1"><Calendar size={13} />{formatDate(video.date)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => onSaveVideo(video.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${savedVideos.includes(video.id) ? "bg-secondary text-primary border-primary/30" : "bg-card text-foreground border-border hover:bg-secondary"}`}>
                  <Bookmark size={14} fill={savedVideos.includes(video.id) ? "currentColor" : "none"} />저장
                </button>
                <button onClick={() => onNav("community", { draft: `「${video.title}」 영상에서 다루는 내용을 더 자세히 설명해 줘.` } satisfies ChatRequest)} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors">
                  <Sparkles size={14} />ChatDDS에게 묻기
                </button>
                {!isSample && (
                  <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors">
                    <ExternalLink size={14} />YouTube
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-5 border border-border">
            <h3 className="font-semibold text-foreground mb-3">영상 설명</h3>
            {video.description ? (
              <>
                <p className={`text-sm text-muted-foreground leading-relaxed whitespace-pre-line break-words ${!expanded && longDesc ? "line-clamp-4" : ""}`}>{video.description}</p>
                {longDesc && (
                  <button onClick={() => setExpanded(!expanded)} className="mt-2 text-sm font-medium text-primary hover:underline">{expanded ? "접기" : "더보기"}</button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">설명이 없는 영상입니다.</p>
            )}
            {video.categories.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {video.categories.map(c => (
                  <span key={c} className="inline-flex items-center gap-1 text-xs bg-secondary text-primary px-2.5 py-1 rounded-full font-medium">
                    {CATEGORIES.find(x => x.id === c)?.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 min-w-0">
          <h3 className="font-bold text-foreground">관련 영상</h3>
          {related.length === 0 ? (
            <p className="text-sm text-muted-foreground">관련 영상이 없습니다.</p>
          ) : related.map(v => (
            <div key={v.id} className="flex gap-3 cursor-pointer group" onClick={() => onNav("video-detail", v)}>
              <div className="relative flex-shrink-0 w-32 aspect-video bg-slate-100 rounded-xl overflow-hidden">
                <img src={v.thumbnail} alt={v.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded font-mono">{v.duration}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground line-clamp-2 mb-1 leading-snug group-hover:text-primary transition-colors">{v.title}</p>
                <p className="text-xs text-muted-foreground truncate">{v.channel}</p>
                <p className="text-xs text-muted-foreground">{formatDate(v.date)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Books Page ───────────────────────────────────────────────────────────────

function BooksPage({ onNav, savedBooks, onSaveBook, onShowToast }: {
  onNav: (p: Page, d?: unknown) => void;
  savedBooks: string[]; onSaveBook: (id: string) => void;
  onShowToast: (msg: string, type: ToastType) => void;
}) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [selectedCat, setSelectedCat] = useState("all");
  const state = useBooks(submitted ? { q: submitted } : { category: selectedCat as CategoryId | "all" });

  const submit = () => setSubmitted(query.trim());
  const notFound = !!submitted && state.status === "ready" && state.books.length === 0;

  return (
    <div className="pb-16">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-foreground">도서</h1>
        <SourceBadge source={state.source} note={state.note} live={`국립중앙도서관 · ${state.total.toLocaleString()}권`} />
      </div>

      <SampleNotice note={state.note} />

      <div className="flex gap-3 mb-6">
        <div className="flex-1 min-w-0 flex items-center gap-3 bg-card border border-border rounded-xl px-4 h-11 focus-within:border-primary transition-colors">
          <Search size={15} className="text-muted-foreground flex-shrink-0" />
          <input id="book-search" className="flex-1 min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="도서명으로 검색 (국립중앙도서관)" value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submit(); }} />
          {query && <button aria-label="지우기" onClick={() => { setQuery(""); setSubmitted(""); }}><X size={14} className="text-muted-foreground" /></button>}
        </div>
        <button onClick={submit} className="bg-primary text-white px-5 h-11 rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors flex-shrink-0">검색</button>
      </div>

      <CategoryChips value={submitted ? "" : selectedCat} dim={!!submitted} onChange={v => { setSelectedCat(v); setSubmitted(""); setQuery(""); }} />

      {submitted && state.status === "ready" && !notFound && (
        <p className="text-sm text-muted-foreground mb-4">‘<span className="text-foreground font-medium">{submitted}</span>’ 검색 결과 <span className="tabular-nums">{state.total.toLocaleString()}</span>권</p>
      )}

      {state.status === "loading" || state.status === "idle" ? (
        <BookGridSkeleton />
      ) : state.status === "error" ? (
        <ErrorState message={state.error} onRetry={state.reload} />
      ) : notFound ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
            <BookOpen size={28} className="text-amber-400" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-2">‘{submitted}’ 도서를 찾지 못했어요</h3>
          <p className="text-sm text-muted-foreground mb-6">국립중앙도서관에도 없는 도서라면 정보를 직접 입력해 DDS에 등록 신청할 수 있습니다.</p>
          <button onClick={() => onNav("book-register")} className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors">
            <Plus size={15} />DDS에 도서 등록 신청
          </button>
        </div>
      ) : state.books.length === 0 ? (
        <EmptyState icon={BookOpen} title="이 주제의 도서가 없습니다" desc="다른 주제를 선택하거나 도서명으로 검색해 보세요." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.books.map(b => (
              <BookCard key={b.id} book={b} onClick={() => onNav("book-detail", b)} onSave={() => { onSaveBook(b.id); onShowToast(savedBooks.includes(b.id) ? "저장 취소됨" : "저장되었습니다", "success"); }} saved={savedBooks.includes(b.id)} />
            ))}
          </div>
          {state.hasMore && <MoreButton onClick={state.loadMore} loading={state.loadingMore} />}
        </>
      )}
    </div>
  );
}

// ─── Book Detail Page ─────────────────────────────────────────────────────────

function BookDetailPage({ book, onBack, onNav, savedBooks, onSaveBook }: {
  book: Book; onBack: () => void; onNav: (p: Page, d?: unknown) => void; savedBooks: string[]; onSaveBook: (id: string) => void;
}) {
  const cat = CATEGORIES.find(c => c.id === book.category);
  const facts = [
    ["출판일", book.publishDate],
    ["ISBN", book.isbn],
    ["쪽수", book.pages && (/\d$/.test(book.pages) ? `${book.pages}쪽` : book.pages)],
    ["한국십진분류", book.kdc],
    ["주제", cat?.label],
    ["정가", book.price && (/^\d+$/.test(book.price) ? `${Number(book.price).toLocaleString()}원` : book.price)],
  ].filter((x): x is [string, string] => !!x[1]);
  const isSample = !/^\d{10,13}$/.test(book.isbn) || book.cover.includes("unsplash");

  return (
    <div className="pb-16">
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm transition-colors">
        <ArrowLeft size={16} />목록으로
      </button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="flex flex-col items-center lg:items-start">
          <div className="w-48 h-64 bg-slate-100 rounded-2xl overflow-hidden shadow-xl mb-4 [&_span]:text-sm [&_span]:p-2">
            <BookCover book={book} />
          </div>
          <div className="flex flex-wrap gap-2 w-full justify-center lg:justify-start">
            <button onClick={() => onSaveBook(book.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${savedBooks.includes(book.id) ? "bg-secondary text-primary border-primary/30" : "bg-card text-foreground border-border hover:bg-secondary"}`}>
              <Bookmark size={14} fill={savedBooks.includes(book.id) ? "currentColor" : "none"} />저장
            </button>
            <button onClick={() => onNav("community", { draft: `『${book.title}』${book.author ? `(${book.author})` : ""}의 주요 주장을 정리해 줘.` } satisfies ChatRequest)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-border bg-card text-foreground hover:bg-secondary transition-colors">
              <Sparkles size={14} />ChatDDS에게 묻기
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6 min-w-0">
          <div>
            {cat && <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium mb-3" style={{ color: cat.color, background: `${cat.color}18` }}>{cat.label}</span>}
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2" style={{ textWrap: "balance" }}>{book.title}</h1>
            <p className="text-base text-muted-foreground">{[book.author, book.publisher].filter(Boolean).join(" · ")}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {facts.map(([k, v]) => (
              <div key={k} className="bg-card border border-border rounded-xl p-3 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">{k}</p>
                <p className="text-sm font-medium text-foreground tabular-nums break-all">{v}</p>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-3">도서 소개</h3>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{book.description || "국립중앙도서관에 등록된 책 소개가 없는 도서입니다."}</p>
            {book.subject && <p className="text-xs text-muted-foreground mt-3">주제어: {book.subject}</p>}
          </div>

          {!isSample && (
            <a href={`https://www.nl.go.kr/NL/contents/search.do?srchTarget=total&kwd=${book.isbn}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              <ExternalLink size={14} />국립중앙도서관에서 소장 정보 보기
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Book Register Page ───────────────────────────────────────────────────────

function BookRegisterPage({ onBack, onShowToast }: { onBack: () => void; onShowToast: (m: string, t: ToastType) => void }) {
  const [step, setStep] = useState(1); // 1=search, 2=select, 3=done, 4=manual
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [selected, setSelected] = useState<Book | null>(null);
  const [reason, setReason] = useState("");
  const search = useBooks({ q: submitted }, !!submitted);

  const apiResults = search.books.slice(0, 6);
  const noApiResults = !!submitted && search.status === "ready" && apiResults.length === 0;

  const steps = ["도서 검색", "도서 선택", "정보 확인", "신청 완료"];
  const visualStep = step === 4 ? 2 : step === 3 ? 4 : step;

  return (
    <div className="pb-16 max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm transition-colors">
        <ArrowLeft size={16} />도서 목록으로
      </button>

      <h1 className="text-2xl font-bold text-foreground mb-2">도서 등록 신청</h1>
      <p className="text-sm text-muted-foreground mb-8">DDS에 없는 창조과학 도서를 등록 신청할 수 있습니다.</p>

      <div className="flex items-center gap-0 mb-10">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${i + 1 < visualStep || (visualStep === 4 && i === 3) ? "bg-emerald-500 text-white" : i + 1 === visualStep ? "bg-primary text-white" : "bg-slate-200 text-slate-400"}`}>
                {i + 1 < visualStep || (visualStep === 4 && i === 3) ? <Check size={14} /> : i + 1}
              </div>
              <span className={`text-xs mt-1 font-medium whitespace-nowrap ${i + 1 === visualStep ? "text-primary" : "text-muted-foreground"}`}>{s}</span>
            </div>
            {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-2 mb-4 ${i + 1 < visualStep ? "bg-emerald-500" : "bg-slate-200"}`} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
            <h3 className="font-semibold text-foreground mb-4">국립중앙도서관에서 검색</h3>
            <div className="flex gap-3 mb-6">
              <div className="flex-1 min-w-0 flex items-center gap-3 bg-slate-50 border border-border rounded-xl px-4 h-11 focus-within:border-primary transition-colors">
                <Search size={15} className="text-muted-foreground flex-shrink-0" />
                <input id="register-search" className="flex-1 min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  placeholder="도서명 입력..." value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") setSubmitted(query.trim()); }} />
              </div>
              <button onClick={() => setSubmitted(query.trim())} className="bg-primary text-white px-5 h-11 rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors flex-shrink-0">검색</button>
            </div>

            {search.status === "loading" && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />검색 중…
              </div>
            )}

            {search.status === "error" && <ErrorState message={search.error} onRetry={search.reload} />}

            {search.status === "ready" && apiResults.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground"><span className="tabular-nums">{search.total.toLocaleString()}</span>권 중 상위 {apiResults.length}권{search.source === "sample" && " (샘플)"}</p>
                {apiResults.map(b => (
                  <div key={b.id} className="flex items-center gap-4 p-4 border border-border rounded-xl hover:border-primary/30 hover:bg-secondary/30 cursor-pointer transition-colors" onClick={() => { setSelected(b); setStep(2); }}>
                    <div className="w-10 h-14 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                      <BookCover book={b} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground line-clamp-1">{b.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{[b.author, b.publisher].filter(Boolean).join(" · ")}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{b.isbn}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                  </div>
                ))}
                <button onClick={() => setStep(4)} className="text-sm text-primary font-medium hover:underline">찾는 도서가 없나요? 직접 입력하기</button>
              </div>
            )}

            {noApiResults && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">국립중앙도서관에서도 도서를 찾을 수 없습니다.</p>
                <button onClick={() => setStep(4)} className="text-sm text-primary font-medium hover:underline">직접 정보 입력하기</button>
              </div>
            )}

            {!submitted && (
              <p className="text-xs text-muted-foreground">예: "다윈의 블랙박스", "창세기", "노아 홍수"</p>
            )}
          </div>
        </div>
      )}

      {step === 2 && selected && (
        <div className="space-y-6">
          <div className="bg-card border border-primary/30 rounded-2xl p-5 sm:p-6">
            <div className="flex gap-4 mb-6">
              <div className="w-16 h-24 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
                <BookCover book={selected} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-foreground mb-1">{selected.title}</h3>
                <p className="text-sm text-muted-foreground">{[selected.author, selected.publisher].filter(Boolean).join(" · ")}</p>
                <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">ISBN: {selected.isbn}</p>
              </div>
            </div>
            <div>
              <label htmlFor="register-reason" className="text-sm font-medium text-foreground mb-2 block">신청 사유 <span className="text-red-500">*</span></label>
              <textarea id="register-reason" className="w-full bg-slate-50 border border-border rounded-xl p-3 text-sm text-foreground outline-none focus:border-primary resize-none"
                rows={4} placeholder="이 도서가 DDS에 필요한 이유를 간략히 설명해 주세요..."
                value={reason} onChange={e => setReason(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-slate-50 transition-colors">이전</button>
            <button onClick={() => { if (reason.trim()) { setStep(3); onShowToast("도서 등록 신청이 완료되었습니다", "success"); } }} disabled={!reason.trim()} className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-40">신청하기</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">신청이 완료되었습니다</h3>
            <p className="text-sm text-muted-foreground mb-1">도서 등록 신청이 접수되었습니다.</p>
            <p className="text-sm text-muted-foreground">관리자 검토 후 승인 시 알림을 드립니다.</p>
          </div>
          {selected && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h4 className="text-sm font-semibold text-foreground mb-3">신청 도서</h4>
              <div className="flex gap-3">
                <div className="w-10 h-14 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                  <BookCover book={selected} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{selected.title}</p>
                  <p className="text-xs text-muted-foreground">{[selected.author, selected.publisher].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
            </div>
          )}
          <button onClick={onBack} className="w-full py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-blue-600 transition-colors">도서 목록으로 돌아가기</button>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
            <h3 className="font-semibold text-foreground mb-4">도서 정보 직접 입력</h3>
            <div className="space-y-4">
              {[["m-title", "도서명", "text", "도서명을 입력하세요"], ["m-author", "저자", "text", "저자를 입력하세요"], ["m-pub", "출판사", "text", "출판사를 입력하세요"], ["m-isbn", "ISBN", "text", "ISBN을 입력하세요"], ["m-url", "참고 URL", "url", "관련 URL을 입력하세요 (선택)"]].map(([id, label, type, placeholder]) => (
                <div key={id}>
                  <label htmlFor={id} className="text-xs font-medium text-muted-foreground block mb-1.5">{label} {label !== "참고 URL" && <span className="text-red-500">*</span>}</label>
                  <input id={id} type={type} placeholder={placeholder} className="w-full bg-slate-50 border border-border rounded-xl px-4 h-10 text-sm text-foreground outline-none focus:border-primary transition-colors" />
                </div>
              ))}
              <div>
                <label htmlFor="m-desc" className="text-xs font-medium text-muted-foreground block mb-1.5">도서 소개 <span className="text-red-500">*</span></label>
                <textarea id="m-desc" rows={3} className="w-full bg-slate-50 border border-border rounded-xl p-3 text-sm text-foreground outline-none focus:border-primary resize-none transition-colors" placeholder="도서 내용을 간략히 소개해 주세요..." />
              </div>
              <div>
                <label htmlFor="m-reason" className="text-xs font-medium text-muted-foreground block mb-1.5">신청 사유 <span className="text-red-500">*</span></label>
                <textarea id="m-reason" rows={3} className="w-full bg-slate-50 border border-border rounded-xl p-3 text-sm text-foreground outline-none focus:border-primary resize-none transition-colors" placeholder="이 도서가 DDS에 필요한 이유를 알려주세요..." />
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-slate-50 transition-colors">이전</button>
            <button onClick={() => { setSelected(null); setStep(3); onShowToast("도서 등록 신청이 완료되었습니다", "success"); }} className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-blue-600 transition-colors">신청하기</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Search Page ──────────────────────────────────────────────────────────────

function SearchPage({ initialQuery, onNav, savedVideos, onSaveVideo, savedBooks, onSaveBook }: {
  initialQuery: string;
  onNav: (p: Page, d?: unknown) => void;
  savedVideos: string[]; onSaveVideo: (id: string) => void;
  savedBooks: string[]; onSaveBook: (id: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [submitted, setSubmitted] = useState(initialQuery);
  const [tab, setTab] = useState<"all" | "videos" | "books">("all");
  const searched = submitted.trim().length > 0;
  const q = submitted.trim();

  const videoState = useVideos();
  const bookState = useBooks({ q }, searched);
  const ql = q.toLowerCase();
  const videos = searched ? (videoState.value?.data.videos ?? []).filter(v => v.title.toLowerCase().includes(ql) || v.channel.toLowerCase().includes(ql) || v.description.toLowerCase().includes(ql)) : [];
  const books = bookState.books;
  const booksLoading = searched && (bookState.status === "loading" || bookState.status === "idle");

  return (
    <div className="pb-16">
      <h1 className="text-2xl font-bold text-foreground mb-6">통합검색</h1>
      <div className="flex gap-3 mb-6">
        <div className="flex-1 min-w-0 flex items-center gap-3 bg-card border border-border rounded-xl px-4 h-12">
          <Search size={16} className="text-muted-foreground flex-shrink-0" />
          <input id="global-search" autoFocus className="flex-1 min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="검색어를 입력하세요..." value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") setSubmitted(query); }} />
          {query && <button aria-label="지우기" onClick={() => { setQuery(""); setSubmitted(""); }}><X size={14} className="text-muted-foreground" /></button>}
        </div>
        <button onClick={() => setSubmitted(query)} className="bg-primary text-white px-6 h-12 rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors flex-shrink-0">검색</button>
      </div>

      {!searched && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground mr-1">추천 검색어</span>
          {["DNA", "화석", "노아 홍수", "빅뱅", "어린이"].map(k => (
            <button key={k} onClick={() => { setQuery(k); setSubmitted(k); }} className="px-3 py-1.5 rounded-full bg-card border border-border text-sm text-foreground hover:bg-secondary hover:text-primary transition-colors">#{k}</button>
          ))}
        </div>
      )}

      {searched && (
        <>
          <div className="overflow-x-auto scrollbar-hide mb-6">
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
              {(["all", "videos", "books"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === t ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}>
                  {t === "all" ? `전체 (${videos.length + bookState.total})` : t === "videos" ? `영상 (${videos.length})` : `도서 (${bookState.total})`}
                </button>
              ))}
            </div>
          </div>

          {booksLoading && videos.length === 0 ? (
            <BookGridSkeleton count={3} />
          ) : videos.length + books.length === 0 ? (
            <EmptyState icon={Search} title={`"${q}"에 대한 결과가 없습니다`} desc="다른 검색어를 사용해 보거나 주제별로 탐색해 보세요." />
          ) : (
            <div className="space-y-10">
              {(tab === "all" || tab === "videos") && videos.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-foreground mb-4">영상 {videos.length}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {videos.map(v => <VideoCard key={v.id} video={v} onClick={() => onNav("video-detail", v)} onSave={() => onSaveVideo(v.id)} saved={savedVideos.includes(v.id)} />)}
                  </div>
                </div>
              )}
              {(tab === "all" || tab === "books") && books.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-foreground mb-4">도서 <span className="tabular-nums">{bookState.total.toLocaleString()}</span></h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {books.map(b => <BookCard key={b.id} book={b} onClick={() => onNav("book-detail", b)} onSave={() => onSaveBook(b.id)} saved={savedBooks.includes(b.id)} />)}
                  </div>
                  {bookState.hasMore && <MoreButton onClick={bookState.loadMore} loading={bookState.loadingMore} />}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Admin Page ───────────────────────────────────────────────────────────────

function AdminPage() {
  const [books, setBooks] = useState(MOCK_ADMIN_BOOKS);
  const [selected, setSelected] = useState<AdminBook | null>(MOCK_ADMIN_BOOKS[0]);
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  const updateStatus = (id: string, status: Book["status"]) => {
    setBooks(bs => bs.map(b => b.id === id ? { ...b, status } : b));
    setSelected(s => s && s.id === id ? { ...s, status } : s);
    const labels: Record<string, string> = { approved: "승인", rejected: "반려", reviewing: "검토 중", supplement: "보완 요청" };
    setToast({ msg: `${labels[status!]} 처리되었습니다`, type: status === "approved" ? "success" : status === "rejected" ? "error" : "info" });
  };

  const counts = {
    total: books.length,
    pending: books.filter(b => b.status === "pending" || b.status === "reviewing" || b.status === "supplement").length,
    approved: books.filter(b => b.status === "approved").length,
    rejected: books.filter(b => b.status === "rejected").length,
  };

  const done = selected?.status === "approved" || selected?.status === "rejected";

  return (
    <div className="pb-16">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={closeToast} />}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
          <ShieldCheck size={18} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">관리자 패널</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[["전체 신청", counts.total, "text-foreground"], ["처리 대기", counts.pending, "text-amber-600"], ["승인", counts.approved, "text-emerald-600"], ["반려", counts.rejected, "text-red-500"]].map(([label, n, color]) => (
          <div key={label as string} className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-2xl font-bold tabular-nums ${color}`}>{n}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-foreground mb-4">도서 등록 신청 목록</h2>
          <div className="space-y-3">
            {books.map(b => (
              <div key={b.id} className={`bg-card border rounded-2xl p-4 cursor-pointer transition-all ${selected?.id === b.id ? "border-primary shadow-sm" : "border-border hover:border-primary/30"}`} onClick={() => setSelected(b)}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-14 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={b.cover} alt={b.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground line-clamp-1">{b.title}</p>
                      <StatusBadge status={b.status || "pending"} />
                    </div>
                    <p className="text-xs text-muted-foreground">{b.author} · {b.publisher}</p>
                    <p className="text-xs text-muted-foreground mt-1">신청자: {b.applicant} · {formatDate(b.appliedDate)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0">
          {selected ? (
            <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm lg:sticky lg:top-20">
              <div className="flex items-start gap-4 mb-5 pb-5 border-b border-border">
                <div className="w-16 h-24 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
                  <img src={selected.cover} alt={selected.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-foreground">{selected.title}</h3>
                    <StatusBadge status={selected.status || "pending"} />
                  </div>
                  <p className="text-sm text-muted-foreground">{selected.author} · {selected.publisher}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">ISBN: {selected.isbn} · 출판 {selected.publishDate}</p>
                  {(() => { const c = CATEGORIES.find(c => c.id === selected.category); return c ? <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: c.color, background: `${c.color}18` }}>{c.label}</span> : null; })()}
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">도서 소개</p>
                  <p className="text-sm text-foreground leading-relaxed">{selected.description}</p>
                </div>
                <div className="bg-slate-50 border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-xs font-semibold text-muted-foreground">신청 사유</p>
                    <p className="text-xs text-muted-foreground">{selected.applicant} · {formatDate(selected.appliedDate)}</p>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{selected.reason}</p>
                </div>
              </div>

              {done ? (
                <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${selected.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                  {selected.status === "approved" ? <CheckCircle size={15} /> : <XCircle size={15} />}
                  {selected.status === "approved" ? "승인되어 DDS 도서 목록에 등록되었습니다." : "반려 처리된 신청입니다."}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => updateStatus(selected.id, "reviewing")} disabled={selected.status === "reviewing"} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-amber-50 hover:border-amber-200 transition-colors disabled:opacity-40">
                    <Clock size={14} className="text-amber-500" />검토 시작
                  </button>
                  <button onClick={() => updateStatus(selected.id, "supplement")} disabled={selected.status === "supplement"} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-violet-50 hover:border-violet-200 transition-colors disabled:opacity-40">
                    <AlertTriangle size={14} className="text-violet-500" />보완 요청
                  </button>
                  <button onClick={() => updateStatus(selected.id, "rejected")} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors">
                    <XCircle size={14} />반려
                  </button>
                  <button onClick={() => updateStatus(selected.id, "approved")} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors">
                    <CheckCircle size={14} />승인
                  </button>
                </div>
              )}
            </div>
          ) : (
            <EmptyState icon={ShieldCheck} title="신청을 선택하세요" desc="왼쪽 목록에서 신청을 선택하면 상세 정보와 처리 버튼이 나타납니다." />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

interface NavState { page: Page; data?: unknown }

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [stack, setStack] = useState<NavState[]>([{ page: "home" }]);
  const [savedVideos, setSavedVideos] = useState<string[]>([]);
  const [savedBooks, setSavedBooks] = useState<string[]>([]);
  const chat = useChat();
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);

  const current = stack[stack.length - 1];

  const showToast = useCallback((msg: string, type: ToastType) => setToast({ msg, type }), []);
  const closeToast = useCallback(() => setToast(null), []);

  const onNav = useCallback((page: Page, data?: unknown) => {
    setStack(s => {
      const topLevel: Page[] = ["home", "videos", "books", "community", "search", "admin"];
      if (topLevel.includes(page)) return [{ page, data }];
      return [...s, { page, data }];
    });
    window.scrollTo({ top: 0 });
  }, []);

  const onBack = useCallback(() => {
    setStack(s => (s.length > 1 ? s.slice(0, -1) : [{ page: "home" }]));
    window.scrollTo({ top: 0 });
  }, []);

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) =>
    setter(list => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]));
  const onSaveVideo = toggle(setSavedVideos);
  const onSaveBook = toggle(setSavedBooks);

  const handleLogout = () => {
    setUser(null);
    setStack([{ page: "home" }]);
    showToast("로그아웃되었습니다", "info");
  };


  if (!user) {
    return (
      <>
        <LoginPage onLogin={setUser} onShowToast={showToast} />
        {toast && <Toast message={toast.msg} type={toast.type} onClose={closeToast} />}
      </>
    );
  }

  let content: React.ReactNode = null;
  switch (current.page) {
    case "home":
      content = <HomePage onNav={onNav} savedVideos={savedVideos} onSaveVideo={onSaveVideo} savedBooks={savedBooks} onSaveBook={onSaveBook} />;
      break;
    case "videos":
      content = <VideosPage onNav={onNav} savedVideos={savedVideos} onSaveVideo={onSaveVideo} />;
      break;
    case "video-detail":
      content = <VideoDetailPage key={(current.data as Video).id} video={current.data as Video} onBack={onBack} onNav={onNav} savedVideos={savedVideos} onSaveVideo={onSaveVideo} />;
      break;
    case "books":
      content = <BooksPage onNav={onNav} savedBooks={savedBooks} onSaveBook={onSaveBook} onShowToast={showToast} />;
      break;
    case "book-detail":
      content = <BookDetailPage key={(current.data as Book).id} book={current.data as Book} onBack={onBack} onNav={onNav} savedBooks={savedBooks} onSaveBook={onSaveBook} />;
      break;
    case "book-register":
      content = <BookRegisterPage onBack={onBack} onShowToast={showToast} />;
      break;
    case "community":
      content = <ChatPage chat={chat} userName={user.displayName} request={current.data as ChatRequest | undefined} />;
      break;
    case "search":
      content = <SearchPage key={String(current.data ?? "")} initialQuery={(current.data as string) || ""} onNav={onNav} savedVideos={savedVideos} onSaveVideo={onSaveVideo} savedBooks={savedBooks} onSaveBook={onSaveBook} />;
      break;
    case "admin":
      content = user.isAdmin ? <AdminPage /> : <EmptyState icon={Lock} title="접근 권한이 없습니다" desc="관리자 계정으로 로그인해야 이용할 수 있습니다." />;
      break;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header currentPage={current.page} onNav={p => onNav(p)} notifCount={2} user={user} onLogout={handleLogout} savedCount={savedVideos.length + savedBooks.length} />
      <main className="max-w-7xl mx-auto pb-8" style={{ paddingTop: "calc(56px + 24px + env(safe-area-inset-top, 0px))", paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}>
        {content}
      </main>
      {current.page !== "community" && <footer className="border-t border-border bg-card">
        <div className="max-w-7xl mx-auto py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Layers size={14} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">DDS</p>
              <p className="text-xs text-muted-foreground">창조과학 지식 커뮤니티</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>이용약관</span>
            <span>개인정보처리방침</span>
            <span>문의하기</span>
            <span>© 2026 DDS</span>
          </div>
        </div>
      </footer>}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={closeToast} />}
    </div>
  );
}
