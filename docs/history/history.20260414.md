# 변경사항 - 2026.04.14

## 멀티사이트(site_id) 지원 + AI 사용 로그(TB_AI_LOG) 추가

---

### 1. 멀티사이트 지원 (site_id)

하나의 테넌트 DB 안에서 사이트별 데이터를 격리하기 위해 모든 테이블에 `site_id` 컬럼을 추가.

#### DB 변경

- 마이그레이션: `migrations/008_add_site_id.sql`
- 대상 테이블: TB_CONTENT, TB_SESSION, TB_MESSAGE, TB_SESSION_CONTENT, TB_QUIZ
- 컬럼: `site_id INTEGER NOT NULL DEFAULT 0`
- 각 테이블에 `idx_*_site_id` 인덱스 추가
- 기존 데이터 `site_id = 1`로 갱신

#### 백엔드 변경

- **auth 미들웨어**: `X-Site-Id` 헤더에서 `siteId` 추출 → `c.set('siteId')` (기본값 0)
- **모든 서비스 생성자**: `siteId` 파라미터 추가 (ChatService, ContentService, QuizService, LearningService, EmbeddingService)
- **모든 SELECT 쿼리**: `AND site_id = ?` 조건 추가
- **모든 INSERT 쿼리**: `site_id` 컬럼 포함
- **모든 라우트**: `c.get('siteId')`를 서비스에 전달
- **내부 서비스 인스턴스**: ContentService→QuizService, ChatService→QuizService 등 내부 생성 시에도 siteId 전달

#### 프론트엔드 변경

- **임베드 위젯** (`js/embed/api.js`): Api 생성자에 `siteId` 추가, `getHeaders()`에 `X-Site-Id` 헤더 포함
- **임베드 초기화** (`js/embed/index.js`): `cfg.siteId`를 Api에 전달
- **대시보드 API** (`js/api.js`): `setSiteId()`, `getSiteId()` 추가, `getAuthHeaders()`에 `X-Site-Id` 포함
- **테넌트 설정** (`js/tenants.js`): 테넌트별 `siteId` 설정 추가, `applyCurrentTenant()`에서 자동 적용

#### OpenAPI 스펙 업데이트

- 버전: `2.0.0` → `2.1.0`
- `components.parameters.SiteId` 추가 (헤더, integer, 기본값 0)
- 28개 인증 엔드포인트에 `X-Site-Id` 파라미터 참조 추가
- ContentSummary, ContentDetail 스키마에 `siteId` 필드 추가

#### 임베드 위젯 사용법

```html
<script>
window.MalgnTutor = {
  apiUrl: "https://...",
  apiKey: "...",
  siteId: 1,              // 멀티사이트 ID
  parentSessionId: 10,
  ...
};
</script>
```

#### 변경 파일

**백엔드 (malgn-chatbot-api)**
- `migrations/008_add_site_id.sql` (신규)
- `schema.sql`
- `src/index.js`
- `src/middleware/auth.js`
- `src/openapi.js`
- `src/routes/chat.js`
- `src/routes/contents.js`
- `src/routes/sessions.js`
- `src/services/chatService.js`
- `src/services/contentService.js`
- `src/services/learningService.js`
- `src/services/quizService.js`
- `src/services/embeddingService.js`

**프론트엔드 (malgn-chatbot)**
- `js/api.js`
- `js/embed/api.js`
- `js/embed/index.js`
- `js/tenants.js`
- `js/chatbot-embed.js` (빌드)

---

### 2. AI 사용 로그 (TB_AI_LOG)

AI 호출 시 토큰 사용량, 뉴런 소비량, 예상 비용을 DB에 자동 기록.

#### DB 설계

- 마이그레이션: `migrations/009_ai_log.sql`
- 테이블: `TB_AI_LOG`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| session_id | INTEGER | 세션 ID |
| content_id | INTEGER | 콘텐츠 ID |
| request_type | TEXT | chat, learning, learning_answer, quiz_choice, quiz_ox, embedding |
| model | TEXT | AI 모델명 |
| prompt_tokens | INTEGER | 입력 토큰 수 |
| completion_tokens | INTEGER | 출력 토큰 수 |
| total_tokens | INTEGER | 총 토큰 수 |
| neurons | REAL | Cloudflare 뉴런 소비량 |
| estimated_cost | REAL | 예상 비용 ($) |
| latency_ms | INTEGER | 응답 시간 (ms) |
| site_id | INTEGER | 사이트 ID |

#### 비용 계산 로직

모델별 뉴런 환산 계수 (1M 토큰당):

| 모델 | 입력 뉴런 | 출력 뉴런 |
|------|----------|----------|
| Gemma 3 12B | 410 | 1,600 |
| BGE-M3 (임베딩) | 35 | 0 |

비용: 초과 뉴런 × $0.011 / 1,000

#### 로깅 지점

| 서비스 | request_type | 비고 |
|--------|-------------|------|
| chatService.generateResponse() | `chat` | 동기 채팅 (스트리밍은 usage 미제공으로 제외) |
| learningService.generateLearningData() | `learning` | 학습 목표/요약/추천질문 생성 |
| learningService.generateAnswersForQuestions() | `learning_answer` | 추천질문 답변 2차 생성 |
| quizService.callWorkersAI() | `quiz_choice`, `quiz_ox` | 퀴즈 생성 |
| embeddingService.embed() | `embedding` | 벡터 변환 (토큰 추정) |

#### 조회 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/ai-logs` | 로그 목록 (page, type, startDate, endDate 필터) |
| GET | `/ai-logs/summary` | 사용량 요약 (request_type별 집계 + 전체 합계) |

#### 변경 파일

- `migrations/009_ai_log.sql` (신규)
- `src/services/aiLogService.js` (신규)
- `src/routes/aiLogs.js` (신규)
- `src/index.js`
- `schema.sql`
- `src/services/chatService.js`
- `src/services/contentService.js`
- `src/services/learningService.js`
- `src/services/quizService.js`
- `src/services/embeddingService.js`
