# 변경사항 - 2026.03.18

## 퀴즈 난이도 설정 + 세션별 퀴즈 수 반영 + 콘텐츠 등록 시 퀴즈 제거 + 개발자 교육 자료

3가지 기능 변경과 개발자 교육 문서 작성.

---

### 1. 퀴즈 난이도 설정

TB_SESSION에 `quiz_difficulty` 컬럼을 추가하여 세션별 퀴즈 난이도 설정 가능.

#### DB 마이그레이션

| 파일 | 작업 |
|------|------|
| `malgn-chatbot-api/migrations/005_session_quiz_difficulty.sql` | **신규** - quiz_difficulty 컬럼 추가 |

```sql
ALTER TABLE TB_SESSION ADD COLUMN quiz_difficulty TEXT DEFAULT 'normal';
```

#### 난이도별 퀴즈 생성 프롬프트

| 난이도 | 수준 | 프롬프트 |
|--------|------|----------|
| `easy` | 기억/회상 | 텍스트에서 직접 찾을 수 있는 사실 확인 문제 |
| `normal` | 이해/적용 | 개념 이해를 확인하는 문제 |
| `hard` | 분석/적용 | 여러 개념을 연결하거나 새로운 상황에 적용하는 문제 |

#### API 변경

| 파일 | 변경 내용 |
|------|-----------|
| `malgn-chatbot-api/src/routes/sessions.js` | POST/PUT에서 `quizDifficulty` 처리 |
| `malgn-chatbot-api/src/services/quizService.js` | `getDifficultyInstruction(difficulty)` 메서드 추가 |
| `malgn-chatbot-api/src/services/quizService.js` | `generateChoiceQuizzes()`, `generateOXQuizzes()`에 난이도 프롬프트 삽입 |

#### 프론트엔드 변경

| 파일 | 변경 내용 |
|------|-----------|
| `js/settings.js` | `quizDifficulty` 설정 추가 (기본값: 'normal') |
| `index.html` | 난이도 선택 버튼 UI (쉬움/보통/어려움) |
| `js/embed/index.js` | settings에 `quizDifficulty` 전달 |

---

### 2. 세션 생성 시 퀴즈 수 설정 반영

세션 생성 시 설정한 `choice_count`, `ox_count`가 퀴즈 생성에 반영되도록 변경.

#### 변경 포인트

```
Before: 퀴즈 생성 시 콘텐츠 등록 시점의 기본값 사용
After:  세션 생성 시 settings의 choiceCount, oxCount를 퀴즈 생성에 전달
```

| 파일 | 변경 내용 |
|------|-----------|
| `malgn-chatbot-api/src/routes/sessions.js` | 세션 생성 시 `choiceCount`, `oxCount`, `quizDifficulty`를 퀴즈 생성 함수에 전달 |

---

### 3. 콘텐츠 등록 시 퀴즈 생성 제거

콘텐츠 등록 시점에서 퀴즈를 자동 생성하던 로직을 **제거**. 퀴즈는 **세션 생성 시에만** 생성.

#### 이유

- 콘텐츠 등록 시점에는 퀴즈 난이도/개수 설정이 없음
- 세션 생성 시 설정(난이도, 4지선다 수, OX 수)에 맞게 생성하는 것이 적절
- 불필요한 70B LLM 호출 제거 → 콘텐츠 등록 속도 향상

#### 변경

| 파일 | 변경 내용 |
|------|-----------|
| `malgn-chatbot-api/src/services/contentService.js` | `uploadText()`, `uploadFile()`, `uploadLink()`에서 퀴즈 생성 호출 제거 |
| `malgn-chatbot-api/src/routes/sessions.js` | 세션 생성 시 콘텐츠별 퀴즈 생성 (기존 퀴즈 없는 콘텐츠만) |

---

### 4. 추천 질문 Q&A 토글 프론트엔드 반영

03.17 API 변경에 대한 프론트엔드 측 반영.

| 파일 | 변경 내용 |
|------|-----------|
| `js/chat.js` | Q&A 토글 렌더링 및 이벤트 처리 (대시보드) |
| `js/embed/tabs.js` | Q&A 토글 렌더링 및 이벤트 처리 (임베드) |
| `js/settings.js` | `quizDifficulty` 입력 동기화 |

---

### 5. 문서 현행화

| 파일 | 변경 내용 |
|------|-----------|
| `malgn-chatbot/CLAUDE.md` | quiz_difficulty, Q&A 추천질문, 웰컴메시지, userId 반영 |
| `malgn-chatbot-api/schema.sql` | quiz_difficulty 컬럼 반영 |
| `malgn-chatbot-api/src/openapi.js` | quiz_difficulty, Q&A 추천질문 스펙 반영 |

---

### 6. 개발자 교육 자료 작성

| 파일 | 설명 |
|------|------|
| `malgn-chatbot/docs/developer-guide.md` | **신규** - 전체 16챕터 개발자 교육 자료 |

프론트엔드·백엔드 전체 소스 코드 분석을 기반으로 작성:
- 프로젝트 개요, 개발 환경 설정
- 저장소 구조, 아키텍처 다이어그램
- 프론트엔드 7개 모듈 상세 (코드 패턴, 데이터 흐름)
- 백엔드 5개 서비스 상세 (RAG 파이프라인, LLM 호출)
- DB 스키마 (ER 다이어그램, DDL, 인덱스)
- 이벤트 시스템, Shadow DOM, 멀티테넌트
- 빌드/배포, 디버깅, 코딩 규칙
- API 레퍼런스 (전체 엔드포인트 예시)

---

### 배포

| 환경 | 상태 |
|------|------|
| malgn-chatbot-api user1 | 배포 완료 |
| malgn-chatbot-api user2 | 배포 완료 |
| malgn-chatbot (Pages) | 배포 완료 |
