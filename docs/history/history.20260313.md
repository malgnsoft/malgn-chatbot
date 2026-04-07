# 변경사항 - 2026.03.13

## 채팅 UX 고도화 + 웰컴 메시지 + 대시보드 미리보기 동기화

채팅 인터페이스의 핵심 UX 개선: 마크다운 렌더링, 줄바꿈 지원, 웰컴 메시지, 대시보드-위젯 동기화.

---

### 1. AI 응답 마크다운 렌더링

#### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `js/chat.js` | `formatContent()` 마크다운 파서 구현 (대시보드) |
| `js/embed/utils.js` | `formatContent()` 마크다운 파서 구현 (임베드 위젯) |
| `css/chatbot.css` | 코드블록, 인라인코드, 리스트, HR 등 스타일 추가 |

#### 지원 마크다운 문법

| 문법 | 렌더링 |
|------|--------|
| `# ~ ####` | `<strong class="chatbot-h1~h4">` |
| `**텍스트**` | `<strong>` (볼드) |
| `*텍스트*` | `<em>` (이탈릭) |
| `` `코드` `` | `<code class="chatbot-inline-code">` |
| ```` ```코드블록``` ```` | `<pre class="chatbot-code-block">` |
| `- 항목` / `* 항목` | `<ul><li>` |
| `1. 항목` | `<ol><li>` |
| `---` / `***` | `<hr class="chatbot-hr">` |

#### 파싱 전략 (보호-파싱-복원)

```
1. 코드 블록(```)을 플레이스홀더로 보호
2. 인라인 코드(`)를 플레이스홀더로 보호
3. 라인별 마크다운 파싱 (헤더, 리스트, HR 등)
4. 인라인 포맷팅 (볼드, 이탈릭)
5. 플레이스홀더를 원래 코드로 복원
```

---

### 2. 줄바꿈 지원 (Shift+Enter)

| 파일 | 변경 내용 |
|------|-----------|
| `js/embed/chat.js` | textarea에 keydown 이벤트, Shift+Enter → 줄바꿈, Enter → 전송 |
| `js/chat.js` | 대시보드 채팅에도 동일 적용 |
| `css/chatbot.css` | textarea 자동 높이 조절 (최대 5줄) |

- 사용자 메시지의 `\n`을 `<br>`로 변환하여 줄바꿈 표시

---

### 3. AI 응답 간결하게 조정

| 파일 | 변경 내용 |
|------|-----------|
| `malgn-chatbot-api/src/services/chatService.js` | 시스템 프롬프트 규칙 조정 |

- `<rules>`에 "답변은 3~5문장으로 간결하게" 추가
- "예시는 1~2개만" 추가
- 불필요한 서론/결론 제거 유도

---

### 4. 웰컴 메시지 설정

#### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `js/settings.js` | `welcomeMessage` 설정 추가 (기본값: "안녕하세요! 무엇이든 질문해 주세요.") |
| `index.html` | 웰컴 메시지 textarea UI 추가 (AI 설정 패널 상단) |
| `js/app.js` | 임베드 코드에 `welcomeMessage` 포함 |
| `js/embed/index.js` | `cfg.welcomeMessage` 읽기 |
| `js/embed/chat.js` | `onSessionLoaded` 콜백에서 웰컴 메시지 시스템 메시지로 표시 |
| `css/chatbot.css` | `.chatbot-msg--system` 스타일 (중앙 정렬, 이탤릭) |

#### 동작

```
세션 로드 완료
    │
    ├── welcomeMessage 설정 있음
    │   └── 시스템 메시지로 채팅 영역 상단에 표시
    │
    └── welcomeMessage 없음
        └── 표시하지 않음
```

---

### 5. 관리자 대시보드 미리보기 동기화

대시보드의 챗봇 미리보기가 실제 임베드 위젯과 동일하게 동작하도록 동기화.

| 파일 | 변경 내용 |
|------|-----------|
| `js/app.js` | 미리보기에서 실제 API 호출, 설정 실시간 반영 |
| `js/chat.js` | 대시보드 채팅에서도 SSE 스트리밍 사용 |

- 설정 변경 시 미리보기에 즉시 반영
- Layer/Inline 모드 전환 시 미리보기 레이아웃 변경
