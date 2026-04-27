# 변경사항 - 2026.04.22 ~ 2026.04.27

## 멀티사이트 시스템, AI 사용 로그, DB 마이그레이션, Queue 아키텍처 시행착오

---

### 1. 멀티사이트(site_id) 지원

여러 LMS가 동일한 API를 공유하면서 데이터를 격리하기 위한 멀티사이트 도입.

#### 변경 내용

- 모든 테이블에 `site_id INTEGER NOT NULL DEFAULT 0` 컬럼 추가
- 마이그레이션: `008_add_site_id.sql`
- `X-Site-Id` 헤더로 사이트 구분
- 모든 SELECT/UPDATE/INSERT 쿼리에 `site_id` 조건 추가
- 인덱스 추가 (`idx_*_site_id`)

#### 적용 파일

- 백엔드 모든 서비스 (chatService, contentService, learningService, quizService, embeddingService, aiLogService)
- 모든 라우트 (sessions, contents, chat, aiLogs)
- 임베드 위젯 + 대시보드 API 클라이언트

---

### 2. AI 사용 로그 (TB_AI_LOG)

AI 호출 시 토큰/뉴런/비용을 자동 기록하는 시스템 추가.

#### 테이블 컬럼

| 컬럼 | 설명 |
|------|------|
| request_type | chat, chat_stream, learning, learning_answer, quiz_choice, quiz_ox, embedding |
| model | AI 모델명 |
| prompt_tokens / completion_tokens / total_tokens | 토큰 수 |
| neurons | Cloudflare 뉴런 소비량 |
| estimated_cost | 예상 비용 ($) |
| latency_ms | 응답 시간 |
| session_id, lesson_id, site_id | 컨텍스트 |

#### 비용 계산 보정

AI Gateway 실제 비용에서 역산하여 뉴런 환산 계수 보정:
- Gemma 3 12B: 입력 32,000 / 출력 50,000 (per 1M tokens)
- BGE-M3 (임베딩): 입력 130

#### API 추가

- `GET /ai-logs` — 로그 목록 조회 (페이지네이션, 필터)
- `GET /ai-logs/summary` — 사용량 요약 (request_type별 집계, 원화 환산)

#### 환율 표시

USD/KRW 환율 1,450원 적용한 원화 비용 표시 (`estimated_cost_krw`, `total_cost_krw`).

---

### 3. DB 컬럼 변경

#### content_id → lesson_id (TB_AI_LOG)

`AI_LOG`의 `content_id`가 실제로 사용되지 않아 차시별 사용량 집계용 `lesson_id`로 변경. 마이그레이션: `010_ai_log_lesson_id.sql`.

#### setContext 패턴 도입

모든 서비스에 `setContext(sessionId, lessonId)` 메서드 추가. 서비스 생성 후 한 번 호출하면 내부 모든 AI 로그에 자동 전파.

---

### 4. DB 마이그레이션 시행착오 (D1 → MySQL → PostgreSQL → D1 → PostgreSQL)

LMS 멀티 LMS 운영을 위해 외부 DB(Aurora) 도입을 시도하면서 여러 차례 변경.

#### 시도 1: D1 → Aurora MySQL (실패)

- Cloudflare Hyperdrive로 Aurora MySQL 연결 시도
- `mysql2` 패키지: Workers의 `new Function()` 차단으로 사용 불가
- TCP 소켓(`cloudflare:sockets`) + MySQL 프로토콜 직접 구현
- 동작은 했으나 **idle timeout, 커넥션 끊김, 동시 쿼리 충돌** 등 문제 다수
- 뮤텍스 직렬화로 해결 시도했으나 한계

#### 시도 2: Aurora MySQL → Aurora PostgreSQL (성공)

- Cloudflare는 PostgreSQL을 1st class로 지원 (`pg` 드라이버 호환)
- 새 Hyperdrive 생성, 스키마 변환 (SQLite → PostgreSQL)
- 데이터 마이그레이션 완료
- Cron 문법 PostgreSQL 변환 (`DATE_SUB` → `INTERVAL '10 minutes'`)
- TCP 소켓 코드 전부 제거, `pg` 드라이버로 단순화

#### 시도 3: PostgreSQL + Queue 안정화 (실패)

Queue consumer에서 PostgreSQL 작업 시 다양한 문제:
- `Cannot perform I/O on behalf of a different request` — Workers 런타임 제약
- `Exceeded CPU Limit` — AI 호출 시간 초과
- self-fetch 패턴 시도, batch_size=1 적용, 매 메시지 새 커넥션 등 다양한 우회 시도
- 성공률 30~70% 사이 변동, 안정성 확보 실패

#### 시도 4: D1 하이브리드 (Queue용 D1 + PG 동기화) (성공했으나 폐기)

- Queue consumer는 D1(네이티브 바인딩) 사용
- 처리 후 PG에 결과 동기화
- 동작했으나 구조가 복잡

#### 최종: PostgreSQL + 동기 호출 (Queue 제거)

- Queue 제거 (`queues.consumers/producers` 모두 삭제)
- Hyperdrive + PostgreSQL 유지
- `create-with-contents` 항상 동기 처리 (10~30초)
- `callbackUrl`은 fire-and-forget 알림용으로 재정의
- D1 데이터 → PG 최종 이관

---

### 5. Vectorize 차원 수정

임베딩 모델 BGE-M3는 1024차원 출력하는데 인덱스가 768차원으로 설정되어 벡터 저장 실패.

- 인덱스 삭제 후 1024차원으로 재생성
- 71개 콘텐츠 전체 재임베딩

---

### 6. OpenAPI 문서 업데이트 (v3.0.0)

- 멀티사이트 `X-Site-Id` 파라미터 추가
- AI 로그 API 추가
- create-with-contents 동기 처리 전용으로 재작성
- 비동기 모드(Queue) 관련 내용 모두 제거
- generationStatus: `pending`, `processing` 제거 → `none`, `completed`, `failed`
- HTTP 타임아웃 60초 이상 권장 안내

---

### 7. 임베드 위젯 멀티사이트 지원

- `Api` 생성자에 `siteId` 파라미터 추가
- 헤더에 `X-Site-Id` 자동 포함
- 대시보드 테넌트 설정에 `siteId` 추가
- 빌드 후 user1/user2 배포본에 반영

---

## 학습 사항

| 항목 | 결론 |
|------|------|
| **Cloudflare Workers Queue** | 외부 DB(Hyperdrive)와 함께 사용 시 I/O context 충돌, CPU 제한으로 안정성 확보 어려움 |
| **D1 vs Hyperdrive in Queue** | D1(네이티브)은 Queue에서 안정적, 외부 DB는 self-fetch 등 우회 필요 |
| **MySQL vs PostgreSQL on Workers** | PostgreSQL이 1st class 지원, MySQL은 드라이버 제약 다수 |
| **동기 vs 비동기 처리** | 외부 DB + AI 처리는 동기 호출이 가장 안정적 (10~30초 응답) |
| **AI Gateway 실비용** | 뉴런 환산 계수가 문서값과 다름, 실측 역산 필요 |
