# orbit

YouTube 구간 기반 반복 학습 앱 (React + Vite).

## 주요 기능

- 유튜브 영상 구간(시작/끝) 반복 재생 학습
- 사용자 제공 자막 붙여넣기/파일 업로드(SRT, VTT, TXT)
- 자막 줄 클릭 + `Shift+클릭` 범위 선택
- 선택 문장 저장 후 듣고 따라 말하기(Shadowing) 이동
- SRS 복습(어려움/보통/쉬움) + Anki 스타일 재등장 로직
- 외부 AI 질문 바(ChatGPT/Gemini용 프롬프트 복사/열기)

## 기술 스택

- React 18 + TypeScript + Vite
- React Router
- SSG 프리렌더링 (SSR 엔트리 + 하이드레이션)
- Tailwind CSS + shadcn/ui
- IndexedDB 우선 저장 + LocalStorage fallback
- YouTube IFrame Player API

## 배포

- Vercel 프로덕션: `https://orbit-or.vercel.app`
- 배포 프로젝트: `orbit` (`orbit.vercel.app` 점유로 대체 alias 사용)

## 학습 흐름

`청취 -> 구간 선택 -> 문장 선택/저장 -> AI 질문 -> Shadowing -> SRS 복습`

## 데이터 정책

- YouTube 자막 자동 추출(네트워크/DOM 파싱) 미사용
- 사용자 제공 텍스트만 처리
- 학습 데이터는 로컬 저장 중심

## 로컬 실행

```bash
npm install
npm run dev
```

- 기본 개발 서버: `http://localhost:8080`

## 테스트/빌드

```bash
npm run test
npm run build
npm run preview
```

- `npm run build`는 아래를 순차 실행합니다.
- `build:client` -> `build:ssr` -> `prerender`

## 프로젝트 구조(핵심)

- `src/main.tsx`: 클라이언트 하이드레이션/CSR 진입점
- `src/entry-server.tsx`: SSG용 서버 렌더 엔트리
- `scripts/prerender.mjs`: 정적 라우트 HTML 생성 스크립트
- `vercel.json`: Vercel 빌드/출력/동적 라우트 rewrite 설정
- `src/pages/Learn.tsx`: 학습 화면
- `src/pages/Shadowing.tsx`: 녹음/쉐도잉 화면
- `src/pages/Srs.tsx`: 복습 화면
- `src/components/learn/TranscriptPanel.tsx`: 자막 파싱/선택 UI
- `src/components/YouTubePlayer.tsx`: 유튜브 플레이어 래퍼
- `src/domain/srsScheduler.ts`: SRS 스케줄 계산
- `src/storage/`: 저장소 계층
