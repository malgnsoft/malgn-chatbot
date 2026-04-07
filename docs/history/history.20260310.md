# 변경사항 - 2026.03.10

## 링크 콘텐츠 문서 추출 확장

기존 HTML 텍스트 추출만 지원하던 `uploadLink`에 PDF, Word(DOCX), PowerPoint(PPTX) 문서 텍스트 추출 기능 추가.

---

### 수정 파일

| 파일 | 작업 |
|------|------|
| `malgn-chatbot-api/src/services/contentService.js` | **수정** - uploadLink() 문서 추출 확장 |

### 상세 변경

#### `uploadLink()` 콘텐츠 타입 감지 로직

```
URL 접속 → Content-Type 확인 + URL 확장자 확인
    │
    ├── .srt / .vtt → extractTextFromSubtitle()
    ├── .pdf / application/pdf → extractDocumentText() (신규)
    ├── .docx / .pptx → extractDocumentText() (신규)
    ├── text/html → extractTextFromHtml()
    └── text/* → 원문 그대로
```

- 기존: HTML과 자막 파일만 텍스트 추출 가능
- 변경: PDF, Word, PowerPoint 문서도 URL로 등록 시 텍스트 자동 추출
- Workers AI의 문서 텍스트 추출 기능 활용
