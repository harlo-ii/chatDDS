// Vercel Serverless Function — /api/videos
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleApi } from "../server/router";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleApi(req, res, process.env);
}
