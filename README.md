# DDS — 창조과학 지식 커뮤니티

Figma Make `DDS_최종` 디자인을 옮긴 React 프로젝트.
영상은 창조과학 유튜브 채널들의 최신 업로드, 도서는 국립중앙도서관 API에서 카테고리별로 불러오고, 커뮤니티는 ChatDDS(창조과학 AI)에게 질문하는 대화 화면.

## 실행

```bash
npm install
cp .env.example .env.local   # 키 입력
npm run dev                  # http://localhost:5173
```

키가 없어도 실행은 됨. 이때 영상·도서는 샘플 데이터로 표시되고 화면에 안내 배너가 뜸.

## API 키

| 변수 | 발급처 | 비고 |
|---|---|---|
| `YOUTUBE_API_KEY` | [Google Cloud Console](https://console.cloud.google.com/apis/library/youtube.googleapis.com) → YouTube Data API v3 사용 설정 → 사용자 인증 정보 → API 키 | 무료 할당량 하루 10,000unit. 영상 목록 1회 갱신에 약 10unit, 서버에서 30분 캐시 |
| `CHATDDS_API_KEY` | ChatDDS 운영자에게 전달받음 | `POST /api/chat`가 서버에서 중계. 응답 20~30초, 무료 서버라 첫 요청은 더 걸림 |
| `NL_API_KEY` | [국립중앙도서관 Open API](https://www.nl.go.kr/NL/contents/N31101010000.do) → 인증키 신청 | ISBN 서지정보 API(`/seoji/SearchApi.do`) 사용. 카테고리 목록 6시간 캐시 |

키는 서버(`/api/*`)에서만 쓰이고 브라우저로 내려가지 않음 (`VITE_` 접두사 없음).

## 구조

```
shared/catalog.ts     채널 목록, 카테고리별 영상 분류 키워드·도서 검색어, API 타입  ← 콘텐츠 조정은 여기서
server/
  videos.ts           GET /api/videos  — 채널 업로드 재생목록 → 영상 상세(길이·조회수), 쇼츠·예정 라이브 제외
  books.ts            GET /api/books?category=fossil | ?q=검색어 — 국중도 서지정보 API, 중복(종이책/전자책) 병합
  chat.ts             POST /api/chat — ChatDDS(OpenAI 호환) 프록시, 멀티턴·출처 반환
  router.ts           Node 공용 라우터 (Vite 미들웨어·Vercel 함수에서 같이 사용)
api/                  Vercel Serverless Function 진입점
src/
  lib/api.ts          useVideos / useBooks 훅, 샘플 폴백, 클라이언트 캐시
  lib/sample.ts       키 없을 때 보여줄 샘플 데이터
  app/App.tsx         화면 전체
  app/ChatPage.tsx    커뮤니티 = ChatDDS 대화 화면 (주제별 추천 질문, 출처, 마크다운 답변)
  lib/useChat.ts      대화 상태 (페이지 이동·새로고침해도 유지)
```

### 콘텐츠 조정

- **채널 추가/삭제**: `CHANNELS`에 채널 ID(`UC…`) 추가. 채널 페이지 소스에서 `"externalId"`로 찾을 수 있음
- **영상 카테고리**: 유튜브엔 주제 분류가 없어서 제목·태그·설명의 키워드(`VIDEO_KEYWORDS`)로 분류함. 어디에도 안 걸리면 ‘전체’에만 표시
- **도서 카테고리**: `BOOK_QUERIES`의 검색어로 표제 검색 → 검색어의 모든 단어가 제목에 들어간 책만 남김. 엉뚱한 책이 섞이면 검색어를 더 구체적으로 바꾸면 됨

## 배포 (Vercel)

1. 저장소를 Vercel에 연결 (프레임워크 Vite 자동 인식, `api/` 폴더는 함수로 배포됨)
2. Project Settings → Environment Variables에 `YOUTUBE_API_KEY`, `NL_API_KEY`, `CHATDDS_API_KEY` 추가
   (`api/chat.ts`는 실행 시간을 120초로 늘려 둠. Hobby 플랜 최대치가 이보다 짧으면 그 값으로 제한됨)
3. 배포

다른 호스팅이면 `server/router.ts`의 `handleApi(req, res, process.env)`를 Express 등에 붙이면 됨.
정적 호스팅(서버 없음)에선 자동으로 샘플 데이터 모드로 동작.

## 기타 스크립트

- `npm run build:single` — JS·CSS·폰트·이미지를 HTML 한 파일(`dds.html`)로 묶음 (데모용, API 없이 샘플 모드)
- `npm run typecheck` — 타입 검사

## 참고

- 스택: Vite 6 · React 18 · Tailwind CSS v4 · lucide-react
- 테스트 계정: `admin / admin1234` (관리자), `user1 / user1234` (일반)
- 관리자 도서 신청 목록은 아직 목업 (새로고침 시 초기화)
