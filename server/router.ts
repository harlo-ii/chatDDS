import type { IncomingMessage, ServerResponse } from "node:http";
import { handleBooks } from "./books";
import { handleChat, handleChatStatus } from "./chat";
import { handleVideos } from "./videos";
import type { Env, HandlerResult } from "./common";

type GetRoute = (p: URLSearchParams, env: Env) => Promise<HandlerResult>;
type PostRoute = (body: unknown, env: Env) => Promise<HandlerResult>;

const getRoutes: Record<string, GetRoute> = {
  "/api/videos": handleVideos,
  "/api/books": handleBooks,
  "/api/chat": handleChatStatus,
};
const postRoutes: Record<string, PostRoute> = {
  "/api/chat": handleChat,
};

const MAX_BODY = 100_000;

async function readBody(req: IncomingMessage): Promise<unknown> {
  // Vercel은 body를 미리 파싱해 req.body에 넣어 줌
  const pre = (req as IncomingMessage & { body?: unknown }).body;
  if (pre !== undefined) return typeof pre === "string" ? JSON.parse(pre) : pre;
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw new Error("too large");
    chunks.push(c as Buffer);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

const bad = (message: string, status = 400): HandlerResult => ({ status, body: { error: { code: "BAD_REQUEST", message } } });

/** Node(http/connect/Vercel) 공용 핸들러. 매칭되면 true */
export async function handleApi(req: IncomingMessage, res: ServerResponse, env: Env): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname.replace(/\/$/, "");
  const get = getRoutes[path];
  const post = postRoutes[path];
  if (!get && !post) return false;

  if (get && req.method === "GET") {
    send(res, await get(url.searchParams, env));
  } else if (post && req.method === "POST") {
    let body: unknown;
    try {
      body = await readBody(req);
    } catch {
      send(res, bad("요청 본문(JSON)을 읽을 수 없습니다."));
      return true;
    }
    send(res, await post(body, env));
  } else {
    const allowed = [path in getRoutes ? "GET" : "", path in postRoutes ? "POST" : ""].filter(Boolean).join(", ");
    res.setHeader("Allow", allowed);
    send(res, bad(`${allowed}만 지원합니다.`, 405));
  }
  return true;
}

function send(res: ServerResponse, r: HandlerResult) {
  res.statusCode = r.status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (r.maxAge && r.status === 200) res.setHeader("Cache-Control", `public, max-age=${r.maxAge}, s-maxage=${r.maxAge}`);
  else res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(r.body));
}
