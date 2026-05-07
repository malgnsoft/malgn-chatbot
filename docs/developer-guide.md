# Malgn Chatbot 개발자 교육 자료

> **최종 업데이트**: 2026-03-18
> **대상**: 신규 개발자, 유지보수 담당자, 기여자

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [개발 환경 설정](#2-개발-환경-설정)
3. [저장소 구조](#3-저장소-구조)
4. [아키텍처 개요](#4-아키텍처-개요)
5. [프론트엔드 상세](#5-프론트엔드-상세)
6. [백엔드 API 상세](#6-백엔드-api-상세)
7. [데이터베이스](#7-데이터베이스)
8. [RAG 파이프라인](#8-rag-파이프라인)
9. [핵심 비즈니스 로직](#9-핵심-비즈니스-로직)
10. [이벤트 시스템과 모듈 통신](#10-이벤트-시스템과-모듈-통신)
11. [임베드 위젯 개발](#11-임베드-위젯-개발)
12. [멀티테넌트 운영](#12-멀티테넌트-운영)
13. [빌드와 배포](#13-빌드와-배포)
14. [디버깅과 트러블슈팅](#14-디버깅과-트러블슈팅)
15. [코딩 규칙과 컨벤션](#15-코딩-규칙과-컨벤션)
16. [API 레퍼런스](#16-api-레퍼런스)

---

## 1. 프로젝트 개요

### 1.1 서비스 정의

Malgn Chatbot은 LMS(학습관리시스템)에 임베드하여 사용하는 **RAG 기반 AI 튜터 챗봇 플랫폼**이다.

교수자가 학습 자료(텍스트, PDF, 자막, 링크)를 등록하면, AI가 자동으로 학습 목표·요약·추천 질문·퀴즈를 생성하고, 학습자는 등록된 자료를 근거로 실시간 질의응답을 받는다.

### 1.2 핵심 가치

| 가치 | 설명 |
|------|------|
| **정확성** | 등록된 학습 자료만을 근거로 답변 (환각 최소화) |
| **자동화** | 콘텐츠 등록 한 번으로 학습 메타데이터·퀴즈 자동 생성 |
| **무중단 통합** | HTML 코드 한 줄로 기존 LMS에 임베드 |
| **확장성** | 부모-자식 세션으로 수백 명 동시 지원 |

### 1.3 기술 스택 요약

```
┌─────────────────────────────────────────────────────┐
│                    Cloudflare 생태계                    │
├──────────────┬──────────────┬───────────────────────┤
│  Pages       │  Workers     │  AI                   │
│  (프론트엔드) │  (백엔드 API) │  (LLM + Embedding)    │
├──────────────┼──────────────┼───────────────────────┤
│  D1 (SQLite) │  Vectorize   │  KV (캐시)            │
│              │  (벡터 검색)  │  R2 (파일 스토리지)    │
└──────────────┴──────────────┴───────────────────────┘
```

| 구분 | 기술 |
|------|------|
| 프론트엔드 | Vanilla JS, Bootstrap 5, esbuild (IIFE 번들링) |
| 백엔드 | Cloudflare Workers, Hono 프레임워크 |
| DB | Cloudflare D1 (SQLite) |
| 벡터 DB | Cloudflare Vectorize (768차원, 코사인 유사도) |
| AI 모델 (채팅) | `@cf/meta/llama-3.1-8b-instruct` |
| AI 모델 (학습/퀴즈) | `@cf/meta/llama-3.1-70b-instruct` |
| 임베딩 모델 | `@cf/baai/bge-base-en-v1.5` (768차원) |
| AI Gateway | Cloudflare AI Gateway (cache 3600s) |

---

## 2. 개발 환경 설정

### 2.1 사전 요구사항

```bash
node -v   # v18 이상
npm -v    # v9 이상
npx wrangler --version   # Wrangler v3 이상
```

### 2.2 저장소 클론 및 초기화

```bash
# 4개 저장소 클론
git clone <repo>/malgn-chatbot.git
git clone <repo>/malgn-chatbot-api.git
git clone <repo>/malgn-chatbot-user1.git
git clone <repo>/malgn-chatbot-cloud.git

# 프론트엔드 의존성 설치
cd malgn-chatbot && npm install

# 백엔드 의존성 설치
cd ../malgn-chatbot-api && npm install
```

### 2.3 로컬 개발 서버 실행

```bash
# 백엔드 API (localhost:8787)
cd malgn-chatbot-api
wrangler dev

# 프론트엔드 (별도 터미널, 정적 서버)
cd malgn-chatbot
npx serve .    # 또는 Live Server 등
```

### 2.4 환경 변수 (`.dev.vars`)

백엔드 로컬 개발 시 `malgn-chatbot-api/.dev.vars` 파일이 필요하다:

```env
API_KEY=your-local-api-key
OPENAI_API_KEY=sk-xxx          # 선택: OpenAI 연동 시
```

> **주의**: `.dev.vars`는 `.gitignore`에 포함되어 있다. 절대 커밋하지 않는다.

### 2.5 D1 로컬 데이터베이스

Wrangler dev 모드에서 D1은 자동으로 로컬 SQLite를 생성한다.

```bash
# 스키마 초기 적용
wrangler d1 execute malgn-chatbot-db --local --file=./schema.sql

# 마이그레이션 적용
wrangler d1 execute malgn-chatbot-db --local --file=./migrations/001_quiz_content_based.sql
wrangler d1 execute malgn-chatbot-db --local --file=./migrations/002_session_course_fields.sql
wrangler d1 execute malgn-chatbot-db --local --file=./migrations/003_session_parent_id.sql
wrangler d1 execute malgn-chatbot-db --local --file=./migrations/004_content_lesson_id.sql
wrangler d1 execute malgn-chatbot-db --local --file=./migrations/005_session_quiz_difficulty.sql
```

---

## 3. 저장소 구조

### 3.1 전체 저장소 맵

```
malgn-chatbot/              ← 프론트엔드 (관리자 대시보드 + 임베드 위젯)
malgn-chatbot-api/          ← 백엔드 API (Cloudflare Workers)
malgn-chatbot-user1/        ← user1 테넌트 프론트엔드 배포본
malgn-chatbot-cloud/        ← cloud 테넌트 프론트엔드 배포본 (MySQL 기반)
```

### 3.2 프론트엔드 디렉토리 (`malgn-chatbot/`)

```
malgn-chatbot/
├── index.html                  # 관리자 대시보드 (3컬럼 레이아웃)
├── package.json                # esbuild 빌드 설정
│
├── css/
│   ├── style.css               # 대시보드 스타일 (Bootstrap 5 확장)
│   └── chatbot.css             # 임베드 위젯 스타일 (Shadow DOM 격리)
│
├── js/
│   ├── app.js                  # 메인 오케스트레이터
│   ├── api.js                  # REST API 클라이언트 (대시보드용)
│   ├── chat.js                 # 채팅 UI & 메시지 관리
│   ├── contents.js             # 콘텐츠 CRUD & 파일 업로드
│   ├── sessions.js             # 세션 목록·생성·삭제
│   ├── settings.js             # AI 설정 (persona, temperature 등)
│   ├── tenants.js              # 멀티테넌트 전환
│   │
│   ├── chatbot-embed.js        # [생성파일] esbuild 번들 결과물
│   │
│   └── embed/                  # 임베드 위젯 소스 (ES6 모듈)
│       ├── index.js            # 진입점, 설정 파싱, 모듈 초기화
│       ├── api.js              # API 클라이언트 클래스
│       ├── chat.js             # ChatManager (메시지·스트리밍)
│       ├── ui.js               # DOM 주입, Shadow DOM, FAB 버튼
│       ├── tabs.js             # TabManager (목표·요약·추천·퀴즈 탭)
│       ├── quiz.js             # QuizManager (퀴즈 렌더링·검증)
│       └── utils.js            # 유틸리티 (escapeHtml, formatContent)
│
└── docs/
    └── history/                # 작업 히스토리 (날짜별)
```

### 3.3 백엔드 디렉토리 (`malgn-chatbot-api/`)

```
malgn-chatbot-api/
├── src/
│   ├── index.js                # Hono 앱 진입점 + 미들웨어 + 라우팅
│   ├── openapi.js              # OpenAPI 3.0 스펙
│   │
│   ├── middleware/
│   │   ├── auth.js             # Bearer 토큰 인증
│   │   └── errorHandler.js     # 글로벌 에러 핸들러
│   │
│   ├── routes/
│   │   ├── chat.js             # POST /chat, /chat/stream
│   │   ├── sessions.js         # CRUD /sessions + 퀴즈
│   │   └── contents.js         # CRUD /contents + 임베딩
│   │
│   ├── services/
│   │   ├── chatService.js      # RAG 파이프라인 핵심 (벡터 검색 → LLM)
│   │   ├── contentService.js   # 파일 업로드·텍스트 추출·임베딩
│   │   ├── embeddingService.js # 텍스트 → 768차원 벡터 변환
│   │   ├── learningService.js  # 학습 메타데이터 생성 (70B LLM)
│   │   ├── quizService.js      # 퀴즈 생성 (4지선다 + OX)
│   │   ├── openaiService.js    # OpenAI 연동 (선택)
│   │   └── userService.js      # 사용자 관리 (Placeholder)
│   │
│   └── utils/
│       └── utils.js            # 유틸리티 함수
│
├── migrations/                 # D1 마이그레이션 (순차 적용)
│   ├── 001_quiz_content_based.sql
│   ├── 002_session_course_fields.sql
│   ├── 003_session_parent_id.sql
│   ├── 004_content_lesson_id.sql
│   └── 005_session_quiz_difficulty.sql
│
├── schema.sql                  # 전체 DB 스키마 (초기 셋업용)
├── wrangler.toml               # Cloudflare 설정 (멀티테넌트)
└── package.json
```

---

## 4. 아키텍처 개요

### 4.1 전체 시스템 아키텍처

```
┌──────────────────────────────────────────────────────────────────┐
│                          사용자 접점                               │
│                                                                  │
│   ┌──────────────────┐         ┌────────────────────────────┐   │
│   │  관리자 대시보드    │         │  LMS 임베드 위젯             │   │
│   │  (index.html)     │         │  (chatbot-embed.js)        │   │
│   │                   │         │                            │   │
│   │  • 콘텐츠 관리     │         │  • 채팅 인터페이스           │   │
│   │  • 세션 관리       │         │  • 학습 탭 (목표/요약/추천)  │   │
│   │  • AI 설정        │         │  • 퀴즈                     │   │
│   │  • 미리보기       │         │  • SSE 스트리밍              │   │
│   └────────┬─────────┘         └──────────┬─────────────────┘   │
│            │                              │                      │
│            └──────────┬───────────────────┘                      │
│                       ▼                                          │
│            ┌─────────────────────┐                               │
│            │  Cloudflare Workers  │                               │
│            │  (Hono Framework)    │                               │
│            │                     │                               │
│            │  Routes → Services  │                               │
│            └──────┬──────────────┘                               │
│                   │                                              │
│     ┌─────────────┼─────────────────────────┐                   │
│     ▼             ▼             ▼            ▼                   │
│  ┌──────┐   ┌──────────┐  ┌────────┐  ┌─────────┐             │
│  │  D1  │   │ Vectorize │  │  AI    │  │  KV/R2  │             │
│  │(SQL) │   │ (벡터DB)  │  │Gateway │  │ (캐시)  │             │
│  └──────┘   └──────────┘  └────────┘  └─────────┘             │
│                                │                                │
│                    ┌───────────┼───────────┐                    │
│                    ▼           ▼           ▼                    │
│               Llama 3.1    Llama 3.1   BGE-base                │
│                 8B           70B        en-v1.5                 │
│               (채팅)      (학습/퀴즈)   (임베딩)                 │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 요청 흐름 (Request Flow)

```
사용자 메시지 전송
       │
       ▼
[프론트엔드] chatbot-embed.js
  │ POST /chat/stream (SSE)
  │ Headers: { Authorization: Bearer <API_KEY> }
  │ Body: { message, sessionId, settings }
  ▼
[미들웨어] auth.js → Bearer 토큰 검증
       │
       ▼
[라우트] routes/chat.js → 입력 검증 (message 0~10000자)
       │
       ▼
[서비스] chatService.prepareChatContext()
  │
  ├── [1단계 병렬] Promise.all([
  │     getSessionContentIdsAndParent(sessionId),  ← D1 쿼리
  │     embeddingService.embed(message),            ← AI: bge-base-en-v1.5
  │     getSessionLearningData(sessionId)           ← D1 쿼리
  │   ])
  │
  ├── [2단계 병렬] Promise.all([
  │     searchSimilarDocuments(embedding, 5, contentIds),  ← Vectorize
  │     getChatHistory(sessionId, 10),                     ← D1 쿼리
  │     getQuizContext(contentIds)                          ← D1 쿼리
  │   ])
  │
  ├── [3단계] buildSystemPrompt() → XML 구조 프롬프트 조립
  │
  └── [4단계] messages 배열 반환
       │
       ▼
[라우트] Workers AI 스트리밍 호출
  │ model: @cf/meta/llama-3.1-8b-instruct
  │ messages: [system, ...history, user]
  │
  ├── SSE event: token → 프론트로 실시간 전송
  ├── SSE event: done  → 메시지 DB 저장 (waitUntil)
  └── SSE event: error → 에러 전달
       │
       ▼
[프론트엔드] 토큰 수신 → DOM 업데이트 → 마크다운 렌더링
```

### 4.3 레이어 구조 (Layered Architecture)

```
┌────────────────────────────────────────────┐
│               Routes Layer                 │
│  chat.js / sessions.js / contents.js       │
│  • HTTP 요청/응답 처리                      │
│  • 입력 검증 (길이, 타입, 범위)             │
│  • 에러 응답 포맷팅                         │
├────────────────────────────────────────────┤
│              Services Layer                │
│  chatService / contentService / etc.       │
│  • 비즈니스 로직                            │
│  • 외부 서비스 호출 (AI, Vectorize)         │
│  • 데이터 변환/조합                         │
├────────────────────────────────────────────┤
│            Infrastructure Layer            │
│  D1 (SQL) / Vectorize / Workers AI / KV    │
│  • 데이터 영속화                            │
│  • 벡터 검색                               │
│  • LLM 추론                               │
└────────────────────────────────────────────┘
```

---

## 5. 프론트엔드 상세

### 5.1 모듈 패턴

프론트엔드는 **두 가지 모듈 패턴**을 사용한다:

#### 대시보드 — 싱글톤 객체 패턴

```javascript
// js/settings.js
const Settings = {
  defaults: { temperature: 0.3, topP: 0.3, maxTokens: 1024 },

  init() {
    this.loadSettings();
    this.bindEvents();
  },

  getSettings() {
    return { ...this.defaults, ...this.stored };
  },

  // ... 기타 메서드
};

window.Settings = Settings;   // 전역 노출
```

**특징**:
- `new` 키워드 없이 즉시 사용 가능
- `window` 객체에 등록하여 모듈 간 참조
- `init()` 메서드로 DOM 바인딩 및 초기화

#### 임베드 위젯 — ES6 클래스 패턴

```javascript
// js/embed/chat.js
export class ChatManager {
  constructor(api, root) {
    this.api = api;
    this.root = root;       // Shadow DOM root
    this.sessionId = null;
    this.isLoading = false;
  }

  init() {
    this.input = this.root.querySelector('.chatbot-input');
    this.sendBtn = this.root.querySelector('.chatbot-send');
    // ... DOM 바인딩
  }

  async sendMessage(text) { /* ... */ }
}
```

**특징**:
- ES6 `import/export`로 모듈 분리
- esbuild가 IIFE로 번들링
- Shadow DOM root를 생성자로 주입

### 5.2 대시보드 모듈 상세

#### app.js — 메인 오케스트레이터

**역할**: 모듈 초기화 순서 제어, 전역 이벤트 바인딩, 임베드 코드 생성

```javascript
// 초기화 순서 (순서 중요!)
const App = {
  init() {
    Tenants.init();     // 1. 테넌트 설정 (API URL 결정)
    Settings.init();    // 2. AI 설정 로드
    Contents.init();    // 3. 콘텐츠 목록 로드
    Sessions.init();    // 4. 세션 목록 로드
    Chat.init();        // 5. 채팅 UI 바인딩

    this.bindGlobalEvents();
  }
};
```

**임베드 코드 생성**:
```javascript
generateEmbedCode(apiUrl, settings, contentIds, apiKey, sessionId) {
  // sessionId가 있으면 → parentSessionId로 자식 세션 모드
  // 없으면 → contentIds로 새 세션 생성 모드
  return `
<script>
window.MalgnTutor = {
  apiUrl: "${apiUrl}",
  apiKey: "${apiKey}",
  parentSessionId: ${sessionId || 0},
  contentIds: [${contentIds.join(',')}],
  settings: ${JSON.stringify(settings)}
};
</script>
<script src="https://malgn-chatbot.pages.dev/js/chatbot-embed.js"></script>`;
}
```

#### api.js — REST API 클라이언트

**자동 환경 감지**:
```javascript
const API = {
  init() {
    // 프로덕션: pages.dev 또는 workers.dev 도메인이면 자동 감지
    if (location.hostname.includes('pages.dev')) {
      this.baseUrl = 'https://malgn-chatbot-api.dotype.workers.dev';
    } else {
      this.baseUrl = 'http://localhost:8787';  // 로컬 개발
    }
  }
};
```

**SSE 스트리밍 처리**:
```javascript
async sendMessageStream(message, sessionId, settings, onToken, onDone, onError) {
  const response = await fetch(`${this.baseUrl}/chat/stream`, {
    method: 'POST',
    headers: this.getHeaders(),
    body: JSON.stringify({ message, sessionId, settings })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    // SSE 파싱: "event: token\ndata: {...}\n\n"
    for (const line of text.split('\n')) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        // event type에 따라 콜백 호출
      }
    }
  }
}
```

#### chat.js — 채팅 인터페이스

**마크다운 렌더링** (`formatContent()`):

```javascript
// 보호 → 파싱 → 복원 3단계
function formatContent(content) {
  // 1단계: 코드 블록/인라인 코드를 플레이스홀더로 보호
  const codeBlocks = [];
  content = content.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // 2단계: 라인별 파싱
  const lines = content.split('\n');
  for (const line of lines) {
    // 헤더: # → <strong class="chatbot-h1">
    // 리스트: - → <ul><li>
    // 볼드: **text** → <strong>text</strong>
    // 이탈릭: *text* → <em>text</em>
  }

  // 3단계: 플레이스홀더를 원래 코드 블록으로 복원
  result = result.replace(/__CODE_BLOCK_(\d+)__/g, (_, i) => {
    return `<pre class="chatbot-code-block">${codeBlocks[i]}</pre>`;
  });

  return result;
}
```

#### contents.js — 콘텐츠 관리

**파일 업로드 흐름**:
```
사용자 파일 선택 (또는 드래그 앤 드롭)
    │
    ├── 확장자 검증: pdf, txt, md, srt, vtt
    ├── 크기 검증: PDF ≤ 10MB, 기타 ≤ 5MB
    │
    ▼
FormData 구성 → POST /contents (multipart/form-data)
    │
    ▼
[백엔드] 텍스트 추출 → DB 저장 → 청크 분할 → 임베딩 → Vectorize 저장
    │
    ▼
콘텐츠 목록 새로고침 → 체크박스 선택 상태 복원
```

**선택 상태 관리**:
```javascript
// selectedContentIds는 Set으로 관리
// localStorage에 영속화하여 새로고침 후에도 유지
selectedContentIds = new Set(JSON.parse(localStorage.getItem('selectedContents') || '[]'));

// 체크박스 토글 시
toggleContent(id) {
  if (this.selectedContentIds.has(id)) {
    this.selectedContentIds.delete(id);
  } else {
    this.selectedContentIds.add(id);
  }
  localStorage.setItem('selectedContents', JSON.stringify([...this.selectedContentIds]));
  window.dispatchEvent(new CustomEvent('contents:changed'));
}
```

#### sessions.js — 세션 관리

**세션 생성 흐름**:
```javascript
async createSession() {
  const contentIds = [...Contents.selectedContentIds];
  if (contentIds.length === 0) {
    alert('콘텐츠를 1개 이상 선택하세요.');
    return;
  }

  const settings = Settings.getAISettings();
  const result = await API.createSession(contentIds, settings);

  // 세션 생성 성공 → 목록 새로고침 → 채팅 로드 → 챗봇 열기
  await this.loadSessions();
  Chat.loadSession(result.data.id);
  App.openChatbot();
}
```

#### settings.js — AI 설정

**설정 구조와 기본값**:
```javascript
const defaults = {
  // 채팅 설정
  welcomeMessage: '안녕하세요! 무엇이든 질문해 주세요.',
  persona: '당신은 친절하고 전문적인 AI 튜터입니다...',
  temperature: 0.3,        // 0 ~ 1 (낮을수록 일관된 답변)
  topP: 0.3,               // 0.1 ~ 1 (낮을수록 집중된 답변)
  maxTokens: 1024,         // 256 ~ 4096

  // 표시 설정
  displayMode: 'layer',    // 'layer' | 'inline'
  chatWidth: 380,          // 픽셀
  chatHeight: 650,         // 픽셀

  // 학습 설정
  summaryCount: 3,         // 핵심 요약 수 (1~10)
  recommendCount: 3,       // 추천 질문 수 (1~10)
  choiceCount: 3,          // 4지선다 수 (0~10)
  oxCount: 2,              // OX 퀴즈 수 (0~10)
  quizDifficulty: 'normal' // 'easy' | 'normal' | 'hard'
};
```

#### tenants.js — 멀티테넌트

**테넌트 전환 흐름**:
```
테넌트 드롭다운 선택
    │
    ├── API.setBaseUrl(tenant.apiUrl)
    ├── API.setApiKey(tenant.apiKey)
    ├── localStorage 저장
    │
    ▼
window.dispatchEvent('tenant:changed')
    │
    ├── Contents.loadContents()   // 새 테넌트 콘텐츠 로드
    ├── Sessions.loadSessions()   // 새 테넌트 세션 로드
    └── Chat.clear()              // 채팅 초기화
```

### 5.3 대시보드 UI 레이아웃

```
┌─────────────────────────────────────────────────────────────┐
│ [로고] Malgn AI Tutor              [테넌트 전환 ▼] [설정]   │
├──────────────┬──────────────────┬───────────────────────────┤
│              │                  │                           │
│  AI 설정     │  학습 자료 관리    │  채팅 세션                 │
│              │                  │                           │
│  • 웰컴 메시지│  [텍스트|파일|링크]│  [+ 새 세션]              │
│  • 페르소나   │                  │                           │
│  • Temperature│ ┌──────────────┐ │  ┌─────────────────────┐ │
│  • Top-P     │ │ 텍스트 입력    │ │  │ 세션 제목            │ │
│  • Max Tokens│ │ 또는           │ │  │ 최근 메시지...        │ │
│              │ │ 파일 드래그    │ │  │ 3분 전 · 5개 메시지   │ │
│  표시 설정    │ └──────────────┘ │  └─────────────────────┘ │
│  • 모드      │                  │  ┌─────────────────────┐ │
│  • 크기      │  콘텐츠 목록      │  │ 세션 제목            │ │
│              │  ☑ 파일1.pdf     │  │ ...                  │ │
│  학습 설정    │  ☑ 강의노트      │  └─────────────────────┘ │
│  • 요약 수   │  ☐ 참고자료      │                           │
│  • 추천 수   │                  │                           │
│  • 퀴즈 수   │                  │                           │
│  • 난이도    │                  │                           │
│              │                  │                           │
├──────────────┴──────────────────┴───────────────────────────┤
│  [임베드 코드]                                    [복사]     │
│  <script>window.MalgnTutor = { ... };</script>              │
└─────────────────────────────────────────────────────────────┘

                            ┌────────────────────┐
                            │ 챗봇 (Layer 모드)   │  ← 고정 위치
                            │ ┌────────────────┐ │     우하단
                            │ │ 목표 | 요약 | ...│ │
                            │ ├────────────────┤ │
                            │ │                │ │
                            │ │  채팅 메시지     │ │
                            │ │                │ │
                            │ ├────────────────┤ │
                            │ │ [입력] [전송]   │ │
                            │ └────────────────┘ │
                            └────────────────────┘
                                        (FAB 버튼)
```

---

## 6. 백엔드 API 상세

### 6.1 프레임워크 구조 (Hono)

```javascript
// src/index.js
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';

const app = new Hono();

// 미들웨어
app.use('*', cors());                                    // CORS 전체 허용
app.use('/chat/*', authMiddleware);                       // 인증 적용
app.use('/contents/*', authMiddleware);
app.use('/sessions/*', authMiddleware);

// 라우팅
app.route('/chat', chatRoutes);
app.route('/contents', contentsRoutes);
app.route('/sessions', sessionsRoutes);

// 유틸리티
app.get('/', (c) => c.redirect('/docs'));                 // 루트 → Swagger
app.get('/health', (c) => c.json({ status: 'ok' }));
app.get('/docs', swaggerUI({ url: '/openapi.json' }));

export default app;
```

### 6.2 인증 미들웨어

```javascript
// src/middleware/auth.js
export const authMiddleware = async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다.' }
    }, 401);
  }

  let token = authHeader.replace('Bearer ', '');
  token = token.replace('API_KEY=', '');  // Swagger UI 호환

  if (token !== c.env.API_KEY) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: '유효하지 않은 API 키입니다.' }
    }, 401);
  }

  await next();
};
```

### 6.3 에러 처리 패턴

**표준 에러 응답 형식**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "사용자에게 보여줄 메시지",
    "detail": "개발자용 상세 정보 (선택)"
  }
}
```

**에러 코드 목록**:

| 코드 | HTTP Status | 설명 |
|------|-------------|------|
| `VALIDATION_ERROR` | 400 | 입력값 검증 실패 |
| `UNAUTHORIZED` | 401 | 인증 실패 |
| `NOT_FOUND` | 404 | 리소스 없음 |
| `AI_ERROR` | 500 | AI 모델 호출 실패 |
| `FILE_TOO_LARGE` | 400 | 파일 크기 초과 |
| `UNSUPPORTED_FILE_TYPE` | 400 | 지원하지 않는 파일 형식 |
| `INTERNAL_ERROR` | 500 | 서버 내부 오류 |

**SSE 스트리밍 에러**:
```
event: error
data: {"message": "AI 모델 호출 중 오류가 발생했습니다."}
```

### 6.4 서비스 계층 상세

#### ChatService — RAG 파이프라인 핵심

**서비스 초기화** (Workers 바인딩 주입):
```javascript
class ChatService {
  constructor(env, settings = {}) {
    this.db = env.DB;                              // D1
    this.ai = env.AI;                              // Workers AI
    this.vectorize = env.VECTORIZE;                // Vectorize
    this.embeddingService = new EmbeddingService(env);
    this.quizService = new QuizService(env);

    // 세션별 AI 설정
    this.persona = settings.persona || '당신은 친절하고 전문적인 AI 튜터입니다...';
    this.temperature = settings.temperature ?? 0.3;
    this.topP = settings.topP ?? 0.3;
    this.maxTokens = settings.maxTokens ?? 1024;
  }
}
```

**핵심 메서드 상세**:

| 메서드 | 역할 | 입력 | 출력 |
|--------|------|------|------|
| `chat()` | 동기 RAG 파이프라인 | message, sessionId, settings | { response, sources, sessionId } |
| `prepareChatContext()` | SSE용 컨텍스트 준비 | message, sessionId, settings | { messages[], metadata } |
| `getSessionContentIdsAndParent()` | 세션 콘텐츠 ID 조회 | sessionId | { contentIds[], effectiveSessionId } |
| `getSessionLearningData()` | 학습 메타데이터 조회 | sessionId | { learningGoal, learningSummary, recommendedQuestions } |
| `searchSimilarDocuments()` | 벡터 유사도 검색 | embedding, topK, contentIds | [{ score, type, contentId, text }] |
| `buildSystemPrompt()` | XML 시스템 프롬프트 조립 | { context, learning*, quizContext } | string |
| `getChatHistory()` | 채팅 히스토리 조회 | sessionId, limit | [{ role, content }] |
| `getQuizContext()` | 퀴즈 정답 컨텍스트 | contentIds | string |
| `saveMessagesToDB()` | 메시지 DB 저장 | sessionId, userMsg, assistantMsg | void |

**시스템 프롬프트 구조** (`buildSystemPrompt()`):
```xml
<role>
{페르소나 텍스트}
</role>

<learning_context>
학습 목표: {learning_goal}

핵심 요약:
1. {summary_1}
2. {summary_2}
3. {summary_3}

추천 질문 (학습자가 이런 질문을 할 수 있음):
- Q: {question_1}
  A: {answer_1}
- Q: {question_2}
  A: {answer_2}
</learning_context>

<rules>
1. 반드시 <reference_documents>의 내용만을 기반으로 답변하세요.
2. 문서에 없는 내용은 "학습 자료에 해당 내용이 없습니다"라고 답변하세요.
3. 가능한 한 구체적으로, 문서의 핵심 내용을 인용하여 답변하세요.
4. <learning_context>가 있으면 학습 목표에 맞는 방향으로 답변하세요.
5. 추천 질문과 유사한 질문이 오면 해당 맥락을 활용하세요.
6. 한국어로 답변하세요.
7. 마크다운 형식으로 답변하세요.
8. 답변은 간결하되, 충분한 설명을 포함하세요.
9. <quiz_info>가 있을 때 퀴즈 관련 질문에 참고하세요.
</rules>

<output_format>
- 핵심 내용은 **굵게** 강조
- 번호/불릿 목록 사용
- 복잡한 개념은 단계별 설명
- 짧고 명확한 문장
</output_format>

<reference_documents>
{RAG 벡터 검색 결과 문서들}
</reference_documents>

<quiz_info>
[4지선다] Q: ... → 정답: 2 (해설: ...)
[OX퀴즈] Q: ... → 정답: O (해설: ...)
</quiz_info>
```

#### ContentService — 콘텐츠 처리

**텍스트 추출 파이프라인**:
```
입력 파일
    │
    ├── PDF → pdf-parse 라이브러리 → 텍스트 추출
    ├── TXT/MD → 그대로 사용
    ├── SRT → 타임스탬프·번호 제거, 자막 텍스트만 추출
    ├── VTT → WEBVTT 헤더·타임스탬프·메타데이터 제거
    └── 링크 → HTTP 요청 → HTML/문서 → 텍스트 추출
         ├── HTML → 태그 제거, 엔티티 디코딩
         ├── PDF/DOCX/PPTX → 문서 텍스트 추출
         └── SRT/VTT → 자막 추출
    │
    ▼
DB 저장 (TB_CONTENT.content)
    │
    ▼
청크 분할 (500자, 100자 오버랩, 문장 경계)
    │
    ▼
각 청크 → 768차원 벡터 임베딩
    │
    ▼
Vectorize 저장 (ID: content-{id}-chunk-{index})
```

**자막 추출 로직** (`extractTextFromSubtitle()`):
```javascript
extractTextFromSubtitle(subtitleText) {
  return subtitleText
    .replace(/^WEBVTT[\s\S]*?\n\n/, '')          // VTT 헤더 제거
    .replace(/^\d+\s*\n/gm, '')                   // SRT 번호 제거
    .replace(/\d{2}:\d{2}[\d:.,→\->]+.*\n/g, '') // 타임스탬프 제거
    .replace(/align:.*|position:.*|line:.*/g, '') // VTT 메타데이터 제거
    .replace(/<[^>]+>/g, '')                       // HTML 태그 제거
    .replace(/\{[^}]+\}/g, '')                     // SSA 스타일 제거
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}
```

#### EmbeddingService — 벡터 변환

```javascript
class EmbeddingService {
  constructor(env) {
    this.ai = env.AI;
  }

  // 텍스트 → 768차원 벡터
  async embed(text) {
    const result = await this.ai.run('@cf/baai/bge-base-en-v1.5', {
      text: [text]
    });
    return result.data[0];   // number[768]
  }

  // 텍스트 청크 분할
  splitIntoChunks(text, maxChars = 500, overlap = 100) {
    if (text.length <= maxChars) {
      return [{ text, offset: 0 }];
    }

    const chunks = [];
    const sentences = text.split(/([.?!。\n])/);

    let currentChunk = '';
    let offset = 0;

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxChars && currentChunk.length > 0) {
        chunks.push({ text: currentChunk.trim(), offset });
        // 오버랩: 마지막 overlap 글자를 다음 청크의 시작으로
        const overlapText = currentChunk.slice(-overlap);
        offset += currentChunk.length - overlap;
        currentChunk = overlapText + sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({ text: currentChunk.trim(), offset });
    }

    return chunks;
  }
}
```

#### LearningService — 학습 메타데이터 생성

**생성 흐름**:
```
세션 생성 (POST /sessions)
    │
    ▼
[executionCtx.waitUntil()]  ← 응답 반환 후 백그라운드 실행
    │
    ▼
generateAndStoreLearningData(sessionId, contentIds, settings)
    │
    ├── getContentContext(contentIds)
    │   └── 전체 콘텐츠 텍스트 조합 (최대 32,000자)
    │
    ├── generateLearningData(context, titles, settings)
    │   └── Llama 3.1 70B 호출 → JSON 파싱
    │       {
    │         title: "세션 제목",
    │         learningGoal: "학습 목표",
    │         learningSummary: ["요약1", "요약2", "요약3"],
    │         recommendedQuestions: [
    │           { question: "질문1", answer: "답변1" },
    │           { question: "질문2", answer: "답변2" }
    │         ]
    │       }
    │
    ├── [답변 누락 시] generateAnswersForQuestions()
    │   └── 2차 LLM 호출로 답변 보충
    │
    ├── saveLearningDataToDB(sessionId, data)
    │   └── TB_SESSION UPDATE (session_nm, learning_goal, learning_summary, recommended_questions)
    │
    └── storeLearningEmbeddings(sessionId, data, contentIds)
        ├── session-{id}-goal → Vectorize
        └── session-{id}-summary-{i} → Vectorize
```

**LLM 호출 파라미터**:
```javascript
{
  model: '@cf/meta/llama-3.1-70b-instruct',
  messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
  max_tokens: 1024,
  temperature: 0.2     // 학습 데이터는 보수적으로
}
```

#### QuizService — 퀴즈 생성

**퀴즈 생성 흐름**:
```
세션 생성 시 (백그라운드)
    │
    ▼
각 콘텐츠별 generateQuizzesForContent()
    │
    ├── [병렬] generateChoiceQuizzes(context, choiceCount, difficulty)
    │   └── Llama 3.1 70B → JSON 배열
    │       [{ question, options[4], answer(1-4), explanation }]
    │
    └── [병렬] generateOXQuizzes(context, oxCount, difficulty)
        └── Llama 3.1 70B → JSON 배열
            [{ statement, answer(O/X), explanation }]
    │
    ▼
saveQuizzesForContent(contentId, quizzes)
    └── TB_QUIZ에 position 순서대로 INSERT
```

**난이도별 프롬프트**:
```javascript
getDifficultyInstruction(difficulty) {
  switch (difficulty) {
    case 'easy':
      return '단순 기억/회상 수준의 쉬운 문제를 생성하세요. 텍스트에서 직접 찾을 수 있는 사실 확인 문제입니다.';
    case 'normal':
      return '이해/적용 수준의 보통 난이도 문제를 생성하세요. 개념을 이해하고 있는지 확인하는 문제입니다.';
    case 'hard':
      return '분석/적용 수준의 어려운 문제를 생성하세요. 여러 개념을 연결하거나 새로운 상황에 적용하는 문제입니다.';
  }
}
```

**LLM 호출 파라미터**:
```javascript
{
  model: '@cf/meta/llama-3.1-70b-instruct',
  max_tokens: 2048,
  temperature: 0.7     // 퀴즈는 다양성을 위해 높게
}
```

---

## 7. 데이터베이스

### 7.1 ER 다이어그램

```
TB_CONTENT                         TB_SESSION
┌────────────────────┐             ┌─────────────────────────────┐
│ id (PK)            │             │ id (PK)                     │
│ content_nm         │             │ parent_id (0=부모, >0=자식)  │
│ filename           │             │ session_nm                  │
│ file_type          │             │ persona                     │
│ file_size          │             │ temperature, top_p          │
│ content            │             │ max_tokens                  │
│ lesson_id          │             │ summary_count, recommend_count│
│ status             │             │ choice_count, ox_count      │
│ created_at         │             │ quiz_difficulty              │
│ updated_at         │             │ learning_goal               │
└────────┬───────────┘             │ learning_summary (JSON)     │
         │                         │ recommended_questions (JSON) │
         │  N:M                    │ course_id, course_user_id   │
         │                         │ lesson_id, user_id          │
    ┌────┴──────────┐              │ status                      │
    │TB_SESSION_    │              │ created_at, updated_at      │
    │   CONTENT     │              └──────────┬──────────────────┘
    ├───────────────┤                         │
    │ session_id(FK)├─────────────────────────┘
    │ content_id(FK)│                         │ 1:N
    │ status        │                         │
    └───────────────┘              ┌──────────┴──────────┐
                                   │    TB_MESSAGE        │
TB_QUIZ                            ├─────────────────────┤
┌────────────────────┐             │ id (PK)             │
│ id (PK)            │             │ session_id (FK)     │
│ content_id (FK) ───┼── FK ──┐   │ user_id             │
│ quiz_type          │        │   │ role (user/assistant)│
│ question           │        │   │ content              │
│ options (JSON)     │        │   │ status               │
│ answer             │        │   │ created_at           │
│ explanation        │        │   └─────────────────────┘
│ position           │        │
│ status             │        │
│ created_at         │        │
└────────────────────┘        │
         ▲                    │
         └────────────────────┘
```

### 7.2 테이블 상세

#### TB_CONTENT — 학습 자료

```sql
CREATE TABLE TB_CONTENT (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_nm TEXT NOT NULL,           -- 제목 (사용자 입력 또는 파일명)
  filename TEXT,                       -- 원본 파일명 또는 URL
  file_type TEXT NOT NULL,             -- 'text' | 'pdf' | 'txt' | 'md' | 'srt' | 'vtt' | 'link'
  file_size INTEGER DEFAULT 0,         -- 바이트 단위
  content TEXT,                        -- 추출된 전문 텍스트
  lesson_id INTEGER,                   -- LMS 차시 ID (선택)
  status INTEGER DEFAULT 1,            -- 1=활성, 0=중지, -1=삭제
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### TB_SESSION — 채팅 세션

```sql
CREATE TABLE TB_SESSION (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER DEFAULT 0,         -- 0=부모(교수자), >0=자식(학습자)
  course_id INTEGER,                   -- LMS 코스 ID
  course_user_id INTEGER,              -- LMS 수강생 ID
  lesson_id INTEGER,                   -- LMS 레슨 ID
  user_id INTEGER,                     -- 사용자 ID
  session_nm TEXT,                     -- AI 생성 제목
  persona TEXT,                        -- AI 시스템 프롬프트
  temperature REAL DEFAULT 0.3,
  top_p REAL DEFAULT 0.3,
  max_tokens INTEGER DEFAULT 1024,
  summary_count INTEGER DEFAULT 3,
  recommend_count INTEGER DEFAULT 3,
  choice_count INTEGER DEFAULT 3,
  ox_count INTEGER DEFAULT 2,
  quiz_difficulty TEXT DEFAULT 'normal',
  learning_goal TEXT,                  -- AI 생성 학습 목표
  learning_summary TEXT,               -- JSON: ["요약1", "요약2", ...]
  recommended_questions TEXT,           -- JSON: [{"question":"Q", "answer":"A"}, ...]
  status INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### TB_MESSAGE — 채팅 메시지

```sql
CREATE TABLE TB_MESSAGE (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  user_id INTEGER,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  status INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES TB_SESSION(id)
);
```

#### TB_SESSION_CONTENT — 세션-콘텐츠 매핑

```sql
CREATE TABLE TB_SESSION_CONTENT (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  content_id INTEGER NOT NULL,
  status INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, content_id),
  FOREIGN KEY (session_id) REFERENCES TB_SESSION(id),
  FOREIGN KEY (content_id) REFERENCES TB_CONTENT(id)
);
```

#### TB_QUIZ — 퀴즈

```sql
CREATE TABLE TB_QUIZ (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL,
  quiz_type TEXT NOT NULL CHECK(quiz_type IN ('choice', 'ox')),
  question TEXT NOT NULL,
  options TEXT,                         -- JSON: ["선택1","선택2","선택3","선택4"] (choice만)
  answer TEXT NOT NULL,                -- '1'~'4' (choice) 또는 'O'/'X' (ox)
  explanation TEXT,
  position INTEGER DEFAULT 0,          -- 콘텐츠 내 순서
  status INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (content_id) REFERENCES TB_CONTENT(id)
);
```

### 7.3 인덱스 전략

```sql
-- 콘텐츠 조회 최적화
CREATE INDEX idx_content_created_at ON TB_CONTENT(created_at DESC);
CREATE INDEX idx_content_status ON TB_CONTENT(status);
CREATE INDEX idx_content_lesson_id ON TB_CONTENT(lesson_id);

-- 세션 조회 최적화
CREATE INDEX idx_session_status ON TB_SESSION(status);
CREATE INDEX idx_session_parent_id ON TB_SESSION(parent_id);
CREATE INDEX idx_session_parent_course_user ON TB_SESSION(parent_id, course_user_id);

-- 메시지 히스토리 조회 (가장 빈번한 쿼리)
CREATE INDEX idx_message_session ON TB_MESSAGE(session_id, created_at);
CREATE INDEX idx_message_status ON TB_MESSAGE(status);

-- 퀴즈 순서 조회
CREATE INDEX idx_quiz_content ON TB_QUIZ(content_id, position);
CREATE INDEX idx_quiz_status ON TB_QUIZ(status);
```

### 7.4 공통 패턴

**Soft Delete**: 모든 테이블에서 물리 삭제 대신 `status = -1`로 변경한다.

```sql
-- 삭제
UPDATE TB_CONTENT SET status = -1, updated_at = CURRENT_TIMESTAMP WHERE id = ?;

-- 조회 (항상 status 필터 포함)
SELECT * FROM TB_CONTENT WHERE status = 1 ORDER BY created_at DESC;
```

**JSON 컬럼**: `learning_summary`와 `recommended_questions`는 JSON 문자열로 저장한다.

```javascript
// 저장
await db.prepare('UPDATE TB_SESSION SET learning_summary = ? WHERE id = ?')
  .bind(JSON.stringify(["요약1", "요약2", "요약3"]), sessionId)
  .run();

// 조회 후 파싱
const session = await db.prepare('SELECT * FROM TB_SESSION WHERE id = ?').bind(id).first();
const summary = JSON.parse(session.learning_summary || '[]');
const questions = JSON.parse(session.recommended_questions || '[]');
```

---

## 8. RAG 파이프라인

### 8.1 데이터 인덱싱 (콘텐츠 등록 시)

```
콘텐츠 등록
    │
    ▼
[텍스트 추출]
    │ PDF → pdf-parse
    │ SRT/VTT → 자막 파싱
    │ Link → HTTP fetch → HTML 파싱
    │ Text → 그대로
    │
    ▼
[DB 저장]
    │ TB_CONTENT에 전문 텍스트 저장
    │
    ▼
[청크 분할] embeddingService.splitIntoChunks()
    │ maxChars: 500자
    │ overlap: 100자
    │ 분할 기준: 문장 경계 ([.?!。\n])
    │
    │ 예시:
    │ "인공지능은 컴퓨터 과학의 한 분야이다. 머신러닝은..."
    │ → Chunk 0: "인공지능은 컴퓨터 과학의 한 분야이다. 머신러닝은..." (500자)
    │ → Chunk 1: "...머신러닝은..." (이전 100자 + 새 400자)
    │
    ▼
[임베딩] embeddingService.embed()
    │ 모델: @cf/baai/bge-base-en-v1.5
    │ 출력: 768차원 벡터
    │
    ▼
[Vectorize 저장]
    ID: content-{contentId}-chunk-{index}
    Vector: [0.023, -0.156, 0.089, ...]  (768개)
    Metadata: {
      type: 'content',
      contentId: 5,
      contentTitle: "인공지능 개론",
      chunkIndex: 0,
      chunkCount: 12,
      text: "인공지능은 컴퓨터 과학의 한 분야이다..."  ← 원문 포함!
    }
```

### 8.2 질의 처리 (채팅 시)

```
사용자: "머신러닝이란 무엇인가요?"
    │
    ▼
[1단계: 질의 임베딩]
    │ embed("머신러닝이란 무엇인가요?") → [0.045, -0.123, ...]
    │
    ▼
[2단계: 벡터 유사도 검색]
    │ VECTORIZE.query({
    │   vector: [0.045, -0.123, ...],
    │   topK: 5,
    │   filter: { contentId: { $in: [1, 2, 3] } },  // 세션 연결 콘텐츠만
    │   returnMetadata: true
    │ })
    │
    │ 결과:
    │ ┌──────┬────────────────────────────────┬───────┐
    │ │ 순위 │ 텍스트                          │ 점수  │
    │ ├──────┼────────────────────────────────┼───────┤
    │ │ 1    │ "머신러닝은 데이터에서 패턴..."   │ 0.89  │
    │ │ 2    │ "지도학습과 비지도학습의 차이..." │ 0.78  │
    │ │ 3    │ "인공지능의 하위 분야로서..."    │ 0.72  │
    │ │ 4    │ "딥러닝은 머신러닝의 한 종류..." │ 0.65  │
    │ │ 5    │ "학습 데이터의 품질이 중요..."   │ 0.53  │
    │ └──────┴────────────────────────────────┴───────┘
    │
    │ ※ 임계값 0.5 이하는 제외
    │
    ▼
[3단계: 컨텍스트 구성]
    │ buildContext(searchResults) →
    │ "머신러닝은 데이터에서 패턴을 학습하는...
    │  ---
    │  지도학습과 비지도학습의 차이는...
    │  ---
    │  인공지능의 하위 분야로서..."
    │
    ▼
[4단계: LLM 호출]
    │ messages = [
    │   { role: 'system', content: buildSystemPrompt({context, learning*, quiz*}) },
    │   ...chatHistory,
    │   { role: 'user', content: "머신러닝이란 무엇인가요?" }
    │ ]
    │
    │ AI.run('@cf/meta/llama-3.1-8b-instruct', { messages, stream: true })
    │
    ▼
[5단계: 스트리밍 응답]
    SSE: event: token → "머신" → "러닝" → "은" → " 데이터" → ...
    SSE: event: done  → { sessionId: 42, sources: [...] }
```

### 8.3 Vectorize ID 규칙

| 타입 | ID 패턴 | 예시 |
|------|---------|------|
| 콘텐츠 청크 | `content-{contentId}-chunk-{index}` | `content-5-chunk-0` |
| 학습 목표 | `session-{sessionId}-goal` | `session-28-goal` |
| 핵심 요약 | `session-{sessionId}-summary-{index}` | `session-28-summary-0` |

### 8.4 Vectorize 검색 필터링

```javascript
searchSimilarDocuments(queryEmbedding, topK, allowedContentIds, sessionId) {
  // Vectorize 검색 후 필터링:
  // 1. 점수 임계값 0.5 이상만
  // 2. type='content' → allowedContentIds에 포함된 것만
  // 3. type='learning_goal' or 'learning_summary' → sessionId 일치만
  // 4. 그 외 type → 제외
}
```

---

## 9. 핵심 비즈니스 로직

### 9.1 부모-자식 세션 패턴

```
교수자가 세션 생성 (parent_id = 0)
    │
    ├── 콘텐츠 연결 (TB_SESSION_CONTENT)
    ├── AI 학습 메타데이터 생성 (learning_goal, learning_summary, recommended_questions)
    ├── 퀴즈 생성 (TB_QUIZ, 콘텐츠별)
    └── Vectorize 임베딩 저장
    │
    ▼
학습자 A가 LMS에서 위젯 접속
    │ parentSessionId: 28, courseUserId: 101
    │
    ▼
POST /sessions { parent_id: 28, course_user_id: 101 }
    │
    ├── 기존 자식 세션 확인:
    │   SELECT * FROM TB_SESSION
    │   WHERE parent_id = 28 AND course_user_id = 101 AND status = 1
    │
    ├── [있으면] 기존 자식 세션 + 메시지 히스토리 반환 (200)
    │
    └── [없으면] 새 자식 세션 생성 (201)
        ├── 부모의 AI 설정 복사 (persona, temperature, topP, maxTokens, counts)
        ├── course_id, lesson_id, user_id 저장
        ├── TB_SESSION_CONTENT 없음 (부모 것 공유)
        └── 학습 데이터 생성 없음 (부모 것 공유)
```

**자식 세션의 데이터 접근 패턴**:

| 데이터 | 접근 방식 |
|--------|-----------|
| 콘텐츠 (TB_SESSION_CONTENT) | 부모 세션 ID로 조회 |
| 학습 메타데이터 | 부모 세션의 learning_goal/summary/questions 사용 |
| 퀴즈 (TB_QUIZ) | 부모 세션의 콘텐츠 ID들로 조회 |
| 채팅 히스토리 (TB_MESSAGE) | **자기 자신**의 session_id로 조회 (독립) |
| Vectorize 임베딩 | 부모 세션 ID (effectiveSessionId)로 검색 |

### 9.2 세션 생성 시 백그라운드 작업

```javascript
// routes/sessions.js — POST /sessions
app.post('/', async (c) => {
  // 1. TB_SESSION INSERT (즉시)
  const session = await db.prepare('INSERT INTO TB_SESSION ...').run();

  // 2. TB_SESSION_CONTENT INSERT (즉시)
  for (const contentId of contentIds) {
    await db.prepare('INSERT INTO TB_SESSION_CONTENT ...').run();
  }

  // 3. 응답 즉시 반환
  return c.json({ success: true, data: session }, 201);

  // ★ 4. 백그라운드 작업 (응답 후 실행)
  c.executionCtx.waitUntil(async () => {
    // 학습 메타데이터 생성 (70B LLM, 5~15초 소요)
    await learningService.generateAndStoreLearningData(sessionId, contentIds, settings);

    // 퀴즈 생성 (70B LLM, 콘텐츠당 5~10초)
    for (const contentId of contentIds) {
      await quizService.generateQuizzesForContent(contentId, content, options);
    }
  });
});
```

> **핵심**: `executionCtx.waitUntil()`을 사용하면 HTTP 응답을 먼저 반환하고, Worker가 종료되지 않고 백그라운드 작업을 계속 실행한다. 학습자는 세션 생성 직후 채팅을 시작할 수 있고, 학습 데이터와 퀴즈는 백그라운드에서 생성된다.

### 9.3 콘텐츠 수정 시 재임베딩

```javascript
// contentService.updateContent()
async updateContent(id, title, newContent, lessonId) {
  const existing = await this.getContent(id);

  if (newContent && newContent !== existing.content) {
    // 1. 기존 Vectorize 청크 삭제
    await this.deleteContentChunks(id);

    // 2. DB 업데이트
    await this.db.prepare('UPDATE TB_CONTENT SET content = ?, ... WHERE id = ?')
      .bind(newContent, id).run();

    // 3. 새로운 청크 임베딩 생성
    await this.storeContentEmbedding(id, title, newContent);
  } else {
    // 텍스트 변경 없으면 DB만 업데이트
    await this.db.prepare('UPDATE TB_CONTENT SET content_nm = ?, ... WHERE id = ?')
      .bind(title, id).run();
  }
}
```

### 9.4 세션 삭제 시 연쇄 처리

```javascript
// 부모 세션 삭제 시
async deleteSession(sessionId) {
  // 1. 자식 세션 조회
  const children = await db.prepare(
    'SELECT id FROM TB_SESSION WHERE parent_id = ? AND status = 1'
  ).bind(sessionId).all();

  // 2. 자식 세션 및 메시지 soft delete
  for (const child of children.results) {
    await db.prepare('UPDATE TB_MESSAGE SET status = -1 WHERE session_id = ?')
      .bind(child.id).run();
    await db.prepare('UPDATE TB_SESSION SET status = -1 WHERE id = ?')
      .bind(child.id).run();
  }

  // 3. 부모 메시지, 세션-콘텐츠, 세션 soft delete
  await db.prepare('UPDATE TB_MESSAGE SET status = -1 WHERE session_id = ?')
    .bind(sessionId).run();
  await db.prepare('UPDATE TB_SESSION_CONTENT SET status = -1 WHERE session_id = ?')
    .bind(sessionId).run();
  await db.prepare('UPDATE TB_SESSION SET status = -1 WHERE id = ?')
    .bind(sessionId).run();

  // 4. Vectorize 학습 임베딩 삭제 (물리 삭제)
  await learningService.deleteLearningEmbeddings(sessionId);
}
```

---

## 10. 이벤트 시스템과 모듈 통신

### 10.1 이벤트 기반 아키텍처

대시보드 모듈들은 직접 참조 대신 **커스텀 이벤트**로 통신한다.

```
┌──────────┐   auth:required    ┌──────────┐
│  API     ├────────────────────▶  App     │ → API Key 입력 모달
└──────────┘                    └──────────┘

┌──────────┐   tenant:changed   ┌──────────┐
│ Tenants  ├────────────────────▶ Contents │ → 콘텐츠 목록 새로고침
│          ├────────────────────▶ Sessions │ → 세션 목록 새로고침
│          ├────────────────────▶ Chat     │ → 채팅 초기화
└──────────┘                    └──────────┘

┌──────────┐   contents:changed ┌──────────┐
│ Contents ├────────────────────▶ App      │ → 임베드 코드 업데이트
└──────────┘                    └──────────┘

┌──────────┐   settings:changed ┌──────────┐
│ Settings ├────────────────────▶ App      │ → 임베드 코드 업데이트
└──────────┘                    └──────────┘

┌──────────┐   mode:changed     ┌──────────┐
│ Settings ├────────────────────▶ App      │ → Layer ↔ Inline 전환
└──────────┘                    └──────────┘
```

### 10.2 이벤트 발행 패턴

```javascript
// 발행 (dispatch)
window.dispatchEvent(new CustomEvent('tenant:changed', {
  detail: { tenantId: 'cloud', apiUrl: 'https://...' }
}));

// 구독 (listen)
window.addEventListener('tenant:changed', (e) => {
  console.log('테넌트 변경됨:', e.detail.tenantId);
  Contents.loadContents();
  Sessions.loadSessions();
});
```

### 10.3 이벤트 목록

| 이벤트 | 발행자 | 구독자 | payload |
|--------|--------|--------|---------|
| `auth:required` | API | App | 없음 |
| `tenant:changed` | Tenants | Contents, Sessions, Chat, App | `{ tenantId, apiUrl }` |
| `contents:changed` | Contents | App | 없음 |
| `settings:changed` | Settings | App | 없음 |
| `mode:changed` | Settings | App | `{ mode: 'layer' \| 'inline' }` |
| `session:changed` | Sessions | App | `{ sessionId }` |

---

## 11. 임베드 위젯 개발

### 11.1 Shadow DOM 격리

임베드 위젯은 **Shadow DOM**을 사용하여 호스트 페이지의 CSS와 완전히 격리된다.

```javascript
// js/embed/ui.js
const UI = {
  inject(config) {
    // 1. 호스트 엘리먼트 생성
    const host = document.createElement('div');
    host.id = 'malgn-chatbot-host';
    document.body.appendChild(host);

    // 2. Shadow DOM 생성
    const shadow = host.attachShadow({ mode: 'open' });

    // 3. 스타일 주입 (chatbot.css 내용을 <style>로 삽입)
    const style = document.createElement('style');
    style.textContent = CHATBOT_CSS;   // esbuild가 인라인
    shadow.appendChild(style);

    // 4. Bootstrap Icons CDN
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons/font/bootstrap-icons.css';
    shadow.appendChild(link);

    // 5. 챗봇 HTML 구조 삽입
    const container = document.createElement('div');
    container.innerHTML = CHATBOT_HTML;
    shadow.appendChild(container);

    return shadow;  // 이후 모든 DOM 쿼리는 shadow 기준
  }
};
```

**왜 Shadow DOM인가?**
- LMS (Moodle, Canvas 등)는 자체 CSS가 복잡함
- 글로벌 CSS가 챗봇 UI를 망가뜨릴 수 있음
- 반대로 챗봇 CSS가 LMS UI를 망가뜨릴 수 있음
- Shadow DOM은 양방향 CSS 격리를 보장

### 11.2 위젯 초기화 흐름

```javascript
// js/embed/index.js
(function() {
  const cfg = window.MalgnTutor;
  if (!cfg || !cfg.apiUrl || !cfg.apiKey) return;

  // 1. API 클라이언트 생성
  const api = new Api(cfg.apiUrl, cfg.apiKey);

  // 2. Shadow DOM 주입
  const root = UI.inject(cfg);

  // 3. 매니저 초기화
  const tabManager = new TabManager(root);
  const quizManager = new QuizManager(api, root);
  const chatManager = new ChatManager(api, root);

  // 4. 콜백 연결
  chatManager.onSessionCreated = (session) => {
    tabManager.renderLearningData(session.learning);
    quizManager.loadQuizzes(session.id);
  };

  chatManager.onSessionLoaded = (session) => {
    tabManager.renderLearningData(session.learning);
    quizManager.loadQuizzes(session.id);
    if (cfg.welcomeMessage) {
      chatManager.addSystemMessage(cfg.welcomeMessage);
    }
  };

  tabManager.onQuestionClick = (question) => {
    chatManager.sendMessage(question);
  };

  // 5. 초기화
  tabManager.init();
  quizManager.init();
  chatManager.init();

  // 6. 기존 세션 로드 또는 대기
  if (cfg.parentSessionId) {
    // 자식 세션 자동 생성/로드
    chatManager.ensureSession();
  }
})();
```

### 11.3 Layer 모드 vs Inline 모드

**Layer 모드** (기본):
```
┌──────────────────────────────────────────┐
│                                          │
│              LMS 페이지                   │
│                                          │
│                     ┌──────────────────┐ │
│                     │  챗봇 팝업        │ │
│                     │  (fixed position) │ │
│                     │  z-index: 10000   │ │
│                     │                  │ │
│                     └──────────────────┘ │
│                              (FAB 버튼)  │
└──────────────────────────────────────────┘
```

**Inline 모드**:
```
┌──────────────────────────────────────────┐
│              LMS 페이지                   │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ <div id="malgn-chatbot-container">   ││
│  │   ┌────────────────────────────────┐ ││
│  │   │  챗봇 (100% 너비/높이)          │ ││
│  │   │  FAB 버튼 없음                  │ ││
│  │   │  항상 표시                      │ ││
│  │   └────────────────────────────────┘ ││
│  └──────────────────────────────────────┘│
└──────────────────────────────────────────┘
```

### 11.4 빌드 과정

```bash
# package.json
{
  "scripts": {
    "build": "node build.js"
  }
}

# build.js (esbuild 설정)
require('esbuild').buildSync({
  entryPoints: ['js/embed/index.js'],
  bundle: true,
  minify: true,
  format: 'iife',                    // 즉시 실행 함수
  outfile: 'js/chatbot-embed.js',
  loader: { '.css': 'text' },        // CSS를 문자열로 인라인
});
```

**빌드 결과**: `js/chatbot-embed.js` — 단일 파일, 외부 의존성 없음

### 11.5 위젯 설정 옵션

```javascript
window.MalgnTutor = {
  // 필수
  apiUrl: "https://malgn-chatbot-api.dotype.workers.dev",
  apiKey: "your-api-key",

  // 표시 설정
  mode: "layer",                  // "layer" (팝업) | "inline" (컨테이너)
  container: "#my-container",     // inline 모드 시 대상 요소
  title: "AI 튜터",              // 헤더 제목
  welcomeMessage: "안녕하세요!",  // 세션 시작 시 환영 메시지

  // 세션 설정
  parentSessionId: 28,            // 부모 세션 ID (자식 세션 자동 생성)
  contentIds: [1, 2, 3],          // 새 세션 시 연결할 콘텐츠 (parentSessionId 없을 때)

  // LMS 연동
  courseId: 100,                  // LMS 코스 ID
  courseUserId: 101,              // LMS 수강생 ID
  lessonId: 5,                   // LMS 레슨 ID
  userId: 42,                    // 사용자 ID

  // 외형
  width: 380,                    // 챗봇 너비 (layer 모드)
  height: 650,                   // 챗봇 높이 (layer 모드)

  // 동영상 연동
  videoIframeId: "lecture-video", // 비디오 iframe ID

  // AI 설정
  settings: {
    persona: "당신은 친절한 AI 튜터입니다...",
    temperature: 0.3,
    topP: 0.3,
    maxTokens: 1024,
    summaryCount: 3,
    recommendCount: 3,
    choiceCount: 3,
    oxCount: 2,
    quizDifficulty: "normal"     // "easy" | "normal" | "hard"
  }
};
```

---

## 12. 멀티테넌트 운영

### 12.1 테넌트 격리 구조

```
┌────────────────────────────────────────────────────┐
│                   wrangler.toml                     │
├───────────────┬─────────────────┬──────────────────┤
│   [env.dev]   │  [env.user1]    │  [env.cloud]     │
│   (로컬/개발)  │  (user1 운영)   │  (cloud 운영)    │
├───────────────┼─────────────────┼──────────────────┤
│ Hyperdrive:   │ Hyperdrive:     │ Hyperdrive:      │
│  MySQL(공유)  │  MySQL(공유)    │  MySQL(전용)     │
├───────────────┼─────────────────┼──────────────────┤
│ KV: chatbot   │ KV: chatbot     │ KV: chatbot      │
│  (공유)       │  (dev와 공유)    │     -cloud       │
├───────────────┼─────────────────┼──────────────────┤
│ Vectorize:    │ Vectorize:      │ Vectorize:       │
│  chatbot-vecs │  chatbot-vecs   │  chatbot-vecs    │
│  (공유)       │  (dev와 공유)    │     -cloud       │
├───────────────┼─────────────────┼──────────────────┤
│ R2: chatbot   │ R2: chatbot     │ R2: chatbot      │
│  -files       │  -files         │  -files-cloud    │
└───────────────┴─────────────────┴──────────────────┘

* site_id: 한 테넌트 DB 안에서 호스트 솔루션을 분리하기 위한
  런타임 헤더 (X-Site-Id, 기본 1). 같은 MySQL을 여러 호스트가
  공유할 때 데이터 격리에 사용.
```

### 12.2 테넌트 추가 절차

```bash
# 1. Cloudflare 리소스 생성
wrangler d1 create malgn-chatbot-db-newtenant
wrangler kv:namespace create malgn-chatbot-kv-newtenant
# Vectorize는 대시보드에서 생성 (768차원, cosine)

# 2. wrangler.toml에 환경 추가
[env.newtenant]
name = "malgn-chatbot-api-newtenant"
vars = { ENVIRONMENT = "production", TENANT_ID = "newtenant" }
[[env.newtenant.d1_databases]]
binding = "DB"
database_name = "malgn-chatbot-db-newtenant"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
# ... KV, Vectorize, R2, AI 바인딩

# 3. 스키마 적용
wrangler d1 execute malgn-chatbot-db-newtenant --file=./schema.sql --env newtenant

# 4. 마이그레이션 적용 (순차)
wrangler d1 execute malgn-chatbot-db-newtenant --file=./migrations/001_quiz_content_based.sql --env newtenant
# ... 005까지

# 5. 시크릿 설정
wrangler secret put API_KEY --env newtenant

# 6. 배포
wrangler deploy --env newtenant

# 7. 프론트엔드 테넌트 등록 (js/tenants.js)
# tenants 배열에 새 테넌트 추가
```

### 12.3 프론트엔드 테넌트 설정

```javascript
// js/tenants.js
const tenants = [
  {
    id: 'default',
    name: '기본',
    apiUrl: 'https://malgn-chatbot-api.dotype.workers.dev',
    apiKey: 'xxx'
  },
  {
    id: 'cloud',
    name: 'Cloud',
    apiUrl: 'https://malgn-chatbot-api-cloud.dotype.workers.dev',
    apiKey: 'yyy'
  }
];
```

---

## 13. 빌드와 배포

### 13.1 빌드 커맨드 요약

```bash
# 프론트엔드 임베드 위젯 빌드
cd malgn-chatbot
npm run build
# → js/chatbot-embed.js 생성

# API 로컬 개발
cd malgn-chatbot-api
wrangler dev
# → localhost:8787

# API 배포
wrangler deploy                    # dev 환경
wrangler deploy --env user1        # user1 환경
wrangler deploy --env cloud        # cloud 환경

# 프론트엔드 배포 (Cloudflare Pages)
cd malgn-chatbot
wrangler pages deploy . --project-name=malgn-chatbot --commit-dirty=true --commit-message="deploy"

# 테넌트별 프론트엔드 배포
cd malgn-chatbot-user1
wrangler pages deploy . --project-name=malgn-chatbot-user1 --commit-dirty=true --commit-message="deploy"
```

### 13.2 배포 순서 (기능 변경 시)

```
1. DB 마이그레이션 (있는 경우)
   └── wrangler d1 execute ... --file=./migrations/xxx.sql
   └── 모든 테넌트에 적용

2. API 배포
   └── wrangler deploy --env user1
   └── wrangler deploy --env cloud

3. 프론트엔드 빌드
   └── cd malgn-chatbot && npm run build

4. 프론트엔드 배포
   └── wrangler pages deploy ...
   └── 테넌트별 배포본도 업데이트
```

### 13.3 D1 마이그레이션

```bash
# 로컬 적용
wrangler d1 execute malgn-chatbot-db --local --file=./migrations/005_session_quiz_difficulty.sql

# 운영 적용 (dev/user1 공유 D1 — 점진적으로 MySQL 전환 중)
wrangler d1 execute malgn-chatbot-db --file=./migrations/005_session_quiz_difficulty.sql

# cloud 전용 MySQL — Hyperdrive 통해 직접 SQL 실행
mysql -h <HOST> -u <USER> -p <DATABASE> < ./schema.mysql.sql
# (또는 개별 마이그레이션 SQL을 mysql 클라이언트로 적용)
```

### 13.4 한국어 커밋 메시지 이슈

Cloudflare Pages는 한국어 커밋 메시지에서 배포 오류가 발생할 수 있다.

```bash
# ❌ 실패할 수 있음
git commit -m "퀴즈 난이도 기능 추가"
wrangler pages deploy .

# ✅ 해결: 영문 메시지 지정
wrangler pages deploy . --commit-dirty=true --commit-message="deploy"
```

---

## 14. 디버깅과 트러블슈팅

### 14.1 로컬 개발 디버깅

**API 로그 확인**:
```bash
wrangler dev
# 콘솔에 요청/응답 로그 출력
# [PERF] 마커로 성능 측정 포인트 확인
```

**D1 데이터 확인**:
```bash
# 로컬 DB 쿼리
wrangler d1 execute malgn-chatbot-db --local --command="SELECT * FROM TB_SESSION WHERE status = 1"

# 운영 DB 쿼리
wrangler d1 execute malgn-chatbot-db --command="SELECT * FROM TB_SESSION WHERE status = 1 LIMIT 10"
```

**Vectorize 상태 확인**:
```bash
# 로컬에서는 Vectorize 사용 불가 → 폴백 로직 작동
# 운영에서 Vectorize 오류 시 getSessionLearningContext()로 폴백
```

### 14.2 일반적인 문제와 해결

#### 문제: "학습된 정보가 없습니다" 응답

```
원인: Vectorize 검색 결과가 0건
확인:
1. 콘텐츠가 등록되어 있는가?
2. 콘텐츠의 임베딩이 Vectorize에 저장되어 있는가?
3. 세션에 콘텐츠가 연결되어 있는가? (TB_SESSION_CONTENT)
4. 자식 세션이면 부모의 콘텐츠가 유효한가?

해결:
- POST /contents/reembed 호출하여 전체 재임베딩
- 콘텐츠 삭제 후 재등록
```

#### 문제: 퀴즈가 생성되지 않음

```
원인: 백그라운드 작업 실패 (LLM 응답 파싱 오류)
확인:
1. 콘텐츠 텍스트가 100자 이상인가?
2. Workers AI 호출이 정상인가? (AI Gateway 대시보드 확인)

해결:
- POST /sessions/:id/quizzes 호출하여 퀴즈 재생성
- POST /contents/:id/quizzes 호출하여 콘텐츠별 재생성
```

#### 문제: SSE 스트리밍이 끊김

```
원인: Cloudflare Workers 30초 CPU 타임아웃
확인:
1. 컨텍스트가 너무 큰가? (system prompt 토큰 수)
2. max_tokens 설정이 높은가?

해결:
- max_tokens를 1024 이하로 조정
- 콘텐츠 수를 줄이거나 청크 크기 조정
```

#### 문제: 자식 세션 중복 생성

```
원인: parent_id + course_user_id 조합 중복 체크 실패
확인:
1. course_user_id가 올바르게 전달되는가?
2. lesson_id 조건이 포함되는가?

해결:
- TB_SESSION 인덱스 확인: idx_session_parent_course_user
- 중복 자식 세션 수동 삭제 (soft delete)
```

### 14.3 성능 모니터링 포인트

```javascript
// chatService.prepareChatContext()에서 [PERF] 로그 출력
console.log('[PERF] Stage 1 (embed + content lookup):', Date.now() - start, 'ms');
console.log('[PERF] Stage 2 (vector search + history):', Date.now() - start, 'ms');
console.log('[PERF] Total context preparation:', Date.now() - start, 'ms');
```

**일반적인 소요 시간**:

| 단계 | 소요 시간 |
|------|-----------|
| 임베딩 (bge-base-en-v1.5) | 100~300ms |
| Vectorize 검색 | 20~50ms |
| D1 쿼리 (각각) | 5~10ms |
| 컨텍스트 준비 전체 | 150~400ms |
| LLM 첫 토큰 (8B) | 500~1000ms |
| LLM 전체 응답 (8B) | 2~5초 |
| LLM 학습데이터 생성 (70B) | 5~15초 |
| LLM 퀴즈 생성 (70B) | 5~10초/콘텐츠 |

---

## 15. 코딩 규칙과 컨벤션

### 15.1 필수 규칙

| # | 규칙 | 이유 |
|---|------|------|
| 1 | 프레임워크(React, Vue 등) 도입 금지 | 순수 JS 유지, LMS 임베드 호환성 |
| 2 | DB 물리 삭제 금지 | `status = -1` soft delete 사용 |
| 3 | 모든 SELECT에 `WHERE status = 1` 포함 | soft delete된 데이터 제외 |
| 4 | 하드코딩 API URL 금지 | `window.MalgnTutor.apiUrl` 사용 |
| 5 | 시스템 프롬프트 하드코딩 금지 | `buildSystemPrompt()` 사용 |
| 6 | LLM 호출 동기 대기 금지 | `waitUntil()`로 비동기 처리 |
| 7 | `wrangler.toml`에 시크릿 금지 | `wrangler secret put` 사용 |
| 8 | Vectorize 의존 학습데이터 조회 금지 | DB 직접 조회 사용 |

### 15.2 네이밍 컨벤션

```javascript
// 파일명: kebab-case
chatService.js, quiz-manager.js

// 클래스: PascalCase
class ChatManager { }
class QuizService { }

// 싱글톤 모듈: PascalCase
const Settings = { init() {} };
const Contents = { init() {} };

// 메서드/변수: camelCase
async sendMessage(text) { }
const selectedContentIds = new Set();

// 상수: UPPER_SNAKE_CASE
const MAX_CONTEXT_LENGTH = 32000;
const DEFAULT_TEMPERATURE = 0.3;

// DB 테이블: TB_ 접두사 + UPPER_SNAKE_CASE
TB_SESSION, TB_CONTENT, TB_MESSAGE

// DB 컬럼: snake_case
parent_id, course_user_id, learning_goal

// Vectorize ID: kebab-case
content-5-chunk-0, session-28-goal

// 이벤트명: namespace:action
'tenant:changed', 'contents:changed', 'auth:required'
```

### 15.3 코드 패턴

**병렬 처리 (필수)**:
```javascript
// ✅ 독립적 작업은 병렬로
const [contents, embedding, learning] = await Promise.all([
  getContents(sessionId),
  embedText(message),
  getLearningData(sessionId)
]);

// ❌ 순차 실행 금지 (불필요한 지연)
const contents = await getContents(sessionId);
const embedding = await embedText(message);
const learning = await getLearningData(sessionId);
```

**에러 응답 형식**:
```javascript
// ✅ 표준 형식
return c.json({
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: '메시지는 필수입니다.',
    detail: 'message field is required'
  }
}, 400);
```

**localStorage 사용**:
```javascript
// ✅ 키 네이밍
localStorage.setItem('ai_tutor_settings', JSON.stringify(settings));
localStorage.setItem('selected_tenant', tenantId);
localStorage.setItem('selectedContents', JSON.stringify([...ids]));
localStorage.setItem('api_key', apiKey);
```

### 15.4 CSS 테마 변수

```css
/* 대시보드 */
--flat-bg: #f5f7fa;
--flat-card: #ffffff;
--flat-primary: #5a67d8;
--flat-text: #2d3748;

/* 챗봇 위젯 */
--chatbot-primary: #7C3AED;     /* 메인 퍼플 */
--chatbot-secondary: #6D28D9;   /* 다크 퍼플 */
--chatbot-accent: #8B5CF6;      /* 라이트 퍼플 */
--chatbot-user-bg: #1F2937;     /* 사용자 메시지 배경 */
--chatbot-text: #1F2937;
--chatbot-border: #E5E7EB;
```

---

## 16. API 레퍼런스

### 16.1 인증

모든 API 요청에 Bearer 토큰이 필요하다 (`/health`, `/docs` 제외).

```
Authorization: Bearer YOUR_API_KEY
```

### 16.2 채팅 API

#### POST /chat — 동기 채팅

```bash
curl -X POST https://api.example.com/chat \
  -H "Authorization: Bearer KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "머신러닝이란?",
    "sessionId": 42,
    "settings": {
      "persona": "AI 튜터",
      "temperature": 0.3,
      "topP": 0.3,
      "maxTokens": 1024
    }
  }'
```

**응답**:
```json
{
  "success": true,
  "data": {
    "response": "머신러닝은 데이터에서 패턴을 학습하는...",
    "sources": [
      { "contentId": 5, "title": "AI 개론", "score": 0.89 }
    ],
    "sessionId": 42
  }
}
```

#### POST /chat/stream — SSE 스트리밍

요청은 동일하며, 응답이 SSE 형식이다.

```
event: token
data: {"response": "머신"}

event: token
data: {"response": "러닝은"}

event: token
data: {"response": " 데이터에서"}

...

event: done
data: {"sessionId": 42, "sources": [...]}
```

### 16.3 세션 API

#### GET /sessions — 세션 목록

```
GET /sessions?page=1&limit=20
```

```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": 42,
        "title": "인공지능 기초",
        "lastMessage": "머신러닝에 대해 알려주세요...",
        "messageCount": 12,
        "created_at": "2026-03-18T10:00:00Z",
        "updated_at": "2026-03-18T11:30:00Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
  }
}
```

#### POST /sessions — 세션 생성

**부모 세션 (교수자)**:
```json
{
  "content_ids": [1, 2, 3],
  "settings": {
    "persona": "AI 튜터",
    "temperature": 0.3,
    "topP": 0.3,
    "maxTokens": 1024,
    "summaryCount": 3,
    "recommendCount": 3,
    "choiceCount": 3,
    "oxCount": 2,
    "quizDifficulty": "normal"
  }
}
```

**자식 세션 (학습자)**:
```json
{
  "parent_id": 28,
  "course_user_id": 101,
  "course_id": 10,
  "lesson_id": 5,
  "user_id": 42
}
```

#### GET /sessions/:id — 세션 상세

```json
{
  "success": true,
  "data": {
    "id": 42,
    "parentId": 0,
    "title": "인공지능 기초",
    "settings": {
      "persona": "...",
      "temperature": 0.3,
      "topP": 0.3,
      "maxTokens": 1024
    },
    "learning": {
      "goal": "인공지능의 기본 개념을 이해한다",
      "summary": ["요약1", "요약2", "요약3"],
      "recommendedQuestions": [
        { "question": "머신러닝이란?", "answer": "머신러닝은..." }
      ]
    },
    "contents": [
      { "id": 1, "title": "AI 개론", "fileType": "pdf" }
    ],
    "messages": [
      { "id": 100, "role": "user", "content": "안녕하세요", "created_at": "..." },
      { "id": 101, "role": "assistant", "content": "안녕하세요! 무엇을...", "created_at": "..." }
    ],
    "messageCount": 2
  }
}
```

#### PUT /sessions/:id — 세션 설정 수정

```json
{
  "settings": {
    "temperature": 0.5,
    "maxTokens": 2048,
    "quizDifficulty": "hard"
  }
}
```

#### DELETE /sessions/:id — 세션 삭제

```json
{ "success": true, "message": "세션이 삭제되었습니다." }
```

#### GET /sessions/:id/quizzes — 퀴즈 조회

```json
{
  "success": true,
  "data": {
    "quizzes": [
      {
        "id": 1,
        "quizType": "choice",
        "question": "인공지능의 하위 분야가 아닌 것은?",
        "options": ["머신러닝", "딥러닝", "블록체인", "자연어처리"],
        "answer": "3",
        "explanation": "블록체인은 분산원장 기술로...",
        "position": 0
      },
      {
        "id": 2,
        "quizType": "ox",
        "question": "딥러닝은 머신러닝의 한 종류이다.",
        "options": null,
        "answer": "O",
        "explanation": "딥러닝은 인공 신경망을 기반으로...",
        "position": 1
      }
    ],
    "total": 5
  }
}
```

#### POST /sessions/:id/quizzes — 퀴즈 재생성

```json
{
  "choiceCount": 5,
  "oxCount": 3
}
```

### 16.4 콘텐츠 API

#### GET /contents — 콘텐츠 목록

```
GET /contents?page=1&limit=20&lesson_id=5&file_type=pdf
```

#### POST /contents — 콘텐츠 등록

**텍스트**:
```json
{
  "type": "text",
  "title": "강의 노트",
  "content": "인공지능은 컴퓨터 과학의 한 분야로서... (50자 이상)",
  "lesson_id": 5
}
```

**링크**:
```json
{
  "type": "link",
  "title": "참고 자료",
  "url": "https://example.com/article",
  "lesson_id": 5
}
```

**파일** (multipart/form-data):
```bash
curl -X POST https://api.example.com/contents \
  -H "Authorization: Bearer KEY" \
  -F "file=@lecture.pdf" \
  -F "title=강의자료" \
  -F "lesson_id=5"
```

#### GET /contents/:id — 콘텐츠 상세

전문 텍스트 포함.

#### PUT /contents/:id — 콘텐츠 수정

```json
{
  "title": "수정된 제목",
  "content": "수정된 내용...",
  "lesson_id": 5
}
```

#### DELETE /contents/:id — 콘텐츠 삭제

Soft delete + Vectorize 청크 삭제.

#### POST /contents/reembed — 전체 재임베딩

Vectorize 인덱스 재생성 후 사용.

#### POST /contents/regenerate-all-quizzes — 전체 퀴즈 재생성

퀴즈가 없는 콘텐츠에 대해 일괄 생성.

---

## 부록: 용어 사전

| 용어 | 설명 |
|------|------|
| RAG | Retrieval-Augmented Generation. 검색 기반 생성형 AI |
| 벡터 임베딩 | 텍스트를 수치 벡터(768차원)로 변환한 것 |
| Vectorize | Cloudflare의 벡터 데이터베이스 서비스 |
| D1 | Cloudflare의 SQLite 기반 서버리스 데이터베이스 |
| KV | Cloudflare의 Key-Value 스토리지 |
| R2 | Cloudflare의 오브젝트 스토리지 (S3 호환) |
| Workers | Cloudflare의 서버리스 컴퓨팅 플랫폼 |
| Pages | Cloudflare의 정적 사이트 호스팅 |
| AI Gateway | Cloudflare의 AI 모델 프록시 (캐싱, 로깅) |
| Hono | 경량 웹 프레임워크 (Express 대안, Edge 최적화) |
| Shadow DOM | 웹 컴포넌트의 DOM/CSS 격리 기술 |
| IIFE | Immediately Invoked Function Expression. 즉시 실행 함수 |
| SSE | Server-Sent Events. 서버→클라이언트 단방향 스트리밍 |
| FAB | Floating Action Button. 화면 위에 떠 있는 둥근 버튼 |
| Soft Delete | 물리 삭제 대신 status 플래그로 논리 삭제 |
| 부모 세션 | 교수자가 생성한 기본 세션 (parent_id = 0) |
| 자식 세션 | 학습자별 개별 세션 (parent_id = 부모ID) |
| 페르소나 | AI의 역할/성격을 정의하는 시스템 프롬프트 |
| 환각 (Hallucination) | AI가 근거 없는 내용을 생성하는 현상 |
| 청크 (Chunk) | 긴 텍스트를 분할한 단위 (500자, 100자 오버랩) |
| waitUntil | Workers의 응답 후 백그라운드 실행 API |
