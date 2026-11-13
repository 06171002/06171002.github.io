---
title: "반품/교환(클레임)"
slug: "claims"
project: "b2b"
order: 4
domain: "거래"
keywords: ["헤더-라인-수거 3계층 상태머신","부분 클레임 금액 배분(잔여 비례+마지막 흡수)","마이너스 PO 정산","포인트 FIFO 환수"]
evidence: ["tested","measured"]
draft: false
cover: null
notionEditedAt: "2026-08-31"
description: null
glance: {"headline":"부분 반품을 몇 번 나눠도 환불 합계 = 원결제액 — 금액 배분 불변식 4개를 1만 회씩 검증했다","problem":["할인 · 쿠폰 · 포인트가 섞인 주문을 여러 번 나눠 반품하면 단가 × 수량 방식은 반올림 오차가 쌓인다. 실결제 33,333원인 상품 10개를 3 · 3 · 4개로 나눠 반품하면 합계가 1원 어긋난다.","반품 때 원 발주를 직접 고치면 공급사 정산 근거가 사라지고, 만료된 포인트를 되살리거나 동시에 두 번 복원할 위험도 있다."],"solution":["매 회차를 '남은 금액 ÷ 남은 수량' 기준으로 나누고(10원 단위 내림) 마지막 회차가 끝수를 흡수한다. 배분한 값은 저장해 환불 · 포인트 환수에 그대로 쓴다.","원 발주는 두고 음수 발주를 따로 만들어 정산 순액을 맞추고, 포인트는 최근 사용분부터 되돌리되 만료분은 손실로 따로 남긴다."],"result":["불변식 4개(합계 일치 · 잔여 음수 불가 · 10원 단위 · 소액 차원)를 각 1만 케이스 property 테스트로 검증해 10/10 통과. 기각한 대안(매번 원본 기준 재계산)은 같은 테스트의 5번째 시도에서 반례가 나왔다.","테스트를 짜다 실제 결함 3건(분할 이중 집계 · 전량 교환 후 0원 배분 · 반려 · 철회분 혼입)을 찾아 고쳤다. 동시 환수 20건 로컬 실측에서 이중 복원 0건."]}
leadFigure: {"light":"/content-assets/b2b/claims/diagram-4.light.svg","dark":"/content-assets/b2b/claims/diagram-4.dark.svg","alt":"부분 반품 금액 — 남은 금액 기준으로, 마지막이 끝수를 가져간다 다이어그램"}
---

## 한 클레임, 세 층 — 헤더 · 라인 · 수거

B2B 클레임은 환불 한 번으로 끝나지 않는다. 한 주문에 여러 공급사가 있고, 부분 출고 · 여신/포인트 결제 · 공급사 정산이 얽힌다. 배송 전 **취소**, 배송 후 **반품**(환불), **교환**(맞배송)을 한 클레임 모델로 다루되, 구매자 · 공급사 · 물류가 보는 단위가 달라 세 층으로 나눴다.

<figure class="diagram"><img src="/content-assets/b2b/claims/diagram-1.light.svg" alt="한 클레임, 세 층 — 헤더 · 라인 · 수거 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/claims/diagram-1.dark.svg" alt="한 클레임, 세 층 — 헤더 · 라인 · 수거 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- 라인은 공급사가 처리하는 단위다. 수거 → 검수 → 반송 · 재배송이 라인마다 따로 진행된다.
- 수거는 박스 단위다. 한 라인이 여러 박스로 나뉘어 출고되거나 여러 박스를 한 번에 합포장해 수거하면, 라인에만 송장을 달 경우 같은 박스에 송장이 겹친다. 송장은 수거 1건에 달고 그 아래 라인에 한꺼번에 전파한다.
- 헤더의 상태는 활성 라인 중 **가장 뒤처진 라인의 상태**다. 구매자에게는 늘 '지금 진행 중인 단계'가 보인다.\
  유형마다 상태가 다르다 — 취소 5개(물리 흐름 없음) · 반품 13개 · 교환 14개. 아래는 반품과 교환의 주요 흐름이다(그림에 없는 갈래도 있다).

<figure class="diagram"><img src="/content-assets/b2b/claims/diagram-2.light.svg" alt="한 클레임, 세 층 — 헤더 · 라인 · 수거 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/claims/diagram-2.dark.svg" alt="한 클레임, 세 층 — 헤더 · 라인 · 수거 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

<figure class="diagram"><img src="/content-assets/b2b/claims/diagram-3.light.svg" alt="한 클레임, 세 층 — 헤더 · 라인 · 수거 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/claims/diagram-3.dark.svg" alt="한 클레임, 세 층 — 헤더 · 라인 · 수거 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

---

## 부분 반품 금액 — 남은 금액 기준으로, 마지막이 끝수를 가져간다

