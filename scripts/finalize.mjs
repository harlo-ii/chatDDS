// Inline remote images as data URIs and reshape the Vite single-file build for Artifact publishing.
import fs from "node:fs";

const src = fs.readFileSync("dist/index.html", "utf8");
const urls = [...new Set(src.match(/https:\/\/images\.unsplash\.com\/[^"`'\s]+/g) || [])];

let html = src;
for (const url of urls) {
  const res = await fetch(url + "&fm=webp&q=72");
  if (!res.ok) throw new Error(`Image fetch failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get("content-type") || "image/webp";
  html = html.split(url).join(`data:${type};base64,${buf.toString("base64")}`);
  console.log("inlined", url.slice(34, 70), buf.length);
}

const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(m => m[0]).join("\n");
const scripts = [...html.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map(m => m[0]).join("\n");

const out = `<title>DDS</title>
<meta name="claude:viewport-fit-sides" content="cover">
${styles}
<style>body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:rgba(255,255,255,.9)}</style>
<div id="root"></div>
${scripts}
`;
fs.writeFileSync("dds.html", out);
console.log("dds.html", (out.length / 1024 / 1024).toFixed(2), "MB");
