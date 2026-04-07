# 변경사항 - 2026.03.11

## quiz_count를 choice_count + ox_count로 분리

기존 단일 `quiz_count`를 4지선다(`choice_count`)와 OX퀴즈(`ox_count`)로 분리하여 퀴즈 유형별 개수를 독립 설정 가능하게 변경.

---

### 1. DB 마이그레이션

| 파일 | 작업 |
|------|------|
| `malgn-chatbot-api/migrations/005_session_quiz_split.sql` | **신규** - choice_count, ox_count 컬럼 추가 |

```sql
ALTER TABLE TB_SESSION ADD COLUMN choice_count INTEGER DEFAULT 3;
ALTER TABLE TB_SESSION ADD COLUMN ox_count INTEGER DEFAULT 2;
```

---

### 2. API 변경 (malgn-chatbot-api)

| 파일 | 변경 내용 |
|------|-----------|
| `src/routes/sessions.js` | POST/PUT에서 `choiceCount`, `oxCount` 개별 처리 |
| `src/services/quizService.js` | `generateQuizzesForContent()`에서 choice/ox 개별 count 사용 |
| `src/openapi.js` | `choiceCount`, `oxCount` 파라미터 문서화 |

#### 퀴즈 생성 흐름 변경

```
Before: generateQuizzesForContent(contentId, content, { count: 5 })
  → choice 3개 + ox 2개 (고정 비율)

After: generateQuizzesForContent(contentId, content, { choiceCount: 3, oxCount: 2 })
  → choice와 ox를 독립적으로 설정
  → 하위 호환: count만 전달 시 자동 분배
```

---

### 3. 프론트엔드 변경 (malgn-chatbot)

| 파일 | 변경 내용 |
|------|-----------|
| `js/settings.js` | 퀴즈 설정을 `choiceCount`, `oxCount`로 분리 |
| `index.html` | 4지선다/OX 각각의 입력 UI 추가 |
| `js/embed/index.js` | settings에 `choiceCount`, `oxCount` 전달 |