할인 · 쿠폰 · 포인트가 섞인 실결제 33,333원짜리 상품 10개를 3 · 3 · 4개로 나눠 반품한다. 단가 × 수량으로 계산하면 회차마다 반올림 오차가 쌓여, 다 반품했는데 환불 합계가 원결제액과 1원 어긋난다.\
그래서 매 회차를 <strong>'남은 금액 ÷ 남은 수량'</strong> 기준으로 나누고(10원 단위 내림), <strong>마지막 회차가 남은 금액을 전부 가져간다.</strong>

<figure class="diagram"><img src="/content-assets/b2b/claims/diagram-4.light.svg" alt="부분 반품 금액 — 남은 금액 기준으로, 마지막이 끝수를 가져간다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/claims/diagram-4.dark.svg" alt="부분 반품 금액 — 남은 금액 기준으로, 마지막이 끝수를 가져간다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- 한 번 배분한 값은 라인에 저장해 환불 · 포인트 환수에 그대로 쓴다. 다시 계산하지 않는다.
- 금액 · 부가세 · 쿠폰 · 구매포인트 · 지급포인트 다섯 값에 같은 규칙을 쓴다.
- '이미 청구된 수량 · 금액'은 거절 · 철회를 뺀 활성 클레임만, 분할되지 않은 원본 라인 기준으로 센다. 이 집계도 따로 검증했다(12/12 — 거절 · 철회 제외, 분할 원본 이중 집계 방지, 기업 격리, 배송 단위 범위).\
  중간 회차는 정확한 비례값과 최대 10원까지 다를 수 있지만, 그 차이는 쌓이지 않고 마지막 회차에서 정산된다. <strong>판단 기준은 오차의 크기가 아니라 오차가 사라지느냐였다.</strong> 매번 원본 기준으로 다시 계산하는 안은 같은 검사에서 반례가 나왔다.

<figure class="diagram"><img src="/content-assets/b2b/claims/diagram-5.light.svg" alt="부분 반품 금액 — 남은 금액 기준으로, 마지막이 끝수를 가져간다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/claims/diagram-5.dark.svg" alt="부분 반품 금액 — 남은 금액 기준으로, 마지막이 끝수를 가져간다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

**검증** — 불변식 4개(전량 클레임 때 합계 = 원결제액 · 남은 금액은 음수가 되지 않는다 · 부분 회차는 10원 배수이고 정확한 비례값과 10원 미만 차이 · 쿠폰 · 포인트 같은 소액 값에서도 성립)를 jqwik property 테스트로 **각 10,000건**씩 돌려 10/10 통과했다. 생성 범위는 원결제액 ≤10억 × 수량 ≤300 × 분할 ≤10회. 기각한 안은 5번째 시도에서 반례가 나왔고(줄여 보니 위의 1원 · 2개), 무작위 원본 반례에서는 262,891원 · 58개 · 10회 분할의 합계가 262,890원으로 1원이 사라졌다. 두 반례와 33,333원 시나리오는 예시 테스트로 고정해, 나중에 '그냥 다시 계산하면 되지 않나'로 되돌리면 바로 깨진다.

---

## 반품 정산 — 원 발주는 두고 음수 발주를 더한다

반품 때 원 발주(PO)를 직접 고치면 발주 · 매출 이력이 사라지고, 부분 취소가 쌓이면 원래 금액을 되살릴 수 없다. 그래서 <strong>원 발주는 그대로 두고, 승인 때 음수(−) 발주를 따로 만든다.</strong>

<figure class="diagram"><img src="/content-assets/b2b/claims/diagram-6.light.svg" alt="반품 정산 — 원 발주는 두고 음수 발주를 더한다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/claims/diagram-6.dark.svg" alt="반품 정산 — 원 발주는 두고 음수 발주를 더한다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- 헤더 · 라인의 모든 금액을 음수로 맞춰 정산 합산이 깨지지 않는다. 결제금액은 부가세 포함이라 부가세를 따로 더하지 않는다(이중 계산 방지).
- 전체가 검수 불합격이면 마이너스 발주를 취소한다.
- 원 발주를 지웠다가 다시 만드는 안은 발주 연속성과 결제 · 배송 참조가 끊겨 고르지 않았다.

---

## 포인트 환수 — 최근 쓴 것부터, 만료분은 손실로

사용할 때는 유효했지만 클레임 때는 이미 만료된 포인트가 있다. 무조건 되살리면 만료 포인트가 부활하고, 무시하면 고객 손실을 추적할 수 없다. 그래서 사용 이력을 최근 것부터 거슬러 올라가며 되돌린다.

