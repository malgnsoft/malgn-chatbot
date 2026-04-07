# 변경사항 - 2026.03.12

## Shadow DOM CSS 격리 + UI 디자인 리뉴얼 + userId/lesson_id 지원

3가지 주요 작업: (1) 임베드 위젯의 Shadow DOM CSS 격리, (2) 탭 콘텐츠 디자인 전면 리뉴얼, (3) userId 지원 및 세션 중복 체크에 lesson_id 반영.

---

### 1. Shadow DOM CSS 격리

LMS 호스트 페이지의 CSS가 챗봇 위젯에 영향을 주는 문제를 해결하기 위해 Shadow DOM 적용.

#### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `js/embed/ui.js` | Shadow DOM 생성 (`attachShadow({ mode: 'open' })`) |
| `js/embed/index.js` | Shadow root를 각 매니저에 전달 |
| `js/embed/chat.js` | DOM 쿼리를 `this.root.querySelector()`로 변경 |
| `js/embed/tabs.js` | 동일 |
| `js/embed/quiz.js` | 동일 |
| `css/chatbot.css` | `:host` 스코프 변수, CSS 리셋 추가 |

#### Shadow DOM 구조

```
<div id="malgn-chatbot-host">
  #shadow-root (open)
    <style>chatbot.css 내용</style>
    <link rel="stylesheet" href="bootstrap-icons CDN">
    <button class="chat-fab">          (layer 모드만)
    <div class="chatbot">
      header / tabs / body / footer
    </div>
```

#### 해결한 문제들

1. **CSS 상속 차단**: `color`, `font-family`, `font-size`, `line-height` 등 상속 속성이 호스트에서 Shadow DOM으로 전파되는 문제
2. **폰트 크기 문제**: `rem` 단위가 호스트의 `html { font-size }` 영향을 받는 문제 → `:host`에서 `font-size: 14px` 기준 설정 후 `rem` 유지
3. **양방향 격리**: 챗봇 CSS가 호스트 페이지에 영향을 주지 않음

---

### 2. 탭 콘텐츠 디자인 리뉴얼

#### 변경사항 (css/chatbot.css)

| 탭 | 변경 |
|----|------|
| 탭 바 | 활성 탭 언더라인을 텍스트 길이에 맞게 확장 (`fit-content`) |
| 탭 메뉴명 | "목표/요약/추천/퀴즈" → "학습 목표/학습 요약/추천 질문/퀴즈" |
| 탭 콘텐츠 | 배경색 흰색 변경, 구분선 좌우 마진 추가 |
| 요약 | 테두리 제거, 숫자 배지를 네모 박스 스타일로 변경 |
| 추천 질문 | 퍼플 테마 적용 (배경, 테두리, 배지, 제목) |
| 퀴즈 | 민트 배지, 사각 버튼으로 리뉴얼 |

#### 퀴즈 탭 UX 변경

- 퀴즈 탭 선택 시 **채팅 영역(메시지 + 입력창) 숨김** → 퀴즈에 집중
- 다른 탭 선택 시 채팅 영역 다시 표시

---

### 3. userId 지원 및 lesson_id 중복 체크

#### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `malgn-chatbot/js/embed/index.js` | `cfg.userId` 읽기 |
| `malgn-chatbot/js/embed/chat.js` | `ensureSession()`에 `userId` 전달 |
| `malgn-chatbot/js/embed/api.js` | `createSession()`에 `user_id` 파라미터 추가 |
| `malgn-chatbot/js/app.js` | 임베드 코드에 `userId` 포함 |
| `malgn-chatbot-api/src/routes/sessions.js` | 자식 세션 중복 체크에 `lesson_id` 조건 추가 |

#### 세션 중복 체크 변경

```sql
-- Before: parent_id + course_user_id만 확인
SELECT * FROM TB_SESSION WHERE parent_id = ? AND course_user_id = ? AND status = 1

-- After: lesson_id도 포함 (같은 학습자가 다른 차시에서 별도 세션)
SELECT * FROM TB_SESSION WHERE parent_id = ? AND course_user_id = ? AND lesson_id = ? AND status = 1
```

---

### 4. 배포

| 환경 | 상태 |
|------|------|
| malgn-chatbot (Pages) | 배포 완료 |
| malgn-chatbot-api user1 | 배포 완료 |
| malgn-chatbot-api user2 | 배포 완료 |
