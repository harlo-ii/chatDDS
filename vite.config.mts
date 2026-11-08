import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { handleApi } from "./server/router";

/** 개발 서버(npm run dev)·프리뷰(npm run preview)에서 /api/* 를 직접 처리 */
function apiMiddleware(env: Record<string, string>): Plugin {
  const mount = (server: { middlewares: { use: (fn: any) => void } }) => {
    server.middlewares.use(async (req: any, res: any, next: () => void) => {
      try {
        if (!(await handleApi(req, res, { ...process.env, ...env }))) next();
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: { code: "UPSTREAM", message: String(e) } }));
      }
    });
  };
  return { name: "dds-api", configureServer: mount, configurePreviewServer: mount };
}

export default defineConfig(({ mode }) => {
  // .env / .env.local 의 YOUTUBE_API_KEY, NL_API_KEY (VITE_ 접두사 없이 → 브라우저에 노출 안 됨)
  const env = loadEnv(mode, process.cwd(), "");
  // SINGLEFILE=1 npm run build → HTML 한 파일로 묶기 (데모 배포용)
  const singleFile = process.env.SINGLEFILE === "1";
  return {
    plugins: [react(), tailwindcss(), apiMiddleware(env), ...(singleFile ? [viteSingleFile()] : [])],
    build: singleFile ? { assetsInlineLimit: 100000000 } : {},
  };
});
