# 변경사항 - 2026.04.07~08

## AI 모델 전환, 응답 품질 개선, 퀴즈 고도화, chatContentIds 지원

---

### 1. AI 모델 전환 (Llama → Gemma 3)

여러 모델을 시도한 끝에 Gemma 3 12B로 전 서비스 통일.

#### 시도한 모델과 결과

| 모델 | 결과 |
|------|------|
| `@cf/meta/llama-3.1-8b-instruct` | 한국어 garbled text 심각 |
| `@cf/meta/llama-3.1-70b-instruct` | garbled text 감소했으나 여전히 발생 |
| `@cf/qwen/qwen1.5-14b-chat-awq` | 2025-10-01 deprecated |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | 후반부 garbled 한국어 발생 |
| **`@cf/google/gemma-3-12b-it`** | **한국어 품질 양호, 채택** |

#### 최종 모델 배치

| 서비스 | 모델 |
|--------|------|
| 채팅 (chatService) | `@cf/google/gemma-3-12b-it` |
| 학습 메타데이터 (learningService) | `@cf/google/gemma-3-12b-it` |
| 퀴즈 (quizService) | `@cf/google/gemma-3-12b-it` |
| 임베딩 (embeddingService) | `@cf/baai/bge-m3` (1024차원, 다국어) |

#### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `malgn-chatbot-api/src/services/chatService.js` | llmModel → gemma-3-12b-it |
| `malgn-chatbot-api/src/services/learningService.js` | model → gemma-3-12b-it |
| `malgn-chatbot-api/src/services/quizService.js` | model → gemma-3-12b-it |

---

### 2. 채팅 응답 품질 개선

#### 시스템 프롬프트 강화

- 문서에 없는 내용 생성 금지 규칙 최상단 배치
- 시스템 설정/콘텐츠 목록 등 내부 정보 노출 방지 규칙 추가
- temperature 0.2, topP 0.2로 보수적 설정

#### 응답 후처리 필터 (sanitizeResponse)

- garbled text 감지 및 제거 (줄 단위, 괄호 내, 꼬리)
- 영어 필러 문장 제거 ("I hope this helps" 등)

#### AI Gateway 캐시 비활성화

- 퀴즈/학습 데이터 생성 시 `skipCache: true`로 변경
- 모델 변경 후 이전 캐시 응답이 반환되는 문제 해결

---

### 3. 퀴즈 생성 고도화

#### 프롬프트 단순화

기존 30+ 규칙 → 핵심 5~7개로 축소. 규칙이 많으면 모델이 무시하는 문제 해결.

#### 수학/과학 콘텐츠 전용 규칙

- `detectMathScience()` — 방정식, 미지수, 함수 등 키워드로 자동 감지
- `getMathScienceInstruction()` — 교안 복사 금지, 새 수치로 문제 생성, 풀이 방법론 질문 금지

#### 한국어 학습 콘텐츠 오감지 수정

- `detectEnglishLearning()`에 한국어 학습 패턴 제외 로직 추가
- "안녕하세요", "한국어", "받침" 등 키워드 감지 시 영어 학습으로 판단하지 않음

#### 후처리 필터 (filterIrrelevantQuizzes)

| 필터 | 예시 |
|------|------|
| 강의 진행 안내 | "기초훈련 시간에는 1번부터 5번까지..." |
| 교안 문제 번호 참조 | "5번 문제를 참고", "(2번 문제..." |
| 질문 길이 초과 | 200자 초과 시 자동 제거 |

#### 누적 생성 로직

기존: 필터 후 1개라도 남으면 바로 반환 → 요청 수량 미달
변경: 부족분만큼 재요청하여 누적, 요청 수량 충족 시 종료

```
요청: 3문제
1차 시도 → 5문제 생성 → 필터 후 2문제 유효 → 누적 2개
2차 시도 → 나머지 1문제 요청 → 필터 후 1문제 → 누적 3개 → 완료
```

#### LaTeX JSON 파싱 보정

