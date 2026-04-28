# Malgn Chatbot 원가 분석

> 작성일: 2026-04-28
> 기준 모델: `@cf/google/gemma-3-12b-it` (LLM), `@cf/baai/bge-m3` (임베딩)
> 환율: 1 USD ≈ 1,400 KRW

---

## 1. 비용 구성 요소

Malgn Chatbot의 원가는 다음 6가지로 구성됩니다.

| 항목 | 발생 시점 | 빈도 | 비고 |
|------|----------|------|------|
| **콘텐츠 임베딩** | 콘텐츠 등록 시 | 1회성 | bge-m3, 무료 등급 |
| **부모 세션 생성** | 강좌/차시 등록 시 | 1회성 | 모든 수강생이 공유 |
| **자식 세션 생성** | 수강생 첫 접속 시 | 수강생×차시 | **AI 호출 0회 (무료)** |
| **채팅 (RAG + LLM)** | 학생 질문 시 | 매 채팅마다 | 주요 비용 |
| **잘림 자동 요약** | 응답 잘림 시 | 채팅의 ~10% | 채팅 1회 추가 |
| **인프라 (D1/KV/Vectorize)** | 모든 요청 | 무시 가능 | 수만 건/월까지 무료 |

---

## 2. 부모 세션 생성 비용

### 호출 패턴

부모 세션 1개 생성 시 LLM 호출은 **5~6회** 발생합니다.

| 호출 유형 | 입력/출력 토큰 | 평균 비용 (USD) | 용도 |
|----------|--------------|----------------|------|
| 학습 데이터 생성 | ~11,000 / ~700 | $0.0042 | 학습 목표/요약/추천 질문 (콘텐츠 컨텍스트 포함) |
| 4지선다 퀴즈 생성 | ~2,860 / ~400 | $0.0012 | 콘텐츠 기반 퀴즈 |
| OX 퀴즈 생성 | ~2,820 / ~200 | $0.0011 | 콘텐츠 기반 퀴즈 |
| 퀴즈 검증 | ~2,800 / ~190 | $0.0011 | 퀴즈 정답 검증 |
| 보조 호출 | ~540 / ~45 | $0.0002 | 추가 검증/짧은 호출 |
| 세션명 생성 | ~300 / ~36 | $0.00013 | 세션 자동 명명 |
| **합계** | — | **$0.00776** | **약 ₩11/세션** |

### 비용 비중

```
학습 데이터 생성:  $0.0042 (54%)
퀴즈 생성/검증:   $0.0034 (44%)
세션명/기타:     $0.0002 (2%)
```

### 측정 데이터 (실제 로그 기반)

| 샘플 | LLM 호출 수 | 합계 (USD) |
|------|-----------|-----------|
| 세션 1 | 6회 | $0.00835 |
| 세션 2 | 5회 | $0.00702 |
| 세션 3 | 6회 | $0.00790 |
| **평균** | — | **$0.00776** |

---

## 3. 자식 세션 생성 비용

자식 세션은 부모의 학습 데이터/콘텐츠를 그대로 공유하므로 **AI 호출이 0회**입니다.

| 항목 | 비용 |
|------|------|
| DB INSERT (TB_SESSION) | 무시 가능 |
| LLM 호출 | **$0** |
| **합계** | **$0** |

---

## 4. 채팅 1회 비용

### 호출 패턴

```
사용자 질문
  ↓
1단계: 질문 임베딩 (bge-m3, 무료)
  ↓
2단계: Vectorize 유사 문서 검색 (top 5)
  ↓
3단계: 시스템 프롬프트 + RAG + 히스토리 + 질문 → LLM 호출
  ↓
4단계: 응답 후처리 (sanitize)
  ↓ (잘림 감지 시)
5단계: 자동 요약 재생성 (LLM 추가 호출)
```

### 토큰 분석

