# 변경사항 - 2026.05.07

## 프로젝트 문서 일괄 현행화 + AI 프롬프트/Gateway 리스크 레퍼런스 신설

> **참고**: DB 마이그레이션(D1→Aurora MySQL→PostgreSQL→…) 시행착오와 Queue 폐기 결정의 자세한 경위는 [history.20260427.md](history.20260427.md). 이후 Aurora MySQL 재선택(`mysql2` createPool)으로 인프라가 한 번 더 정리되면서 기존 문서들과 실제 코드 사이 불일치가 누적되어 있었음.

---

### 1. AI 프롬프트 통합 문서 (AI_PROMPTS.md) 신설

`malgn-chatbot-api/src/services/`에 흩어져 있던 LLM 프롬프트(시스템/사용자/지시문)를 한 파일에서 원문 그대로 추적할 수 있도록 통합 레퍼런스 문서를 신설.

**대상 파일 및 메서드 12종**:

| 분류 | 파일 | 메서드 |
|------|------|--------|
| 채팅 응답 (RAG, XML 6섹션) | `chatService.js` | `buildSystemPrompt()` |
| 응답 잘림 자동 요약 | `chatService.js` | `handleTruncation()` |
| 학습 메타데이터 (제목/목표/요약/추천Q&A) | `learningService.js` | `generateLearningData()` |
| 영어 학습 콘텐츠 추가 지시 | `learningService.js` | `englishLearningInstruction` |
| 누락 답변 보강 | `learningService.js` | `generateAnswersForQuestions()` |
| 4지선다 퀴즈 생성 | `quizService.js` | `generateChoiceQuizzes()` |
| OX 퀴즈 생성 | `quizService.js` | `generateOXQuizzes()` |
| 4지선다 정답 검증 | `quizService.js` | `verifyChoiceQuizzes()` |
| OX 정답 검증 | `quizService.js` | `verifyOXQuizzes()` |
| 난이도별 지시 (easy/normal/hard) | `quizService.js` | `getDifficultyInstruction()` |
| 영어 학습 퀴즈 추가 지시 | `quizService.js` | `getEnglishLearningInstruction()` |
| 수학/과학 퀴즈 추가 지시 | `quizService.js` | `getMathScienceInstruction()` |

각 항목마다 파일 경로·라인 번호·시스템/사용자 프롬프트 원문·변수 표 포함. 하단에 갱신 이력과 갱신 체크리스트 배치하여 향후 프롬프트 수정 시 동시 갱신할 수 있도록 함.

---

### 2. AI Gateway 동시성 리스크 분석 보고서 (AI_GATEWAY_CONCURRENCY.md) 신설

Cloudflare AI Gateway에 동시 다발 요청이 들어올 때 발생 가능한 문제를 8개 카테고리로 분석한 리포트 신설. Workers Paid 플랜 + Aurora MySQL(Hyperdrive) 환경 기준.

**주요 분석 항목**:

| 카테고리 | 핵심 한도/위험 |
|----------|-----------------|
| Rate Limiting | Backend `gemma-3-12b-it` **300 RPM** ← 1차 병목 |
| Subrequest 한도 | Paid 기본 **10,000 / invocation** (구식 1,000 → 상향, 2026-02-11 changelog 반영) |
| 6 동시 연결 제한 | response header 대기 중 동시 연결 6개 제한 |
| Cache Stampede | 캐시 만료 직후 동시 미스로 backend 마비 |
| Workers AI Quota | **10,000 Neurons/일** 무료, $0.011/1K Neurons 초과 |
| Cost 폭증 | 월 트래픽 시뮬레이션 ~$260-290 (Cloudflare + AWS Aurora 합산) |
| Latency 악화 | RPM 한계 도달 시 단계적 악화 + SSE 특이점 |
| Streaming/CPU 한도 | Worker 동시 연결 ~1,000, Paid CPU 30s |
| Aurora MySQL + Hyperdrive | 별도 8.5절 신설 (max_connections, ACU 스케일, slow query) |

**완화 방안** 11개를 우선순위(🔴 즉시 / 🟡 1개월 / 🟢 3개월)로 분류. AI Gateway Analytics 모니터링 체크리스트 포함.

웹 검색으로 Cloudflare 공식 문서(2026-02-11 subrequest changelog 등)를 검증하여 최신 수치 반영.

---

### 3. 배포 스크립트 분석 (deploy.sh)

`malgn-chatbot-api/scripts/deploy.sh --all`이 어떤 테넌트를 배포하는지 분석.

**현재 동작**: `wrangler.toml`의 `[env.X]` 섹션을 grep해 자동 추출 → user1, user2, cloud 순차 배포.

**발견된 이슈**:
- `[env.user2]` 섹션이 잔존 (CLAUDE.md상 user2→cloud 변경 완료된 상태) → `--all` 실행 시 불필요하게 함께 배포됨
- 최상위 설정(default = dev)은 `wrangler deploy` (env 없이)로 별도 배포 필요하나 `--all`에서 누락
- 사용자 확인: dev도 운영 배포 대상 → 스크립트에 `deploy_default` 추가 권고

**조치**: 권고만 보고. 실제 스크립트 수정은 후속 작업으로 미룸 (사용자 검토 후 진행).

---

### 4. CLAUDE.md 정정 (8개 항목)

기존 CLAUDE.md가 실제 코드/스키마와 불일치한 부분을 정정.