- `fixJsonLatex()` — LLM이 `\(`를 출력하면 JSON 파싱 에러 발생
- `\\` 이외의 단독 `\`를 `\\`로 자동 보정
- quizService, learningService 모두 적용

#### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `malgn-chatbot-api/src/services/quizService.js` | 프롬프트 단순화, 수학/과학 감지, 한국어 오감지 수정, 후처리 필터, 누적 생성, fixJsonLatex |
| `malgn-chatbot-api/src/services/learningService.js` | LaTeX 규칙 추가, fixJsonLatex 적용 |

---

### 4. KaTeX 수식 렌더링

채팅, 퀴즈, 학습 탭에서 LaTeX 수식을 렌더링하도록 KaTeX CDN 연동.

#### 지원 범위

| 영역 | renderMath 적용 |
|------|---------------|
| 채팅 메시지 | O |
| 퀴즈 질문/선택지 | O |
| 퀴즈 해설 | O |
| 학습 목표 | O |
| 학습 요약 | O |
| 추천 질문/답변 | O |

#### Shadow DOM 대응

KaTeX CSS를 Shadow Root에 직접 주입하여 Shadow DOM 내부에서도 수식이 렌더링되도록 처리.

#### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `malgn-chatbot/js/embed/utils.js` | `loadKaTeX()`, `renderMath()` 함수 추가, formatContent에서 LaTeX 보호 |
| `malgn-chatbot/js/embed/tabs.js` | 학습 목표/요약/추천질문 renderMath 적용 |
| `malgn-chatbot/js/embed/quiz.js` | 퀴즈/해설 renderMath 적용 |
| `malgn-chatbot/js/embed/chat.js` | 채팅 메시지 renderMath 적용 |

---

### 5. chatContentIds 지원 (채팅/퀴즈 콘텐츠 분리)

채팅 RAG 검색 범위와 퀴즈/학습 데이터 생성 범위를 분리.

#### 사용법

```html
window.MalgnTutor = {
  contentIds: [1, 2],              // 학습목표/퀴즈용 (현재 강의)
  chatContentIds: [1, 2, 3, 4, 5], // 채팅 RAG 검색 범위 (여러 강의)
};
```

| 설정 | 채팅 검색 범위 |
|------|-------------|
| chatContentIds 지정 | 해당 콘텐츠만 검색 |
| chatContentIds 미지정 | contentIds와 동일 |

#### DB 마이그레이션

```sql
-- migrations/007_session_chat_content_ids.sql
ALTER TABLE TB_SESSION ADD COLUMN chat_content_ids TEXT;
```

#### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `malgn-chatbot-api/migrations/007_session_chat_content_ids.sql` | 신규 |
| `malgn-chatbot-api/src/routes/sessions.js` | chat_content_ids 저장, 자식 세션에 부모 값 복사 |
| `malgn-chatbot-api/src/services/chatService.js` | getSessionContentIdsAndParent에서 chatContentIds 반환, 채팅 검색에 적용 |
| `malgn-chatbot/js/embed/index.js` | chatContentIds config 파싱 |
| `malgn-chatbot/js/embed/api.js` | chat_content_ids 세션 생성 시 전달 |

---

### 6. 추천질문 답변 기본 펼침

추천질문 탭에서 답변이 기본적으로 펼쳐진 상태로 표시. 클릭 시 접기/펼치기 토글.

#### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `malgn-chatbot/js/embed/tabs.js` | display:none → display:block, 토글 아이콘 ▼ → ▲ |

---

### 7. 퀴즈 이전/다음 이동 시 채점 결과 유지

채점 완료된 퀴즈로 이전/다음 버튼으로 돌아갔을 때 정답 결과와 해설이 항상 표시.

#### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `malgn-chatbot/js/embed/quiz.js` | showResult() 메서드 분리, renderCurrentQuiz에서 checked 상태 시 결과 재표시 |

---

### 8. 세션 로드 실패 fallback 처리

#### 세션 로드 실패 (404)

삭제된 세션에 접근 시 `sessionId = null`로 초기화 → 다음 메시지 전송 시 새 세션 자동 생성.

#### 부모 세션 없을 때 독립 세션 생성

`parentSessionId`에 해당하는 세션이 없으면 `parentSessionId: 0`으로 재시도하여 독립 세션 생성.

#### 세션 생성 안내 메시지

자식 세션이 처음 생성될 때 "AI 학습 세션을 생성중입니다. 잠시만 기다려주세요..." 메시지 표시. 생성 완료 시 자동 제거.

#### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `malgn-chatbot/js/embed/chat.js` | loadSession 실패 시 sessionId 초기화, 부모 세션 없을 때 fallback, showSystemMessage/removeSystemMessage 추가 |
| `malgn-chatbot/js/embed/index.js` | onSessionCreating에서 안내 메시지 표시, onSessionCreated에서 제거 |
