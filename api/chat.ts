// Vercel Serverless Function — /api/chat (POST)
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleApi } from "../server/router";

// ChatDDS 응답이 20~30초(콜드스타트 시 더) 걸리므로 함수 실행 시간을 늘림
export const config = { maxDuration: 120 };

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleApi(req, res, process.env);
}
