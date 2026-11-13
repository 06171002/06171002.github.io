---
title: "장바구니"
slug: "cart"
project: "b2b"
order: 6
domain: "거래"
keywords: ["병목은 프로시저가 아닌 커넥션 풀(리틀의 법칙 교차검증)","프로시저 기반 가격 동기화","기업별 계약가","재고 연동"]
evidence: ["measured","tested"]
draft: false
cover: null
notionEditedAt: "2026-08-31"
description: null
glance: {"headline":"장바구니 갱신의 병목이 쿼리가 아니라 커넥션 풀임을 측정으로 밝혔다 — 풀 크기만 바꿔 처리량 2.44배","problem":["B2B 장바구니는 기업별 계약가 · 재고 · 행사를 매번 반영해야 하고, 장바구니에서 본 가격이 그대로 주문 가격이 돼야 한다.","상품마다 조회하면 왕복이 상품 수만큼 늘어난다 — 장바구니 20개 기준 167회 · p50 395ms, 묶어서 짜도 30회 · p50 77ms."],"solution":["DB 프로시저가 장바구니 전체를 한 번에 갱신해 스냅샷 컬럼에 저장하고, 주문은 그 값을 쓰되 주문 시점에 가격을 다시 확인해 바뀌었으면 막는다.","부하 중 커넥션 풀 · MySQL CPU 지표를 함께 모으고 리틀의 법칙으로 교차 검증해 병목 위치를 찾았다."],"result":["왕복 30 → 4회 · p50 77 → 20ms(장바구니 20개). 최대 100 VU 램프 부하 24,043건에서 실패율 0%.","100 VU 에서 풀은 20/20 포화 · 대기 75 인데 MySQL CPU 는 1.3%였다. 풀 크기만 5 → 20 으로 바꾼 A/B 에서 처리량 115.1 → 280.5 req/s(2.44배), p95 813.3 → 291.3ms."]}
leadFigure: {"light":"/content-assets/b2b/cart/diagram-3.light.svg","dark":"/content-assets/b2b/cart/diagram-3.dark.svg","alt":"병목 — 쿼리가 아니라 커넥션 풀 다이어그램"}
---

## 장바구니 — 볼 때마다 가격 · 재고를 다시 맞춘다

B2B 장바구니는 상품을 담아 두기만 하는 곳이 아니다. 같은 상품이라도 A기업은 정가, B기업은 15% 할인된 계약가로 보여야 하고, 재고와 행사도 매번 반영해야 한다. 그리고 **장바구니에서 본 가격이 그대로 주문 가격이 돼야 한다** — 담을 때 12,000원이던 상품이 결제할 때 13,500원이면 정산 분쟁이 된다.\
그래서 장바구니에 들어올 때마다 DB 프로시저가 담긴 상품 전체를 다시 계산해 장바구니 행의 **스냅샷 컬럼**(계약가 · 할인가 · 정가 · 공급가 · 부가세 · 상품명 · 공급사 …)에 저장하고, 주문은 그 값을 쓴다.

<figure class="diagram"><img src="/content-assets/b2b/cart/diagram-1.light.svg" alt="장바구니 — 볼 때마다 가격 · 재고를 다시 맞춘다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/cart/diagram-1.dark.svg" alt="장바구니 — 볼 때마다 가격 · 재고를 다시 맞춘다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

스냅샷과 프로시저는 한 세트다. 프로시저가 계산 결과를 저장할 곳이 스냅샷 컬럼이고, 스냅샷이 있으니 주문 생성도 같은 값을 쓸 수 있다. 다섯 컬럼짜리 참조 테이블이던 장바구니는 가격 · 상품 · 공급사 스냅샷을 담는 수십 개 컬럼으로 커졌다. 주문 때 현재 가격과 한 번 더 비교하는 것은 스냅샷을 맹신하지 않기 위한 두 번째 안전망이다.

---

## 갱신 — 상품 수만큼이 아니라 한 번에

<figure class="diagram"><img src="/content-assets/b2b/cart/diagram-2.light.svg" alt="갱신 — 상품 수만큼이 아니라 한 번에 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/cart/diagram-2.dark.svg" alt="갱신 — 상품 수만큼이 아니라 한 번에 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

상품 조회 → 계약가 조회 → 갱신을 앱에서 상품마다 하면 왕복이 상품 수만큼 늘어난다. 세 구현을 실제로 만들어 MySQL 전역 카운터로 왕복을 셌다(장바구니 20개).

<div class="table-wrap">

| **구현**           | **DB 왕복** | **응답 p50** |
| ---------------- | --------- | ---------- |
| 상품마다 조회          | 167회      | 395 ms     |
| IN 절로 묶은 조회      | 30회       | 77 ms      |
| **프로시저 1회 CALL** | **4회**    | **20 ms**  |

</div>

- 묶어서 짜면 앱도 N+1 이 아니다(30회, 상품 수와 무관한 상수). 그래서 비교 기준을 167회가 아니라 30회로 잡았다. 상품 50개에서도 30 대 4로 격차는 일정했다.
- 운영급 왕복 지연(1ms)을 넣으면 31.7ms 대 139.9ms — 4.4배. 앱과 DB 가 멀어질수록 벌어진다.

<div class="table-wrap">

