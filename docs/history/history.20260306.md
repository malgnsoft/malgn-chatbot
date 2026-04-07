# 변경사항 - 2026.03.06

## TB_CONTENT lesson_id 추가 및 콘텐츠 필터링

LMS 차시(lesson)별 콘텐츠 분류를 위해 TB_CONTENT에 lesson_id를 추가하고, 콘텐츠 목록 조회 시 필터링 기능을 구현.

---

### 1. DB 마이그레이션

| 파일 | 작업 |
|------|------|
| `malgn-chatbot-api/migrations/004_content_lesson_id.sql` | **신규** - TB_CONTENT에 lesson_id 컬럼 + 인덱스 추가 |
| `malgn-chatbot-api/schema.sql` | **수정** - lesson_id 반영 |

```sql
ALTER TABLE TB_CONTENT ADD COLUMN lesson_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_content_lesson_id ON TB_CONTENT(lesson_id);
```

---

### 2. API 변경 (malgn-chatbot-api)

#### 2-1. `src/routes/contents.js`

| 엔드포인트 | 변경 내용 |
|------------|-----------|
| `GET /contents` | `lesson_id`, `file_type` 쿼리 파라미터 추가 (필터링) |
| `POST /contents` | `lesson_id` 파라미터 지원 (텍스트/파일/링크 모두) |
| `PUT /contents/:id` | `lesson_id` 수정 지원 |

#### 2-2. `src/services/contentService.js`

- `listContents(page, limit, lessonId, fileType)`: 동적 WHERE 절로 필터 조건 조합
- `uploadText()`, `uploadFile()`, `uploadLink()`: lesson_id 파라미터 추가
- `updateContent()`: lesson_id 업데이트 지원

---

### 3. 버그 수정

- **session userId 타입 수정**: `user_id` 타입을 `string` → `integer`로 변경
- **필터 없을 때 bind() 오류**: 필터 조건이 없을 때 빈 배열로 bind() 호출 시 발생하는 오류 수정

---

### 4. 프론트엔드 변경 (malgn-chatbot)

| 파일 | 변경 내용 |
|------|-----------|
| `CLAUDE.md` | TB_CONTENT lesson_id 관련 문서 반영 |
