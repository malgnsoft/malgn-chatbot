# 변경사항 - 2026.04.15

## Cloudflare Queue 도입 + 퀴즈/세션 API 개선 + 프론트엔드 Q&A 표시

---

### 1. Cloudflare Queue 도입 (비동기 세션 생성)

LMS에서 `POST /sessions/create-with-contents`를 동시에 여러 개 호출할 때, LLM rate limit과 타임아웃 문제를 해결하기 위해 Cloudflare Queue를 도입.

#### 인프라

- Queue 생성: `malgn-chatbot-queue` (default/user1 공유), `malgn-chatbot-queue-user2` (독립)
- Cron Trigger: 5분마다 비정상 상태(processing/pending 타임아웃) 자동 정리
- DB 마이그레이션: `TB_SESSION`에 `generation_status` 컬럼 추가 (none/pending/processing/completed/failed)

#### 동작 방식

- `callbackUrl` 있으면 → Queue 비동기 처리 (202 즉시 응답, 백그라운드에서 학습데이터/퀴즈 생성)
- `callbackUrl` 없으면 → 기존 동기 처리 (201, 수십 초 대기)
- 완료/실패 시 콜백 URL로 결과 POST (콘텐츠 상세, 학습데이터, 퀴즈 정보 포함)
- `callbackData`는 LMS가 전달한 데이터를 그대로 반환 (요청 식별용)

#### Worker 구조

```
Worker (malgn-chatbot-api)
├── fetch()      → HTTP 요청 (Hono 라우팅)
├── queue()      → Queue 메시지 처리 (백그라운드)
└── scheduled()  → Cron 5분마다 (상태 정리)
```

#### 콜백 응답 형식 (성공)

```json
{
  "sessionId": 165,
  "generationStatus": "completed",
  "title": "인사하기",
  "contents": [
    { "id": 50, "index": 0, "title": "1과 자막", "inputName": "1과 자막", "inputType": "link-subtitle", "inputUrl": "https://...", "type": "link" }
  ],
  "learning": { "goal": "...", "summaryCount": 3, "recommendCount": 3 },
  "quiz": { "choiceCount": 3, "oxCount": 2 },
  "callbackData": { "courseId": 100, "lessonId": 2942 }
}
```

#### wrangler.toml 변경

- default: producer + consumer + cron
- user1: producer만 (같은 Queue 공유, consumer는 default에서 처리)
- user2: producer + consumer + cron (독립 Queue)

#### 변경 파일

- `migrations/006_session_generation_status.sql` (신규)
- `wrangler.toml`
- `src/index.js` (queue(), scheduled() 핸들러 추가)
- `src/routes/sessions.js` (create-with-contents Queue 분기)
- `src/openapi.js`
- `docs/QUEUE_DESIGN.md` (설계 문서)

---

### 2. 콘텐츠 타입 세분화

`create-with-contents` API의 콘텐츠 타입을 세분화.

| inputType | 용도 |
|-----------|------|
| `link-subtitle` | 자막 파일 (VTT, SRT) |
| `link-file` | 문서 파일 (PDF, DOCX, PPTX) |
| `link` | 일반 링크 (기존 호환) |
| `text` | 텍스트 직접 입력 |

---

### 3. 콘텐츠 응답 상세화

`create-with-contents` 응답에서 `contentIds` 배열을 `contents` 상세 배열로 변경.

**이전**: `"contentIds": [50, 51]`

**변경 후**:
```json
"contents": [
  { "id": 50, "index": 0, "title": "1과 자막", "inputName": "1과 자막", "inputType": "link-subtitle", "inputUrl": "https://...", "type": "link" }
]
```

---

### 4. 퀴즈 API 개선

#### 퀴즈 생성 수 제한

- 세션 전체 기준으로 설정 수만큼만 생성 (콘텐츠당 → 세션당으로 변경)
- LLM이 초과 생성 시 `.slice(0, count)`로 절단

#### 퀴즈 정답 검증

- `verifyChoiceQuizzes()`: 4지선다 퀴즈 생성 후 LLM으로 정답 번호 검증/수정
- `verifyOXQuizzes()`: OX 퀴즈 생성 후 LLM으로 참/거짓 검증/수정

