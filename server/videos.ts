// GET /api/videos?perChannel=8
// 창조과학 채널들의 최신 업로드를 YouTube Data API v3로 가져와 날짜순으로 합쳐 돌려줌.
// 쿼터: 채널당 playlistItems 1unit + videos 50개당 1unit → 호출 1회에 약 10unit. 30분 캐시.

import { CHANNELS, classifyVideo, type ApiVideo, type VideosResponse } from "../shared/catalog";
import { ApiFailure, cached, clampInt, cleanText, fail, getJson, type Env, type HandlerResult } from "./common";

const YT = "https://www.googleapis.com/youtube/v3";
const TTL = 30 * 60 * 1000;

function isoToSeconds(iso: string): number {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "");
  if (!m) return 0;
  const [, d, h, mi, s] = m.map(x => Number(x) || 0);
  return d * 86400 + h * 3600 + mi * 60 + s;
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

async function yt(path: string, params: Record<string, string>, key: string) {
  const qs = new URLSearchParams({ ...params, key });
  const json = await getJson(`${YT}/${path}?${qs}`);
  if (json.error) {
    const reason: string = json.error.errors?.[0]?.reason ?? "";
    if (reason === "keyInvalid" || /API key not valid/i.test(json.error.message)) {
      throw new ApiFailure("INVALID_KEY", "YouTube API 키가 유효하지 않습니다. YOUTUBE_API_KEY 값을 확인하세요.");
    }
    if (reason === "quotaExceeded") {
      throw new ApiFailure("UPSTREAM", "YouTube API 일일 할당량을 초과했습니다. 내일 다시 시도하세요.", 429);
    }
    const err = new ApiFailure("UPSTREAM", `YouTube API 오류: ${json.error.message}`);
    (err as any).httpStatus = json.__status;
    throw err;
  }
  return json;
}

async function loadVideos(key: string, perChannel: number): Promise<VideosResponse> {
  // 1) 채널별 업로드 재생목록(UU…)에서 최신 영상 ID 수집
  const lists = await Promise.allSettled(
    CHANNELS.map(ch =>
      yt("playlistItems", { part: "contentDetails", playlistId: "UU" + ch.id.slice(2), maxResults: String(perChannel) }, key)
    )
  );

  // 키 자체가 문제면 채널별 실패가 아니라 전체 실패로 알림
  const keyFail = lists.find(r => r.status === "rejected" && (r.reason as ApiFailure)?.code === "INVALID_KEY");
  if (keyFail) throw (keyFail as PromiseRejectedResult).reason;
  const quotaFail = lists.find(r => r.status === "rejected" && (r.reason as ApiFailure)?.status === 429);
  if (quotaFail && lists.every(r => r.status === "rejected")) throw (quotaFail as PromiseRejectedResult).reason;

  const ids: string[] = [];
  lists.forEach(r => {
    if (r.status === "fulfilled") {
      for (const it of r.value.items ?? []) if (it.contentDetails?.videoId) ids.push(it.contentDetails.videoId);
    }
  });
  if (ids.length === 0) {
    const first = lists.find(r => r.status === "rejected") as PromiseRejectedResult | undefined;
    throw first?.reason ?? new ApiFailure("UPSTREAM", "채널에서 영상을 찾지 못했습니다.");
  }

  // 2) 상세 정보(길이·조회수) 50개 단위로 조회
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
  const details = await Promise.all(
    chunks.map(c => yt("videos", { part: "snippet,contentDetails,statistics", id: c.join(","), maxResults: "50" }, key))
  );

  const videos: ApiVideo[] = [];
  for (const d of details) {
    for (const v of d.items ?? []) {
      const sn = v.snippet ?? {};
      if (sn.liveBroadcastContent === "upcoming" || sn.liveBroadcastContent === "live") continue;
      const sec = isoToSeconds(v.contentDetails?.duration);
      if (sec > 0 && sec <= 60) continue; // 쇼츠 제외
      const th = sn.thumbnails ?? {};
      const title = cleanText(sn.title);
      const description = cleanText(sn.description, 1500);
      videos.push({
        id: v.id,
        title,
        channel: sn.channelTitle ?? "",
        channelId: sn.channelId ?? "",
        views: Number(v.statistics?.viewCount ?? 0),
        date: sn.publishedAt ?? "",
        duration: sec ? formatDuration(sec) : "LIVE",
        thumbnail: (th.maxres ?? th.standard ?? th.high ?? th.medium ?? th.default)?.url ?? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
        description,
        categories: classifyVideo(`${title}\n${sn.tags?.join(" ") ?? ""}\n${description.slice(0, 400)}`),
      });
    }
  }
  videos.sort((a, b) => b.date.localeCompare(a.date));

  return { videos, channels: CHANNELS, fetchedAt: new Date().toISOString() };
}

export async function handleVideos(params: URLSearchParams, env: Env): Promise<HandlerResult> {
  const key = env.YOUTUBE_API_KEY;
  if (!key) {
    return fail(new ApiFailure("NO_KEY", "서버에 YOUTUBE_API_KEY가 설정되지 않았습니다.", 503));
  }
  const perChannel = clampInt(params.get("perChannel"), 8, 1, 25);
  try {
    const body = await cached(`videos:${perChannel}`, TTL, () => loadVideos(key, perChannel));
    return { status: 200, body, maxAge: 600 };
  } catch (e) {
    return fail(e);
  }
}
