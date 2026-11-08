// 서버와 클라이언트가 함께 쓰는 설정: 유튜브 채널 목록, 카테고리별 키워드.
// 채널을 추가·삭제하려면 CHANNELS만 고치면 됨 (채널 ID는 UC로 시작하는 값).

export interface Channel {
  id: string;
  name: string;
  handle: string;
}

export const CHANNELS: Channel[] = [
  { id: "UCxXXc3pL1iUCY0EmYdxZSGg", name: "창조과학선교회", handle: "@창조과학선교회" },
  { id: "UCdPOyzwyg6q0ETClz_nMLAw", name: "김명현 박사", handle: "@김명현박사" },
  { id: "UCvoQXK1uz9J4UPXQUhQIG8g", name: "한국창조과학회", handle: "@creationscience0131" },
  { id: "UCh_fh526OYV1Ved3KS5NjaA", name: "CGN 창조과학과 신앙", handle: "@cgncreationscience" },
  { id: "UCzojidsatBSPOVrNWXscAgw", name: "창조와말씀", handle: "@thecreationword" },
  { id: "UCdZ2Bja2PeXWul_r88E9p-g", name: "NoiseSymphony 성경창조역사", handle: "@noisesymphonybible" },
  { id: "UCP9FSuX8H-EhQCm_LfcRq4g", name: "김진호 박사의 창조론 강의", handle: "@김진호박사" },
  // 해외 채널이 필요하면 주석 해제
  // { id: "UCicvc24eAbFp-thRrBnSP2A", name: "Answers in Genesis", handle: "@answersingenesis" },
  // { id: "UCNYHIPRt3QmzQXv1WPqyoEg", name: "Creation Ministries International", handle: "@CreationMinistriesIntl" },
  // { id: "UCH2PLuQwGuY_Q9NvNng7Twg", name: "Institute for Creation Research", handle: "@ICRscience" },
];

export type CategoryId = "astronomy" | "geology" | "genetics" | "fossil" | "creation" | "bible" | "children";

export const CATEGORY_IDS: CategoryId[] = ["astronomy", "geology", "genetics", "fossil", "creation", "bible", "children"];

/**
 * 영상 분류용 키워드. 제목+설명에 하나라도 포함되면 해당 카테고리로 분류.
 * 여러 카테고리에 동시에 속할 수 있음.
 */
export const VIDEO_KEYWORDS: Record<CategoryId, string[]> = {
  astronomy: ["우주", "천문", "별", "은하", "빅뱅", "태양", "달", "행성", "블랙홀", "미세조정", "미세 조정", "빛의 속도", "별빛"],
  geology: ["지질", "지층", "홍수", "노아", "방주", "퇴적", "그랜드캐니언", "그랜드 캐니언", "화산", "빙하", "암석", "연대측정", "지구 나이", "판구조"],
  genetics: ["DNA", "유전", "세포", "단백질", "생명의 기원", "생명 기원", "지적설계", "지적 설계", "분자", "게놈", "돌연변이", "인체"],
  fossil: ["화석", "공룡", "캄브리아", "시조새", "멸종", "매머드", "중간화석", "중간 화석"],
  creation: ["진화", "다윈", "창조론", "자연선택", "유인원", "원숭이", "공통조상", "6일 창조", "젊은 지구", "오랜 지구"],
  bible: ["성경", "창세기", "말씀", "하나님", "예수", "신앙", "설교", "에덴", "바벨"],
  children: ["어린이", "아이들", "키즈", "주일학교", "청소년", "학생", "중고등", "초등", "교육"],
};

/**
 * 도서 검색 쿼리 (국립중앙도서관 ISBN 서지정보 API, 표제 검색).
 * 쿼리의 모든 단어가 책 제목에 들어 있어야 결과로 채택됨 (서버에서 한 번 더 걸러냄).
 */
export const BOOK_QUERIES: Record<CategoryId, string[]> = {
  astronomy: ["창조 우주", "젊은 우주", "우주 설계", "빅뱅 창조", "천문학 성경"],
  geology: ["노아 홍수", "대홍수 지질", "창조 지질", "지층 창조", "노아 방주"],
  genetics: ["지적 설계", "DNA 창조", "생명 기원", "다윈 블랙박스", "세포 설계"],
  fossil: ["공룡 창조", "화석 창조", "공룡 성경", "캄브리아 폭발", "화석 진화"],
  creation: ["창조과학", "창조론", "진화론 비판", "창조 진화", "진화론 허구"],
  bible: ["성경 과학", "창세기 과학", "창세기 창조", "과학 신앙", "과학 하나님"],
  children: ["어린이 창조", "창조과학 동화", "창조 그림책", "청소년 창조과학", "어린이 공룡 성경"],
};

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  astronomy: "우주·천문",
  geology: "지구·지질",
  genetics: "생명·유전",
  fossil: "화석·공룡",
  creation: "창조와 진화",
  bible: "성경과 과학",
  children: "어린이·청소년",
};

export function classifyVideo(text: string): CategoryId[] {
  const t = text.toLowerCase();
  return CATEGORY_IDS.filter(id => VIDEO_KEYWORDS[id].some(k => t.includes(k.toLowerCase())));
}

// ─── API 응답 타입 ───────────────────────────────────────────────────────────

export interface ApiVideo {
  id: string;
  title: string;
  channel: string;
  channelId: string;
  views: number;
  date: string; // ISO
  duration: string; // "12:34"
  thumbnail: string;
  description: string;
  categories: CategoryId[];
}

export interface ApiBook {
  id: string; // ISBN
  title: string;
  author: string;
  publisher: string;
  publishDate: string; // YYYY-MM-DD 또는 ""
  isbn: string;
  cover: string; // 없으면 ""
  description: string;
  kdc: string;
  subject: string;
  pages: string;
  price: string;
  category: CategoryId | "";
}

export interface ApiError {
  error: { code: "NO_KEY" | "INVALID_KEY" | "UPSTREAM" | "BAD_REQUEST"; message: string };
}

export interface VideosResponse {
  videos: ApiVideo[];
  channels: Channel[];
  fetchedAt: string;
}

export interface BooksResponse {
  books: ApiBook[];
  total: number;
  page: number;
  hasMore: boolean;
}
