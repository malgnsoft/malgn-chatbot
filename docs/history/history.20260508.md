# 변경사항 - 2026.05.08

## 테넌트 프론트엔드 자체 호스팅 전환 (cloud, secbiz) + CLAUDE.md 테넌트 등재

> **참고**: 전날(2026-05-07) 문서 일괄 현행화 작업은 [history.20260507.md](history.20260507.md). 본 작업은 그 후속으로, 실제 배포 환경 점검 중 발견한 의존성 문제를 해결.

---

### 1. 문제 진단

사용자가 `https://malgn-chatbot-cloud.pages.dev/js/chatbot-embed.js`에 직접 접근했을 때 JavaScript 코드가 아닌 **챗봇 페이지(index.html)가 렌더링되어 표시**되는 현상 보고.

#### 원인

각 테넌트(user1, cloud, secbiz) 배포본의 `index.html`이 **메인 도메인(`malgn-chatbot.pages.dev`) 의존**으로 설정되어 있었음:

```html
<link rel="stylesheet" href="https://malgn-chatbot.pages.dev/css/chatbot.css">
<script src="https://malgn-chatbot.pages.dev/js/chatbot-embed.js"></script>
```

테넌트 디렉토리 자체에는 `js/` 폴더와 `css/chatbot.css`가 없으므로, 테넌트 도메인에서 `/js/chatbot-embed.js` 직접 접근 시:

1. 해당 경로에 파일 없음
2. Cloudflare Pages가 SPA fallback으로 `index.html` 반환
3. 결과: JS 파일 자리에 챗봇 페이지가 렌더링되어 사용자 혼란

**실제 챗봇 동작은 정상**(메인 도메인에서 fetch). 단, 직접 URL 접근 디버깅·검증 시 혼선 발생.

---

### 2. cloud 테넌트 자체 호스팅 전환

메인 도메인 의존성을 제거하고 cloud 도메인에서 모든 정적 자산을 직접 호스팅하도록 전환.

#### 작업 내역

```bash
cd /Users/dotype/Projects/malgn-chatbot && npm run build  # 51.2KB
cp js/chatbot-embed.js ../malgn-chatbot-cloud/js/
cp css/chatbot.css ../malgn-chatbot-cloud/css/
```

`malgn-chatbot-cloud/index.html`의 절대 URL → 상대 경로 변경:

| 자원 | Before | After |
|------|--------|-------|
| chatbot.css | `https://malgn-chatbot.pages.dev/css/chatbot.css` | `./css/chatbot.css` |
| chatbot-embed.js | `https://malgn-chatbot.pages.dev/js/chatbot-embed.js` | `./js/chatbot-embed.js` |

#### 배포

```bash
CLOUDFLARE_ACCOUNT_ID=d2b8c5524b7259214fa302f1fecb4ad6 wrangler pages deploy . \
  --project-name=malgn-chatbot-cloud --commit-dirty=true \
  --commit-message="bundle js+css for independent hosting"
```

배포 완료 — Production: https://malgn-chatbot-cloud.pages.dev

#### 발견 이슈

- `wrangler pages deploy`는 wrangler.toml 없이 실행되므로 `account_id` 자동 인식 불가
- 본 계정에 두 개의 Cloudflare account(`Info@malgnsoft.com`, `Chhwi@malgnsoft.com`) 연결되어 있어 비대화 모드에서 선택 실패
- → `CLOUDFLARE_ACCOUNT_ID` 환경변수로 명시 필요. 메모리에 저장하여 향후 자동 적용

---

### 3. secbiz 테넌트 자체 호스팅 전환

cloud와 동일한 방식으로 secbiz도 전환.

```bash
cp js/chatbot-embed.js ../malgn-chatbot-secbiz/js/
cp css/chatbot.css ../malgn-chatbot-secbiz/css/
# index.html 절대 URL → 상대 경로
wrangler pages deploy . --project-name=malgn-chatbot-secbiz ...
```

