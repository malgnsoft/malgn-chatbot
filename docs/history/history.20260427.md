# 변경사항 - 2026.04.22 ~ 2026.04.27

## DB 마이그레이션 시행착오, 동기 호출 전환, AI 비용 보정

> **참고**: 멀티사이트(site_id) 도입과 AI 사용 로그(TB_AI_LOG) 기본 구조는 [history.20260414.md](history.20260414.md)에 기록됨.

---

### 1. AI 사용 로그 비용 보정

#### 뉴런 환산 계수 실측 보정

AI Gateway 실제 비용과 DB의 `estimated_cost` 비교 결과 60~70배 차이 발견. 모델별 뉴런 환산 계수를 Gateway 실비용에서 역산하여 보정.

| 모델 | 보정 전 (입력/출력) | 보정 후 (입력/출력) |
|------|---------------------|---------------------|
| Gemma 3 12B | 410 / 1,600 | **32,000 / 50,000** |
| BGE-M3 (임베딩) | 35 / 0 | **130 / 0** |

기존 로그 데이터도 일괄 갱신하여 정확한 비용 표시.

#### 스트리밍 채팅 토큰 추정 보정

`/chat/stream`은 Workers AI에서 `usage` 정보를 제공하지 않아 텍스트 길이로 추정. 한국어+영어 혼합 텍스트는 **1.85자/토큰** 비율 적용 (기존 3자/토큰에서 보정).

#### 원화(KRW) 표시

USD/KRW 환율 1,450원 적용한 원화 비용 응답에 추가:
- `estimated_cost_krw` (개별 로그)
- `total_cost_krw` (요약)
- `exchangeRate` (현재 환율)

---

### 2. AI 로그 컬럼 변경

#### content_id → lesson_id (TB_AI_LOG)

`AI_LOG`의 `content_id`가 실제로 사용되지 않아 차시별 사용량 집계용 `lesson_id`로 변경. 마이그레이션: `010_ai_log_lesson_id.sql`.

#### setContext 패턴 도입

모든 서비스에 `setContext(sessionId, lessonId)` 메서드 추가. 서비스 생성 후 한 번 호출하면 내부 모든 AI 로그에 자동 전파:

```js
const learningService = new LearningService(c.env, siteId);
learningService.setContext(sessionId, lessonId);
// 이후 호출되는 모든 AI 로그에 sessionId, lessonId 자동 포함
```

---

### 3. DB 마이그레이션 시행착오

LMS 멀티 운영을 위해 외부 DB(Aurora) 도입을 시도하면서 여러 차례 변경.

#### 시도 1: D1 → Aurora MySQL (실패)

- Cloudflare Hyperdrive로 Aurora MySQL 연결 시도
- `mysql2` 패키지: Workers의 `new Function()` 차단으로 사용 불가
- TCP 소켓(`cloudflare:sockets`) + MySQL 프로토콜 직접 구현
- 동작은 했으나 idle timeout, 커넥션 끊김, 동시 쿼리 충돌 등 문제 다수
- 뮤텍스 직렬화로 해결 시도했으나 한계

#### 시도 2: Aurora MySQL → Aurora PostgreSQL (성공)

- Cloudflare는 PostgreSQL을 1st class로 지원 (`pg` 드라이버 호환)
- 새 Hyperdrive 생성, 스키마 변환 (SQLite → PostgreSQL)
- 데이터 마이그레이션 완료
- Cron 문법 PostgreSQL 변환 (`DATE_SUB` → `INTERVAL '10 minutes'`)
- TCP 소켓 코드 전부 제거, `pg` 드라이버로 단순화

#### 시도 3: PostgreSQL + Queue 안정화 (실패)

Queue consumer에서 PostgreSQL 작업 시 다양한 문제 발생:
- `Cannot perform I/O on behalf of a different request` — Workers 런타임 제약
- `Exceeded CPU Limit` — AI 호출 시간 초과
- self-fetch 패턴 시도, batch_size=1 적용, 매 메시지 새 커넥션 등 다양한 우회 시도
- 성공률 30~70% 사이 변동, 안정성 확보 실패

#### 시도 4: D1 하이브리드 (Queue용 D1 + PG 동기화) (성공했으나 폐기)

- Queue consumer는 D1(네이티브 바인딩) 사용 → 안정적 동작
- 처리 후 PG에 결과 동기화
- 동작했으나 구조가 복잡

#### 최종 결정: PostgreSQL + 동기 호출 (Queue 제거)

- Queue producer/consumer 완전 제거
- Hyperdrive + PostgreSQL 유지
- `create-with-contents` 항상 동기 처리 (10~30초)
- `callbackUrl`은 fire-and-forget 알림용으로 재정의
- D1 데이터 → PG 최종 이관

---

### 4. Vectorize 차원 수정

임베딩 모델 BGE-M3는 1024차원 출력하는데 인덱스가 768차원으로 설정되어 벡터 저장 실패.

- 인덱스 삭제 후 1024차원으로 재생성
- 71개 콘텐츠 전체 재임베딩

---

### 5. OpenAPI 문서 업데이트 (v3.0.0)

- 멀티사이트 `X-Site-Id` 파라미터 추가
- AI 로그 API 추가 (`/ai-logs`, `/ai-logs/summary`)
- create-with-contents 동기 처리 전용으로 재작성
- 비동기 모드(Queue) 관련 내용 모두 제거
- generationStatus: `pending`, `processing` 제거 → `none`, `completed`, `failed`
- HTTP 타임아웃 60초 이상 권장 안내

---

## 학습 사항

| 항목 | 결론 |
|------|------|
| **Cloudflare Workers Queue** | 외부 DB(Hyperdrive)와 함께 사용 시 I/O context 충돌, CPU 제한으로 안정성 확보 어려움 |
| **D1 vs Hyperdrive in Queue** | D1(네이티브)은 Queue에서 안정적, 외부 DB는 self-fetch 등 우회 필요 |
| **MySQL vs PostgreSQL on Workers** | PostgreSQL이 1st class 지원, MySQL은 드라이버 제약 다수 |
| **동기 vs 비동기 처리** | 외부 DB + AI 처리는 동기 호출이 가장 안정적 (10~30초 응답) |
| **AI Gateway 실비용** | 뉴런 환산 계수가 문서값과 다름, 실측 역산 필요 (60~70배 차이) |

---

### 변경 파일

**백엔드 (malgn-chatbot-api)**
- `migrations/010_ai_log_lesson_id.sql` (신규)
- `schema.pg.sql` (신규)
- `wrangler.toml`
- `src/index.js` (Queue 제거, DB 미들웨어 정리)
- `src/utils/database.js` (`pg` 드라이버 래퍼)
- `src/openapi.js` (v3.0.0)
- `src/routes/sessions.js` (Queue 분기 제거)
- `src/services/aiLogService.js` (뉴런 계수 보정, 원화 표시)
- 기타 서비스 파일 (setContext 패턴)

**프론트엔드 (malgn-chatbot)**
- 변경 없음 (이전 작업 유지)
