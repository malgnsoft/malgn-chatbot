# 변경사항 - 2026.03.17

## 추천 질문 Q&A 쌍 생성

추천 질문을 단순 질문 텍스트에서 **질문+답변 쌍(Q&A)**으로 확장. 학습자가 답변을 토글로 확인 가능.

---

### 1. API 변경 (malgn-chatbot-api)

| 파일 | 변경 내용 |
|------|-----------|
| `src/services/learningService.js` | 추천 질문 생성 시 answer 필드 포함하도록 프롬프트 변경 |

#### 학습 데이터 생성 프롬프트 변경

```
Before: recommendedQuestions: ["질문1", "질문2", "질문3"]
After:  recommendedQuestions: [
          { "question": "질문1", "answer": "답변1 (4~6문장)" },
          { "question": "질문2", "answer": "답변2" },
          { "question": "질문3", "answer": "답변3" }
        ]
```

#### 답변 보충 로직 (`generateAnswersForQuestions`)

LLM이 answer를 생략하거나 불충분하게 생성할 경우 **2차 LLM 호출**로 답변 보충:

```
1차 LLM 호출 → recommendedQuestions 파싱
    │
    ├── 모든 Q&A에 answer 있음 → 완료
    │
    └── answer 누락된 항목 있음
        └── 2차 LLM 호출: generateAnswersForQuestions()
            → 컨텍스트 기반으로 빠진 답변만 생성
            → 원래 questions 배열에 매핑
```

---

### 2. 프론트엔드 변경 (malgn-chatbot)

| 파일 | 변경 내용 |
|------|-----------|
| `js/chat.js` | 추천 질문 렌더링에 Q&A 토글 UI 추가 (대시보드) |
| `js/embed/tabs.js` | `renderLearningData()`에서 Q&A 토글 렌더링 (임베드) |
| `css/chatbot.css` | `.chatbot-qa-toggle`, `.chatbot-qa-answer` 스타일 |

#### 추천 질문 렌더링 로직

```javascript
// Q&A 쌍인 경우 (answer 있음)
<div class="chatbot-recommend-item">
  <span class="chatbot-badge">1</span>
  <span class="chatbot-qa-toggle" data-question="질문1">
    질문1
    <i class="bi bi-chevron-down"></i>
  </span>
  <div class="chatbot-qa-answer" style="display:none">
    답변1
  </div>
</div>

// 질문만 있는 경우 (answer 없음, 하위 호환)
<div class="chatbot-recommend-item" data-question="질문1">
  <span class="chatbot-badge">1</span>
  질문1
</div>
// → 클릭 시 채팅으로 질문 자동 전송 (기존 동작 유지)
```

#### 토글 동작

- Q&A 쌍: 클릭 → 답변 영역 토글 (show/hide)
- 질문만: 클릭 → 채팅 입력란에 질문 전송 (기존 동작)

---

### 3. DB 변경

- TB_SESSION.recommended_questions 컬럼의 JSON 형식 변경
- 기존 `["질문1", "질문2"]` → `[{"question":"질문1","answer":"답변1"}, ...]`
- 기존 데이터와 하위 호환: 문자열 배열도 정상 처리