배포 완료 — Production: https://malgn-chatbot-secbiz.pages.dev

---

### 4. user1 테넌트는 현재 구조 유지

사용자 요청에 따라 user1은 메인 도메인 의존 구조 유지. 배포 시도 중 다음을 확인:

- Cloudflare Pages 프로젝트 목록에 `malgn-chatbot-user1` 미존재
- 메인 프로젝트 `malgn-chatbot`의 실제 도메인은 **`malgn-chatbot-8np.pages.dev`** (alias로 `malgn-chatbot.pages.dev`도 동작 중인 것으로 추정)

---

### 5. CLAUDE.md 테넌트 등재 (secbiz 추가)

신규 테넌트 secbiz를 CLAUDE.md에 등재하고, 각 테넌트의 호스팅 방식을 명시:

| 위치 | 변경 |
|------|------|
| 저장소 구조 | `malgn-chatbot-secbiz/` 디렉토리 추가, cloud/user1/secbiz 호스팅 방식 명시 |
| 멀티테넌트 배포 | 현재 테넌트 목록에 `secbiz` 추가 (전용 MySQL/Hyperdrive 독립) |
| 빌드 & 배포 | `wrangler deploy --env secbiz` 명령 추가 + `./scripts/deploy.sh --all` 일괄 배포 안내 |

또한 wrangler.toml 점검 결과 `[env.user2]` 섹션은 이미 제거되었고 `[env.secbiz]`가 정상 등록되어 있음을 확인.

---

## 결과

| 항목 | 결론 |
|------|------|
| **cloud, secbiz 독립성** | 메인 도메인(`malgn-chatbot.pages.dev`) 장애 시에도 독립 동작 가능 |
| **user1** | 의도적으로 메인 의존 유지 (사용자 결정) |
| **CLAUDE.md 정합성** | 4개 테넌트(dev/user1/cloud/secbiz) 정확히 등재, 호스팅 방식별 차이 명시 |
| **배포 자동화** | Cloudflare Pages 배포 시 `CLOUDFLARE_ACCOUNT_ID` 환경변수 필요 사실 메모리화 |

---

## 향후 임베드 위젯 갱신 절차

cloud 또는 secbiz의 chatbot-embed.js/chatbot.css를 갱신할 때:

```bash
# 1. 메인에서 빌드
cd /Users/dotype/Projects/malgn-chatbot && npm run build

# 2. 대상 테넌트로 복사 (예: cloud)
cp js/chatbot-embed.js ../malgn-chatbot-cloud/js/
cp css/chatbot.css ../malgn-chatbot-cloud/css/

# 3. 배포
cd ../malgn-chatbot-cloud
CLOUDFLARE_ACCOUNT_ID=d2b8c5524b7259214fa302f1fecb4ad6 \
  wrangler pages deploy . --project-name=malgn-chatbot-cloud \
  --commit-dirty=true --commit-message="update embed"
```

---

### 변경 파일

**malgn-chatbot (frontend repo)**
- `CLAUDE.md` (저장소 구조 + 멀티테넌트 + 배포 명령 갱신)
- `docs/history/history.20260508.md` (신규, 본 문서)
- `docs/history/README.md` (인덱스 항목 추가)

**malgn-chatbot-cloud (배포본, git 비관리)**
- `index.html` (절대 URL → 상대 경로)
- `js/chatbot-embed.js` (신규 51KB)
- `css/chatbot.css` (신규 24KB)

**malgn-chatbot-secbiz (배포본, git 비관리)**
- `index.html` (절대 URL → 상대 경로)
- `js/chatbot-embed.js` (신규 51KB)
- `css/chatbot.css` (신규 24KB)

**Cloudflare Pages 배포 (외부)**
- `malgn-chatbot-cloud` 프로젝트 새 배포본
- `malgn-chatbot-secbiz` 프로젝트 새 배포본