| 입력 구성 | 토큰 |
|----------|------|
| 시스템 프롬프트 (페르소나 + 규칙) | ~1,500 |
| RAG 컨텍스트 (top 5 청크) | ~2,000 |
| 채팅 히스토리 (최근 5턴) | ~500 |
| 사용자 질문 | ~50 |
| **입력 합계** | **~4,050** |
| 출력 (평균 응답) | ~500 |
| **총 토큰** | **~4,550** |

### 비용 산정

| 항목 | 평균 비용 |
|------|---------|
| 채팅 1회 | **$0.0017 (₩2.4)** |
| 잘림 자동 요약 1회 | $0.0005 |
| 잘림 발생률 | ~10% |
| **잘림 보정 평균 채팅 비용** | **$0.0018 (₩2.5)** |

---

## 5. 수강생 1명당 비용 (예시 시나리오)

### 시나리오 가정

- 10강좌 × 20차시 = **200차시** (200개 부모 세션)
- 한 수강생 = 1강좌 = 20차시
- 차시당 채팅 20회 = **수강생당 400회 채팅**

### 항목별 계산

| 항목 | 계산 | 비용 (USD) | 비용 (KRW) |
|------|-----|-----------|-----------|
| 부모 세션 분담 (수강생 100명) | $1.55 / 100 | $0.0155 | ₩22 |
| 자식 세션 (20개) | 0 | $0 | ₩0 |
| 채팅 (400회) | 400 × $0.0017 | $0.68 | ₩952 |
| 잘림 자동 요약 (40회, 10%) | 40 × $0.0005 | $0.02 | ₩28 |
| **수강생 1인당 합계** | — | **$0.72** | **₩1,002** |

### 수강생 수에 따른 단가 변화

| 수강생 수 | 부모 세션 분담 | 채팅 + 요약 | **1인당 총비용** |
|----------|:-:|:-:|:-:|
| 100명 | $0.016 | $0.70 | **$0.72 (₩1,000)** |
| 500명 | $0.003 | $0.70 | **$0.70 (₩980)** |
| 1,000명 | $0.0016 | $0.70 | **$0.70 (₩980)** |
| 10,000명 | $0.0002 | $0.70 | **$0.70 (₩980)** |

수강생이 많아질수록 부모 세션 비용이 분산되어 **1인당 약 ₩1,000 이내**로 수렴합니다.

---

## 6. 전체 시스템 운영 비용

### 1회성 비용 (서비스 셋업)

| 항목 | 계산 | 비용 (USD) | 비용 (KRW) |
|------|-----|-----------|-----------|
| 200차시 부모 세션 생성 | 200 × $0.00776 | $1.55 | ₩2,170 |
| 콘텐츠 임베딩 | 무료 등급 | $0 | ₩0 |

### 월 운영 비용 (수강생 활동)

| 활성 수강생 수 | 채팅 누적 비용 | 부모 세션 (1회성) | **월 합계 (KRW)** |
|--------------|--------------|----------------|-------------------|
| 100명 | $70 | $1.55 | **₩100,000** |
| 500명 | $350 | $1.55 | **₩492,000** |
| 1,000명 | $700 | $1.55 | **₩982,000** |
| 5,000명 | $3,500 | $1.55 | **₩4,902,000** |

> 부모 세션은 1회 생성 후 재사용되므로, 월간 채팅 비용이 운영비의 99% 이상을 차지합니다.

---

## 7. 가격 변동 리스크

이 문서의 단가는 **2026년 4월 기준 Cloudflare Workers AI 가격**을 사용합니다.

| 모델 | 입력 (per 1M) | 출력 (per 1M) |
|------|--------------|--------------|
| Gemma 3 12B | ~$0.345 | ~$0.556 |
| Llama 3.1 8B | ~$0.282 | ~$0.272 |
| bge-m3 (임베딩) | ~$0.012 | — |

> Cloudflare는 Neurons 기반 과금이며, 모델별 환산율이 다릅니다.
> 실제 비용은 AI Gateway 대시보드에서 확인하세요.

---

## 8. 산정 방법론 검증

이 문서의 추정치는 **2026-04-28 운영 환경 실측 로그**를 기반으로 작성되었습니다.