#### 새 API 추가

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/sessions/:id/quiz/:quizId` | 세션 퀴즈 단건 조회 |
| PUT | `/sessions/:id/quizzes/reorder` | 세션 퀴즈 순서 재정렬 (position → 생성일 순) |

#### 퀴즈 등록/수정/삭제 후 자동 재정렬

- position → 생성일 순으로 position 값 순차 갱신
- 등록(`POST /sessions/:id/quiz`), 수정(`PUT`), 삭제(`DELETE`) 모두 적용

#### position 필드 지원

- 퀴즈 등록/수정 시 `position` 필드 추가 (선택, 미지정 시 자동 배정)

#### 퀴즈 등록 FK 에러 수정

- `content_id = 0`으로 INSERT 시 FK 제약 위반 → 세션 연결 콘텐츠의 첫 번째 ID를 자동 사용

#### 세션 삭제 시 퀴즈 삭제

- 세션 삭제 시 `TB_QUIZ`에서 해당 session_id 퀴즈 soft delete
- 부모 세션 삭제 시 자식 세션 퀴즈도 연쇄 삭제

---

### 5. AI Gateway 전체 적용

chatService, embeddingService에 AI Gateway(`malgn-chatbot`) 옵션 추가. 모든 AI 호출이 AI Gateway를 경유하도록 통일.

| 서비스 | 이전 | 변경 |
|--------|------|------|
| chatService (동기/스트리밍) | Gateway 없음 | `gateway: { id: 'malgn-chatbot' }` |
| embeddingService | Gateway 없음 | `gateway: { id: 'malgn-chatbot' }` |
| quizService | 적용됨 | 유지 |
| learningService | 적용됨 | 유지 |

---

### 6. 추천 질문 Q&A 토글 표시

임베드 위젯 추천 질문 탭에서 질문+답변을 토글(▼/▲) 형식으로 표시.

- 질문 클릭 시 답변 토글
- 답변 없으면 채팅으로 질문 전송
- 기존 문자열 배열 형식 하위 호환

---

### 7. 추천 질문/퀴즈 프롬프트 고도화

#### 추천 질문

- 단순 정의 질문 → 비교형/적용형/분석형 고급 질문으로 수준 향상
- 답변은 4-6문장으로 콘텐츠 본문 기반 상세 작성
- 영어/한국어 학습 콘텐츠 자동 감지 → 맞춤 프롬프트 적용
- 답변 없으면 2차 LLM 호출로 자동 생성

#### 퀴즈

- 영어 학습 콘텐츠 자동 감지 → 한국어 모국어 학습자 맞춤 퀴즈 생성
- 학습 요약도 영어 학습 감지 시 맞춤 내용 생성

---

### 8. 웰컴 메시지

- 임베드 위젯에 `welcomeMessage` 설정 추가
- 세션 생성 시 채팅창에 assistant 메시지로 웰컴 메시지 자동 표시
- 기존 세션 로드 시 메시지가 없으면 웰컴 메시지 표시

---

### 9. userId 지원

- 임베드 위젯에 `userId` 설정 추가
- 세션 생성 시 `user_id`를 API에 전달

---

### 10. 세션 중복 체크 lesson_id 추가

자식 세션 중복 체크에 `lesson_id` 조건 추가.

- 이전: `parent_id + course_user_id`
- 변경: `parent_id + course_user_id + lesson_id`

---

### 변경 파일 요약

**백엔드 (malgn-chatbot-api)**
- `migrations/006_session_generation_status.sql` (신규)
- `docs/QUEUE_DESIGN.md` (신규)
- `wrangler.toml`
- `src/index.js`
- `src/openapi.js`
- `src/routes/sessions.js`
- `src/services/chatService.js`
- `src/services/embeddingService.js`
- `src/services/learningService.js`
- `src/services/quizService.js`

**프론트엔드 (malgn-chatbot)**
- `js/embed/index.js`
- `js/embed/chat.js`
- `js/embed/api.js`
- `js/embed/tabs.js`
- `js/chat.js`
- `css/chatbot.css`
- `js/chatbot-embed.js` (빌드)