| 항목 | Before | After |
|------|--------|-------|
| 데이터베이스 (기술 스택) | `Cloudflare D1 (SQLite)` | `Aurora MySQL (Cloudflare Hyperdrive 경유)` |
| AI 모델 | `@cf/mistralai/mistral-small-3.1-24b-instruct` | `@cf/google/gemma-3-12b-it` |
| 임베딩 차원 | `768차원` | `1024차원, bge-m3` |
| RAG 다이어그램 LLM | `Llama 3.1 8B` | `gemma-3-12b-it` |
| DB 스키마 헤더 | `### DB 스키마 (D1)` | `### DB 스키마 (Aurora MySQL)` |
| 멀티테넌트 항목 | `D1 DB, KV, R2, Vectorize` | `Aurora MySQL DB(Hyperdrive 바인딩), KV, R2, Vectorize` |
| 빌드 & 배포 명령 | `wrangler d1 execute ...` | `mysql -h <HOST> ... < migrations/010_*.sql` |
| 마이그레이션 목록 | `001~005` (5건) | `001~010` (12건, 005 split + 006 중복 포함) |

---

### 5. API 문서 9종 + 프론트 docs 2종 일괄 현행화

기존 문서들이 D1/Mistral/Llama/768차원/user2 등 구식 표현을 다수 포함하고 있어 일괄 grep 후 정정. 문서 11개에서 **약 100건** 정정.

**카테고리별 정정**:

| 카테고리 | 변경 | 건수 |
|----------|------|------|
| A. DB | `Cloudflare D1` → `Aurora MySQL (Hyperdrive)`, `wrangler d1 execute` → `mysql -h ...`, `[[d1_databases]]` → `[[hyperdrive]]` | 34 |
| B. AI 모델 | `mistral-small-3.1-24b` / `Llama 3.1 8B` → `gemma-3-12b-it` | 19 |
| C. 임베딩 | `768차원` → `1024차원`, `@cf/baai/bge-base-en` → `@cf/baai/bge-m3` | 26 |
| D. 테넌트 | `user2` (활성 인프라 설명) → `cloud` | 14 |
| E. 마이그레이션 | `001~005` → `001~010` (12개 전체) | 6 |
| F. Queue 폐기 | QUEUE_DESIGN.md 상단에 ⚠️ DEPRECATED 알림 추가 (본문 보존) | 1 |

**수정한 문서**:
- `malgn-chatbot/docs/cost-analysis.md`
- `malgn-chatbot/docs/developer-guide.md`
- `malgn-chatbot-api/docs/API_SPECIFICATION.md`
- `malgn-chatbot-api/docs/DATABASE_SCHEMA.md`
- `malgn-chatbot-api/docs/DEVLOPMENT_GUIDE.md`
- `malgn-chatbot-api/docs/PROGRESS.md`
- `malgn-chatbot-api/docs/PROJECT_STRUCTURE.md`
- `malgn-chatbot-api/docs/README.md`
- `malgn-chatbot-api/docs/SETUP_GUIDE.md`
- `malgn-chatbot-api/docs/TECH_STACK.md`
- `malgn-chatbot-api/docs/QUEUE_DESIGN.md` (deprecation notice만)

**의도적으로 보존한 항목**:
- 마이그레이션 변경 이력 내러티브 (`D1 → Aurora MySQL → PostgreSQL → 최종 결정`) — 시행착오 기록
- `cost-analysis.md` Llama 가격 비교 테이블 — 의도된 외부 모델 비교 컨텍스트
- `QUEUE_DESIGN.md` 본문 — 폐기 설계의 일부로 보존 (deprecation 알림만 추가)
- 코드 변수명 (`D1_DB`, `DB` 바인딩 식별자) — 코드 식별자는 보존, 설명 텍스트만 정정

**최종 검증**: `grep "Cloudflare D1|mistral-small|Llama 3.1|768차원|@cf/baai/bge-base"` → 활성 문서에서 0건.

---

## 결과

| 항목 | 결론 |
|------|------|
| **문서 일치성** | 11개 활성 MD 문서가 실제 코드/인프라(Aurora MySQL, gemma-3-12b-it, bge-m3 1024차원, cloud 테넌트)와 정합 |
| **AI 프롬프트 추적성** | 분산되어 있던 LLM 프롬프트 12종을 단일 레퍼런스로 통합. 향후 프롬프트 수정 시 동시 갱신 규칙 정립 |
| **운영 리스크 가시화** | AI Gateway 동시성 리스크 8개 카테고리 + 우선순위별 완화 방안 11개 정리. 즉시 적용 권고 3가지 (Spending Limit, Retry/Fallback 정책, Analytics 모니터링) |
| **배포 스크립트** | `[env.user2]` 잔존 + default(dev) 누락 이슈 식별. 후속 작업으로 분리 |

---

### 변경 파일

**malgn-chatbot (frontend repo)** — 커밋 `d5b42a4`
- `CLAUDE.md` (35행 변경)
- `docs/cost-analysis.md`
- `docs/developer-guide.md` (대규모 정정)
- `docs/history/history.20260507.md` (신규, 본 문서)
- `docs/history/README.md` (인덱스 항목 추가)

**malgn-chatbot-api (backend repo)** — 커밋 `b663cec`
- `docs/AI_PROMPTS.md` (신규)
- `docs/AI_GATEWAY_CONCURRENCY.md` (신규)
- `docs/API_SPECIFICATION.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/DEVLOPMENT_GUIDE.md`
- `docs/PROGRESS.md`
- `docs/PROJECT_STRUCTURE.md`
- `docs/QUEUE_DESIGN.md` (deprecation notice)
- `docs/README.md`
- `docs/SETUP_GUIDE.md`
- `docs/TECH_STACK.md`

**미커밋 (이번 작업과 무관, 별도 진행 중)**
- `malgn-chatbot/js/chatbot-embed.js`, `js/embed/chat.js`, `js/embed/index.js`
- `malgn-chatbot-api/scripts/migrate-pg-to-mysql.js`