### 측정 방법

1. **부모 세션 생성**: 동일 lesson에서 3회 연속 생성하여 호출 패턴 분석
2. **채팅 비용**: AI Gateway에서 채팅 1회당 평균 토큰 측정
3. **자식 세션**: 코드 분석으로 AI 호출 0회 확인
4. **잘림 발생률**: 운영 로그에서 `chat_summary` 비율로 추정 (10%)

### 추정 정확도

| 항목 | 정확도 |
|------|-------|
| 부모 세션 생성 비용 | ±15% (콘텐츠 길이에 따라 변동) |
| 채팅 1회 비용 | ±30% (질문/응답 길이에 따라 변동) |
| 잘림 발생률 | ±50% (질문 복잡도에 따라 변동) |
| **수강생 1인당 총비용** | **±20% (약 ₩800~₩1,200)** |

---

## 9. 비용 추적 방법

### TB_AI_LOG 테이블 활용

`TB_AI_LOG` 테이블은 호출별 토큰 수와 추정 비용(`estimated_cost`)을 사전 계산하여 저장합니다.
멀티테넌트 환경이므로 모든 쿼리는 `site_id` 기준으로 필터링/집계합니다.

**업체(site_id)별 월간 비용 집계**

```sql
SELECT
  site_id,
  COUNT(*) AS calls,
  SUM(total_tokens) AS total_tokens,
  ROUND(SUM(estimated_cost)::numeric, 4) AS estimated_cost_usd,
  ROUND(SUM(estimated_cost)::numeric * 1400, 0) AS estimated_cost_krw
FROM TB_AI_LOG
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY site_id
ORDER BY estimated_cost_usd DESC;
```

**특정 업체의 일별 비용 추이 (request_type별)**

```sql
SELECT
  DATE(created_at) AS date,
  request_type,
  COUNT(*) AS calls,
  SUM(prompt_tokens) AS prompt_tokens,
  SUM(completion_tokens) AS completion_tokens,
  ROUND(SUM(estimated_cost)::numeric, 6) AS estimated_cost_usd
FROM TB_AI_LOG
WHERE site_id = :site_id
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), request_type
ORDER BY date DESC, request_type;
```

**특정 업체의 세션별 누적 비용 (Top 20)**

```sql
SELECT
  session_id,
  COUNT(*) AS calls,
  SUM(total_tokens) AS total_tokens,
  ROUND(SUM(estimated_cost)::numeric, 6) AS estimated_cost_usd
FROM TB_AI_LOG
WHERE site_id = :site_id
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY session_id
ORDER BY estimated_cost_usd DESC
LIMIT 20;
```

**특정 업체의 모델별 사용량 / 비용 분포**

```sql
SELECT
  model,
  request_type,
  COUNT(*) AS calls,
  ROUND(AVG(latency_ms)::numeric, 0) AS avg_latency_ms,
  SUM(total_tokens) AS total_tokens,
  ROUND(SUM(estimated_cost)::numeric, 6) AS estimated_cost_usd
FROM TB_AI_LOG
WHERE site_id = :site_id
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY model, request_type
ORDER BY estimated_cost_usd DESC;
```

**업체별 월간 청구 산정 (운영비 +α 마진 적용 예시)**

```sql
SELECT
  site_id,
  ROUND(SUM(estimated_cost)::numeric, 4) AS cost_usd,
  ROUND(SUM(estimated_cost)::numeric * 1400, 0) AS cost_krw,
  ROUND(SUM(estimated_cost)::numeric * 1400 * 1.5, 0) AS billing_krw_with_margin_50
FROM TB_AI_LOG
WHERE created_at >= DATE_TRUNC('month', NOW())
GROUP BY site_id
ORDER BY cost_krw DESC;
```

### Cloudflare AI Gateway 대시보드

- URL: `https://dash.cloudflare.com/<account>/ai/ai-gateway/<gateway-id>`
- 게이트웨이 ID: `malgn-chatbot`
- 실시간 토큰/비용 추적 가능