<figure class="diagram"><img src="/content-assets/b2b/claims/diagram-7.light.svg" alt="포인트 환수 — 최근 쓴 것부터, 만료분은 손실로 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/claims/diagram-7.dark.svg" alt="포인트 환수 — 최근 쓴 것부터, 만료분은 손실로 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- 결과는 실제 복원분(완료)과 만료 손실분(실패 · 사용기간 만료) 두 환불 행으로 남긴다. **실제 복원 + 만료 손실 = 환수 요청액**(보존식 property 2,000건 · 7/7 통과).
- 만료일 당일은 아직 유효하다. 유효한 버킷이 만료된 몫을 대신 복원하지 않는다.
- 두 환수가 같은 원장 행을 동시에 고치면 한쪽이 덮일 수 있어, 원장 행을 `FOR UPDATE` 로 잠근다.

<figure class="diagram"><img src="/content-assets/b2b/claims/diagram-8.light.svg" alt="포인트 환수 — 최근 쓴 것부터, 만료분은 손실로 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/claims/diagram-8.dark.svg" alt="포인트 환수 — 최근 쓴 것부터, 만료분은 손실로 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

2026-08-30 에 실제 동시 요청으로 쟀다. 판정은 HTTP 응답이 아니라 포인트 원장 잔액으로 했다 — 「주문/결제」 카드의 여신 실험과 같은 방식이다.

<div class="table-wrap">

| **실험**      | **구성**                              | **결과**                                               |
| ----------- | ----------------------------------- | ---------------------------------------------------- |
| 같은 주문 경합    | 한 주문에 취소 클레임 동시 20건                 | 성공 **1** · 거절 19 · 복원 **정확히 1회**(50,000)             |
| 같은 원장 버킷 경합 | 서로 다른 두 주문이 같은 버킷을 참조, 동시 20건(각 10) | 성공 **2** · 거절 18 · 잔액 **0 → 100,000** (= 50,000 × 2) |

</div>

<strong>이중 복원 0건 · 분실 갱신 0건.</strong>

---

## 검증이 잡은 결함 3건

불변식을 세우고 테스트를 짜다 보니 설계가 아니라 구현의 구멍이 드러났다. 세 곳 모두 고치고 테스트로 고정했다.

<div class="table-wrap">

| **결함**        | **무엇이 틀렸나**                                                                                | **고친 것**                                     |
| ------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------- |
| 분할 라인 이중 집계   | 가용수량 집계 쿼리에만 분할 원본 필터가 없어, 분할검수 뒤 부모와 자식이 함께 세어졌다(9 → 13). 정당한 추가 클레임이 '가용수량 초과'로 막힐 수 있었다 | 자매 쿼리와 같은 필터 · 회귀 테스트                        |
| 전량 교환 뒤 반품 0원 | 교환을 기청구 풀에서 빼지 않아, 전량 교환 뒤 재배송분을 반품하면 풀이 이미 비어 환불액이 0원이 됐다                                 | 수량과 금액 다섯 값이 함께 빠지게 · 수정 전 결함을 재현하는 테스트까지 남김 |
| 반려 · 철회분 혼입   | 발주 라인의 클레임 수량을 셀 때 헤더 조건이 없어, 반려 4 + 철회 5가 섞여 5가 아니라 14로 셌다                                | 클레임 헤더 축 조인을 강제 · 축 드리프트 가드 테스트              |

</div>

그 밖의 테스트 — 조각 집계 5 · 축 드리프트 가드 3 · 검수 차감 7 · 서비스주문 취소 구간 6 · 분할검수 금액 보존 2 · 결재 종결 3 · 마이너스 PO 1 · 엑셀 양식 9, 모두 통과.

---

## 그 밖의 결정

- **상태 이력을 한 곳으로** — 관리자 · 공급사 · 구매자 세 채널이 각자 쓰던 상태 이력 기록(31개 메서드)을 상태 머신의 기록 하나로 모았다. 세 채널의 동기 전이에 적용했고, 배송완료 감지 같은 배치 전이는 따로 간다.
- **합포장 수거** — 여러 원배송을 한 박스로 수거하는 합포장은 고객 요청 → 관리자 승인 2단계다. 같은 배송을 두 번 수거하지 못하게, DB 가 계산해 저장하는 중복 키(번들 > 단일 배송 > 합포장 순)에 UNIQUE 를 걸었다.
- **엑셀 일괄 처리** — 수거 · 재배송 목록을 내려받아 택배 프로그램에서 송장을 뽑고, 올려서 일괄 등록한다. 검수 합격분의 재배송 발주는 클레임당 1건으로 묶어, 라인 수만큼 발주가 중복 생성되던 문제를 없앴다.
- **환불 계좌 암호화** — 무통장 환불용 계좌번호 · 예금주명은 AES-256 으로 컬럼 암호화한다.
- <strong>택배 추적 배치 (10분)</strong> — 수거 배송완료를 감지하면 수거 · 라인 · 마이너스 발주를 함께 완료하고, 재배송 · 반송이 끝나면 라인을, 모든 라인이 끝나면 헤더를 종결한다.
