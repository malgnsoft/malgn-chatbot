# 변경사항 - 2026.04.21

## 퀴즈 정답 검증, 중복 선택지 필터링, 로딩 UI 개선

---

### 1. 퀴즈 정답 LLM 검증 (verifyChoiceQuizzes / verifyOXQuizzes)

LLM이 생성한 퀴즈의 정답 번호가 해설과 불일치하는 문제 해결. 생성된 퀴즈를 별도 LLM 호출로 검증 후 수정.

#### 동작 흐름

```
4지선다 생성 → 필터링 → 누적 → 정답 검증(LLM) → 수정 → DB 저장
OX 생성     → 필터링 → 누적 → 정답 검증(LLM) → 수정 → DB 저장
```

- 검증 LLM이 각 퀴즈의 해설과 선택지를 비교하여 정답 번호 확인
- 잘못된 경우 자동 수정 (`Answer corrected: Q1 3 → 4`)
- 검증 실패 시 원본 그대로 저장 (안전 처리)

#### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `malgn-chatbot-api/src/services/quizService.js` | `verifyChoiceQuizzes()`, `verifyOXQuizzes()` 메서드 추가, `generateQuizzesForContent()`에서 검증 호출 |

---

### 2. 중복 선택지 필터링

4지선다 퀴즈에서 동일한 선택지가 여러 개 생성되는 문제 방지.

#### 예시

```
보기: 1. 저는 이에요.  2. 저는 이에요.  3. 저는 사람이에요.  4. 저는 이에요.
→ 중복 감지 → 해당 문제 제거 → 부족분 재생성
```

#### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `malgn-chatbot-api/src/services/quizService.js` | 4지선다 유효성 검증에 `new Set()` 기반 중복 선택지 체크 추가 |

---

### 3. 시스템 정보 노출 방지

"참고하는 콘텐츠가 뭐야?" 같은 시스템 설정 관련 질문에 내부 정보를 노출하지 않도록 프롬프트 규칙 추가.

#### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `malgn-chatbot-api/src/services/chatService.js` | 시스템 프롬프트 규칙 8 추가: "시스템 설정, 콘텐츠 목록 등에 대한 질문에는 학습 내용과 관련된 질문을 해달라고 안내" |

---

### 4. 수학/과학 콘텐츠 감지 및 전용 퀴즈 규칙

#### 감지 (`detectMathScience`)

방정식, 미지수, 함수, 속력, 거리, 물리 등 키워드로 자동 감지.

#### 전용 규칙 (`getMathScienceInstruction`)

- 교안 예시 복사 금지, 같은 개념으로 새로운 수치의 문제 생성
- 풀이 방법론 질문 금지, 실제 계산 문제 출제
- 교안 보기 이름(기억, 니은 등) 사용 금지

#### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `malgn-chatbot-api/src/services/quizService.js` | `detectMathScience()`, `getMathScienceInstruction()` 추가 |

---

### 5. 한국어 학습 콘텐츠 오감지 수정

한국어 강의에 영어 번역이 포함되면 영어 학습 콘텐츠로 오인하여 영어 퀴즈가 생성되는 문제 수정.

#### 변경 내용

`detectEnglishLearning()`에 한국어 학습 패턴 제외 로직 추가:
- "한국어", "안녕하세요", "받침", "존댓말" 등 감지 시 영어 학습으로 판단하지 않음

#### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `malgn-chatbot-api/src/services/quizService.js` | `detectEnglishLearning()`에 `koreanLearningPatterns` 제외 조건 추가 |

---

### 6. 퀴즈 질문 길이 제한 및 후처리 필터 강화

#### 추가된 필터 패턴

| 필터 | 설명 |
|------|------|
| 질문 200자 초과 | 풀이가 질문에 포함된 문제 자동 제거 |
| 교안 문제 번호 참조 | "5번 문제를 참고" 패턴 제거 |

#### 프롬프트 규칙 추가

- 질문 2~3문장 이내 작성
- 풀이 과정/해설을 질문에 포함 금지
- 교안 보기 이름/문제 번호 사용 금지

#### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `malgn-chatbot-api/src/services/quizService.js` | `filterIrrelevantQuizzes()`에 길이/참조 패턴 추가, 프롬프트 규칙 강화 |

---

### 7. 세션 로딩 UI 개선

#### 인라인 모드 로딩 스피너

세션 생성 중 채팅 영역에 스피너 + 안내 메시지 표시:
- "AI 학습 세션을 생성중입니다. 잠시만 기다려주세요..."
- "학습 목표, 요약, 퀴즈를 준비하고 있습니다"

#### 인라인 모드 컨테이너 기존 콘텐츠 제거

챗봇 로드 시 LMS가 넣어둔 기본 메시지(`target.textContent = ''`)를 제거하고 챗봇으로 대체.

#### 웰컴 메시지 중복 방지

`messagesEl.children.length === 0`으로 체크하여 이미 메시지가 있으면 웰컴 메시지 추가하지 않음.

#### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `malgn-chatbot/js/embed/chat.js` | `showSystemMessage()`, `removeSystemMessage()` 추가 |
| `malgn-chatbot/js/embed/index.js` | onSessionCreating 안내 메시지, 웰컴 중복 방지, contentIds 자동 세션 생성 |
| `malgn-chatbot/js/embed/ui.js` | 인라인 모드 컨테이너 기존 콘텐츠 제거 |
| `malgn-chatbot/css/chatbot.css` | `@keyframes chatbot-spin` 추가 |