| **고르지 않은 안**     | **이유**                                                        |
| ---------------- | ------------------------------------------------------------- |
| 조회할 때마다 JOIN     | 조회가 잦아 매번 JOIN 비용이 들고, 주문 시점과 가격이 어긋날 위험은 그대로다                |
| Redis 가격 캐시 (5분) | 가격이 바뀐 뒤 캐시가 만료될 때까지 어긋난다. 기업별 계약가라 캐시 키가 기업 수 × 상품 수만큼 늘어난다  |
| 스케줄러로 5분마다 갱신    | 사용자가 본 시점과 갱신 시점이 달라 같은 불일치가 생기고, "왜 어떤 사람만 이전 가격?"을 추적하기 어렵다 |
| 앱 + 배치 로딩        | 외부 호출이 남고, 가격 계산 · 재고 조정 로직이 주문 생성 프로시저와 중복된다                 |

</div>

---

## 병목 — 쿼리가 아니라 커넥션 풀

장바구니 조회 API(요청마다 갱신 프로시저 실행)에 k6 로 부하를 걸었다. 사용자 120명이 각자 장바구니 20개를 갖게 했다 — 한 사용자로 걸면 모든 요청이 같은 장바구니 행을 갱신하느라 행 잠금에서 줄을 서, 시스템이 아니라 테스트 자신의 경합을 재게 된다. 부하는 2 VU 워밍업 → 10 → 50 → 100 VU(2분 45초, 생각 시간 없음), 로컬 단일 인스턴스 · MySQL 8.4 컨테이너 · 커넥션 풀 최대 20.

<div class="table-wrap">

| **지표**       | **실측**              | **조건**                                   |
| ------------ | ------------------- | ---------------------------------------- |
| 응답 p95 · p50 | **78 · 57 ms**      | 무경합 (2 VU), 장바구니 20개 · 당시 기록값(원 데이터 미보존) |
| 응답 p95 · p99 | 600 · 943 ms        | 동시 100 VU                                |
| 처리량          | 146 req/s           | 동시 100 VU                                |
| 실패율          | <strong>0%</strong> | 24,043 요청                                |

</div>

100 VU 구간의 서버 지표가 병목 위치를 가리켰다. DB 는 놀고 있었고, 요청은 커넥션을 기다리고 있었다.

<figure class="diagram"><img src="/content-assets/b2b/cart/diagram-3.light.svg" alt="병목 — 쿼리가 아니라 커넥션 풀 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/cart/diagram-3.dark.svg" alt="병목 — 쿼리가 아니라 커넥션 풀 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- 행 잠금 대기는 53건 늘었을 뿐이라 잠금 경합이 아니었다.
- 리틀의 법칙으로도 맞는다 — 20 커넥션 ÷ 161ms ≈ 124 req/s, 실측 146.
- 서버 지표는 같은 빌드 · 같은 부하로 바로 앞에 돌린 회차에서 쟀다. 그 회차는 처리량 139 req/s · p50 160ms 로 위 회차(146 req/s · p50 161ms)와 거의 같았다.\
  <strong>재측정 (2026-08-30) — 풀 크기만 바꾼 A/B.</strong> 램프 프로파일 · 시드 · 코드가 같고 커넥션 풀 크기 설정 하나만 다르다. 프로시저는 손대지 않았다.

<figure class="diagram"><img src="/content-assets/b2b/cart/diagram-4.light.svg" alt="병목 — 쿼리가 아니라 커넥션 풀 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/cart/diagram-4.dark.svg" alt="병목 — 쿼리가 아니라 커넥션 풀 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

<div class="table-wrap">

| **지표**   | **풀 5**     | **풀 20**        | **배수**    |
| -------- | ----------- | --------------- | --------- |
| 처리량      | 115.1 req/s | **280.5 req/s** | **2.44배** |
| p50      | 191.6 ms    | 83.6 ms         | 2.29배     |
| p95      | 813.3 ms    | **291.3 ms**    | **2.79배** |
| p99      | 1,129.3 ms  | 429.0 ms        | 2.63배     |
| 요청 · 실패율 | 18,989 · 0% | 46,285 · 0%     | —         |

</div>

상품 개수도 쿼리도 프로시저도 그대로고 **풀 크기만 바뀌었는데** 처리량이 2.44배가 됐다 — 병목이 프로시저가 아니라는 증거다. 풀은 4배인데 처리량은 2.44배라 선형은 아니다. 풀 20 에서는 CPU · 락 경합 같은 다른 요인이 섞이기 시작한다는 뜻이다. 서버 지표로도 확인했다 — 요청 46,286건의 평균 처리 시간 110.2ms, 서버 최대 1.023초가 클라이언트 최대 1,023.3ms 와 같아 네트워크 오버헤드는 무시할 수준이었다.

---

## 트랙 순도 가드 — 대행과 직거래를 섞지 않는다

직거래 트랙이 들어오면서 장바구니에 선택 단계의 게이트가 붙었다. 트랙 순도 테스트 6/6 통과.

<figure class="diagram"><img src="/content-assets/b2b/cart/diagram-5.light.svg" alt="트랙 순도 가드 — 대행과 직거래를 섞지 않는다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/cart/diagram-5.dark.svg" alt="트랙 순도 가드 — 대행과 직거래를 섞지 않는다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- 판정이 막힌(차단) 상품은 직거래 쪽으로 묶는다 — 대행으로 넘기지 않는다.
- 선택 해제는 검사하지 않는다 — 내리는 동작은 섞임을 만들 수 없다.
- 선택 상품이 1건 이하면 섞일 수 없으니 판정을 부르지 않는다(불필요한 쿼리 제거).\
  판정 규칙은 「직거래(Direct Trade) 트랙」 카드에 있다.
