# 변경사항 - 2026.02.24

## 시스템 프롬프트 구조 고도화

기존 평면적 하드코딩 프롬프트를 XML 태그 기반 구조화된 프롬프트로 개선. 학습 데이터·퀴즈 정보를 안정적으로 포함하고, 프롬프트 중복을 제거.

---

### 개선 전 (Before)

```
{persona}

규칙:
1~8번 규칙 (하드코딩, 2곳 중복)

참고 문서:
{RAG 컨텍스트}
```

**문제점:**
- `generateResponse()`와 `prepareChatContext()`에 동일 프롬프트 중복
- `learning_goal`/`learning_summary`는 Vectorize 유사도 검색에 의존 (불안정)
- `recommended_questions` 프롬프트에 미반영
- `getQuizContext()` 정의만 되고 호출되지 않음
- 출력 형식 가이드 없음

---

### 개선 후 (After)

```xml
<role>
{persona}
</role>

<learning_context>
학습 목표: {learning_goal}

핵심 요약:
1. {summary_1}
2. {summary_2}
3. {summary_3}

추천 질문 (학습자가 이런 질문을 할 수 있음):
- {question_1}
- {question_2}
- {question_3}
</learning_context>

<rules>
1~8번 규칙
</rules>

<output_format>
- 핵심 내용은 **굵게** 강조
- 번호/불릿 목록 사용
- 복잡한 개념은 단계별 설명
- 짧고 명확한 문장
</output_format>

<reference_documents>
{RAG 컨텍스트}
</reference_documents>

<quiz_info>
{퀴즈 정답 정보 - 있을 때만 포함}
</quiz_info>
```

---

### 수정 파일

| 파일 | 작업 |
|------|------|
| `malgn-chatbot-api/src/services/chatService.js` | **수정** - 유일한 수정 대상 |

---

### 상세 변경 내역

#### 1. `getSessionLearningData(sessionId)` 메서드 추가

DB에서 `learning_goal`, `learning_summary`, `recommended_questions`를 직접 조회하는 메서드.

- Vectorize 유사도 검색에 의존하지 않고 **항상** 학습 데이터를 확보
- 자식 세션(`parent_id > 0`)이면 부모 세션의 데이터를 반환
- 기존 병렬 처리(`Promise.all`)에 합류하여 추가 지연 없음

```javascript
async getSessionLearningData(sessionId) {
  // DB에서 learning_goal, learning_summary, recommended_questions 직접 조회
  // 자식 세션이면 부모의 데이터 사용
  return { learningGoal, learningSummary, recommendedQuestions };
}
```

#### 2. `buildSystemPrompt(options)` 메서드 추가

중앙화된 프롬프트 빌더. 기존 2곳 중복을 제거.

| 섹션 | XML 태그 | 설명 |
|------|---------|------|
| 페르소나 | `<role>` | 세션별 커스텀 가능 |
| 학습 맥락 | `<learning_context>` | 학습 목표 + 핵심 요약 + 추천 질문 (DB 직접 조회) |
| 규칙 | `<rules>` | 기존 8개 규칙 유지 |
| 출력 형식 | `<output_format>` | 마크다운 포맷 가이드 (신규) |
| 참고 문서 | `<reference_documents>` | RAG 검색 컨텍스트 |
| 퀴즈 정보 | `<quiz_info>` | 퀴즈 정답 정보 (있을 때만, 신규) |

- `learningSummary`, `recommendedQuestions`는 JSON 파싱하여 포맷팅
- `learningContext`가 없으면 해당 섹션 생략
- `quizContext`가 빈 문자열이면 `<quiz_info>` 생략

#### 3. `chat()` 수정 (비스트리밍 경로)

```javascript
// Before: 2단계 병렬
const [contentResult, queryEmbedding] = await Promise.all([...]);
const [searchResults, chatHistory] = await Promise.all([...]);

// After: 학습 데이터 + 퀴즈 컨텍스트 병렬 추가
const [contentResult, queryEmbedding, learningData] = await Promise.all([
  this.getSessionContentIdsAndParent(currentSessionId),
  this.embeddingService.embed(message),
  this.getSessionLearningData(currentSessionId)    // 추가
]);
const [searchResults, chatHistory, quizContext] = await Promise.all([
  this.searchSimilarDocuments(...),
  this.getChatHistory(currentSessionId, 6),
  this.getQuizContext(allowedContentIds)            // 추가 (기존 미호출)
]);
```

- `generateResponse()` 호출 시 `learningData`, `quizContext` 전달

#### 4. `generateResponse()` 수정

```javascript
// Before
async generateResponse(question, context, chatHistory = []) {
  const systemPrompt = `${this.persona}\n\n규칙:...`;  // 하드코딩

// After
async generateResponse(question, context, chatHistory = [], { learningData = {}, quizContext = '' } = {}) {
  const systemPrompt = this.buildSystemPrompt({        // 중앙화
    context, learningGoal, learningSummary, recommendedQuestions, quizContext
  });
```

#### 5. `prepareChatContext()` 수정 (스트리밍 경로)

`chat()`과 동일한 패턴으로 수정:
- 1단계 병렬에 `getSessionLearningData` 추가
- 2단계 병렬에 `getQuizContext` 추가
- 하드코딩 프롬프트 → `this.buildSystemPrompt()` 호출

#### 6. `getQuizContext()` 반환값 정리

```javascript
// Before: 앞에 불필요한 구분자 포함
return `\n\n---\n\n[퀴즈 정답 정보 - ...]\n${quizLines.join('\n')}`;

// After: <quiz_info> 태그 안에 들어가므로 구분자 제거
return `[퀴즈 정답 정보 - ...]\n${quizLines.join('\n')}`;
```

---

### 성능 영향

| 항목 | 내용 |
|------|------|
| 추가 DB 쿼리 | `getSessionLearningData` 1~2회 + `getQuizContext` 1회 |
| 지연 영향 | 기존 `Promise.all` 병렬 처리에 합류, 사실상 0ms (D1 ~5-10ms vs 임베딩 ~100-300ms) |
| 토큰 증가 | `<learning_context>` ~150-300, `<output_format>` ~80, `<quiz_info>` ~200-500 토큰 |

---

### 배포

| 환경 | 상태 |
|------|------|
| malgn-chatbot-api-user1 | 배포 완료 |
| malgn-chatbot-api-user2 | 배포 완료 |

---

### 검증 체크리스트

- [ ] 학습 데이터 있는 세션 채팅 → `<learning_context>` 포함 확인
- [ ] 퀴즈가 있는 세션 채팅 → `<quiz_info>` 포함 확인
- [ ] 학습 데이터 없는 세션 → `<learning_context>` 생략, 나머지 정상
- [ ] 자식 세션 → 부모의 학습 데이터 정상 사용
- [ ] 출력 형식 개선 확인 (볼드, 목록 등)
