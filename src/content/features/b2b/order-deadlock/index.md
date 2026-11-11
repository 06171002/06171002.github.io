---
title: "동시 주문 데드락 — 원인 규명과 처방"
slug: "order-deadlock"
project: "b2b"
order: 1
domain: "거래"
keywords: ["INNODB STATUS","잠금 순서","ABBA","채번"]
evidence: ["measured"]
draft: false
cover: null
notionEditedAt: "2026-10-19"
description: "동시 주문 부하 테스트에서 난 교착을 InnoDB 교착 기록으로 추적해 원인을 확정하고, 경로별 교착 여섯 가지를 고친 과정. 25명 동시 주문 로컬 부하 테스트에서 교착 23건을 0건으로 줄였다."
glance: {"headline":"동시 주문 교착 23건 → 0건 — InnoDB 교착 기록으로 원인 여섯 가지를 찾아 고쳤다","problem":["동시에 120건을 주문하는 부하 테스트에서 일부 주문이 교착으로 강제 롤백됐다. 단위 테스트로는 잡히지 않는 종류의 문제다.","처음 세운 가설 둘은 확인하고 버렸는데, 그중 하나는 맞았다. 부하용 시드 데이터로는 애초에 보일 수 없는 조건이었다."],"solution":["교착 기록을 직접 읽어 원인 여섯 가지를 특정했다. 셋은 검증 · 중복 검사 문장이 건 공유 락이었고, 셋은 경로마다 엇갈린 잠금 순서였다.","공유 락은 락 없는 읽기 · 행마다 다른 임시 번호 · 갱신 한 번으로 없앴고, 잠금 순서는 상품을 잡는 경로는 상품번호 순, 취소 경로는 주문 라인부터로 맞췄다."],"result":["25명 동시 주문 로컬 부하 테스트(3회)에서 교착 23건 → 0건. 같은 장바구니의 주문 결과는 수정 전과 같았다.","경로별 2세션 재현은 모두 3/3 → 0/3, 25개 세션 동시 채번은 교착 20~22건 → 0건 · 다른 카운터 간섭 2.2초 → 1ms."]}
leadFigure: {"light":"/content-assets/b2b/order-deadlock/diagram-2.light.svg","dark":"/content-assets/b2b/order-deadlock/diagram-2.dark.svg","alt":"원인을 찾은 과정 다이어그램"}
---

## 먼저, S락 · X락과 교착

모든 원인은 아래 표 하나와 그림 하나로 설명된다.

<div class="table-wrap row-header">

|      | 상대가 S 보유                            | 상대가 X 보유                       |
| ---- | ----------------------------------- | ------------------------------ |
| S 요청 | <span class="tc-green">바로 획득</span> | <span class="tc-red">대기</span> |
| X 요청 | <span class="tc-red">대기</span>      | <span class="tc-red">대기</span> |

</div>

- S(공유 락)는 "읽는 중이니 바꾸지 마"라는 뜻이다. 여러 트랜잭션이 동시에 쥘 수 있다.
- X(배타 락)는 "쓰는 중"이라는 뜻이다. 한 트랜잭션만 쥔다.\
  두 트랜잭션이 같은 두 자원을 **반대 순서로** 잡으면 서로를 기다린다. 이것이 교착이다.

<figure class="diagram"><img src="/content-assets/b2b/order-deadlock/diagram-1.light.svg" alt="먼저, S락 · X락과 교착 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/order-deadlock/diagram-1.dark.svg" alt="먼저, S락 · X락과 교착 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

롤백되는 쪽은 대개 가벼운 사용자 요청이다. 그리고 **S락은 대부분 코드에 보이지 않는다** — 외래 키 검사, 유니크 중복 검사, 일부 조회 문장이 몰래 건다. 그래서 교착을 한 번에 없애기보다 원인을 하나씩 찾아 고쳤다.

---

## 원인을 찾은 과정

동시에 120건을 주문하는 부하 테스트에서 일부 주문이 교착으로 실패했다. 단위 테스트로는 잡히지 않는 종류의 문제다.\
가설 둘(조회에 정렬이 없다 · 사용자마다 상품 잠금 순서가 다르다)을 확인하고 버린 뒤, MySQL이 남기는 **교착 기록**(SHOW ENGINE INNODB STATUS)을 직접 읽어 원인을 확정했다.

<aside class="callout tone-blue" data-icon="🔍">

<strong>그런데 두 번째 가설은 맞았다.</strong>\
부하 시드가 모든 사용자에게 같은 순서로 상품번호를 매겨서, 115명의 잠금 순서가 모두 같았다. 운영에서는 담은 시각 순서로 번호가 붙어 사람마다 다르다. 이 데이터로는 애초에 보일 수 없는 조건이었다.

</aside>

찾은 원인은 여섯 가지다. 셋은 코드에 보이지 않는 **숨은 공유 락**, 셋은 경로마다 **엇갈린 잠금 순서**였다.

<figure class="diagram"><img src="/content-assets/b2b/order-deadlock/diagram-2.light.svg" alt="원인을 찾은 과정 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/order-deadlock/diagram-2.dark.svg" alt="원인을 찾은 과정 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

---

## 숨은 공유 락 — 원인 ① ② ③

### ① 검증 조회가 상품에 S락을 남겼다

주문을 만들기 전에 판매중지 상품이 섞였는지 세는 검증 조회가 있다. 이 조회를 `SET 변수 = (서브쿼리)` 꼴로 쓰면 InnoDB가 읽은 행에 S락을 건다. 같은 조회를 `SELECT … INTO` 꼴로 쓰면 락이 없다 — 직접 재 보니 상품에 남는 S락이 20건 대 0건이었다.

<figure class="diagram"><img src="/content-assets/b2b/order-deadlock/diagram-3.light.svg" alt="① 검증 조회가 상품에 S락을 남겼다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/order-deadlock/diagram-3.dark.svg" alt="① 검증 조회가 상품에 S락을 남겼다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

**고친 것** — 검증 조회 두 곳을 락 없는 읽기로 바꿨다. 이 경로의 잠그는 순서가 '카운터 → 상품' 하나가 되어, 늦게 온 주문은 줄을 설 뿐이다. 25명 동시 주문 로컬 부하 테스트 3회에서 **교착 23 → 0건**.

### ② 모든 주문이 같은 임시 번호를 넣었다

주문번호를 만들려면 주문 행이 먼저 있어야 해서, 임시 번호 'TEMP'로 넣었다가 바로 바꾼다. 주문번호에는 유니크 인덱스가 있어, 동시에 들어온 주문들이 같은 'TEMP' 자리의 중복 검사 S락을 서로 문다. **담은 상품이 하나도 겹치지 않아도** 난다.

<figure class="diagram"><img src="/content-assets/b2b/order-deadlock/diagram-4.light.svg" alt="② 모든 주문이 같은 임시 번호를 넣었다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/order-deadlock/diagram-4.dark.svg" alt="② 모든 주문이 같은 임시 번호를 넣었다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

**고친 것** — 임시 번호를 행마다 다른 값으로 바꿨다(다른 발주 프로시저가 이미 쓰던 방식). 25명 동시 주문 **교착 23\~24 → 0건**, 5건 동시 발주 **3\~4 → 0건**.

### ③ 채번 루틴이 같은 행에 S를 잡고 X로 올렸다

주문번호를 매기는 채번은 '오늘 행 확보 → +1 → 값 읽기' 세 문장이다. 첫 문장은 그날 첫 호출 뒤로는 늘 중복으로 무시되지만 **S락은 남고**, 다음 문장이 같은 행에 X를 요구한다. 자원이 카운터 행 하나뿐이라 순서를 맞춰서는 풀 수 없다.

<figure class="diagram"><img src="/content-assets/b2b/order-deadlock/diagram-5.light.svg" alt="③ 채번 루틴이 같은 행에 S를 잡고 X로 올렸다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/order-deadlock/diagram-5.dark.svg" alt="③ 채번 루틴이 같은 행에 S를 잡고 X로 올렸다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

**고친 것** — 존재 확인은 락 없이 읽고, 행이 있으면 처음부터 X인 갱신 한 번, 그날 첫 채번만 '삽입 · 중복이면 갱신'으로 처리한다. 처음 고친 'UPDATE 먼저' 방식은 그날 첫 채번끼리 여전히 교착해서(25개 동시 중 0\~3건) 지금 구조가 됐다. 25개 세션 동시 채번 3회에서 **평상시 교착 20\~22 → 0, 그날 첫 채번 23 → 0, 다른 카운터 간섭 2.2초 → 1ms**. 번호 중복 · 빠진 번호는 없었다.

---

## 엇갈린 잠금 순서 — 원인 ④ ⑤ ⑥

### ④ 즉시결제 ↔ 결재 승인

결재를 타는 주문은 승인 때 따로 처리된다. 그러면서 상품 락과 여신 락을 잡는 순서가 즉시결제와 **반대**가 된다. 상품이 하나만 겹쳐도 난다.

<figure class="diagram"><img src="/content-assets/b2b/order-deadlock/diagram-6.light.svg" alt="④ 즉시결제 ↔ 결재 승인 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/order-deadlock/diagram-6.dark.svg" alt="④ 즉시결제 ↔ 결재 승인 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

같은 두 흐름이 발주 채번 카운터에서도 엇갈렸다 — 즉시결제는 상품 → 카운터, 결재 승인 · PG 결제 확정 같은 지연 발주는 카운터 → 상품 순서였다.\
**고친 것** — 모든 경로가 **상품부터, 상품번호 순으로** 잡게 했다. 발주 생성 앞부분과 결재 승인 처리 두 곳을 모두 고쳐야 했다. 2세션 재현에서 두 교착 모두 **3/3 → 0/3**.

### ⑤ 상품끼리의 ABBA

<aside class="callout tone-yellow" data-icon="⭐">

<strong>앞의 교착이 가리고 있던 교착은 앞의 것을 고쳐야 보인다.</strong> ④를 고치고 나서야, 남은 차이인 상품끼리의 순서가 드러났다.

</aside>

즉시주문은 **담은 순서**로, 결재 승인 · 지연 발주는 **상품번호 순**으로 상품을 잡는다. 두 상품을 서로 반대 순서로 잡으면 서로를 기다린다.

<figure class="diagram"><img src="/content-assets/b2b/order-deadlock/diagram-7.light.svg" alt="⑤ 상품끼리의 ABBA 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/order-deadlock/diagram-7.dark.svg" alt="⑤ 상품끼리의 ABBA 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

**고친 것** — 즉시주문도 카트를 돌기 전에 장바구니 상품을 상품번호 순으로 먼저 잡는다. 주문 라인이 만들어지는 순서는 그대로라 화면 · 엑셀 · 정산은 바뀌지 않는다. 2세션 재현 **3/3 → 0/3**, 시작 시각만 어긋나게 한 48번도 **6 → 0**.

### ⑥ 구매사 취소 × 공급사 취소

같은 주문 라인을 구매자와 공급사가 거의 동시에 취소할 때 난다. 구매사 취소는 주문 라인 → 발주 라인, 공급사 취소는 발주 라인 → 주문 라인 순서로 잡는다.

<figure class="diagram"><img src="/content-assets/b2b/order-deadlock/diagram-8.light.svg" alt="⑥ 구매사 취소 × 공급사 취소 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/order-deadlock/diagram-8.dark.svg" alt="⑥ 구매사 취소 × 공급사 취소 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

**고친 것** — 공급사 취소도 주문 라인부터(번호 순) 잡는다. 1:1 라인 · 묶음 라인 모두 2세션 재현 **3/3 → 0/3**.

<aside class="callout tone-orange" data-icon="⚠️">

<strong>잠금은 트랜잭션의 첫 문장이어야 한다.</strong> 교착을 대기로 바꾸면 기다린 뒤 읽는 값이 낡을 수 있다. 잠금 전에 일반 읽기가 있으면 그 시점에 스냅샷이 고정돼, 기다리는 동안 구매자가 커밋한 취소 수량이 보이지 않는다(재 보니 0 대 1). 그래서 잠글 번호는 따로 읽고, 업무 트랜잭션은 잠금으로 시작하게 했다.

</aside>

---

## 결과

모두 로컬에서 쟀다. 늦게 온 쪽은 앞 트랜잭션이 끝날 때까지 기다렸다가 정상으로 끝났다.

<div class="table-wrap">

| **원인**         | **어떻게 쟀나**               | **교착 — 수정 전 → 후**                       |
| -------------- | ------------------------ | --------------------------------------- |
| ① 검증 조회의 S락    | 25명 동시 주문 · 3회           | **23 → 0**                              |
| ② 같은 임시 번호     | 25명 동시 주문 · 5건 동시 발주     | **23\~24 → 0** · **3\~4 → 0**           |
| ③ 채번 루틴        | 25개 세션 동시 채번 · 3회        | 평상시 **20\~22 → 0** · 그날 첫 채번 **23 → 0** |
| ④ 즉시결제 ↔ 결재 승인 | 2세션 재현 (여신 · 발주 카운터)     | **3/3 → 0/3**                           |
| ⑤ 상품 간 ABBA    | 2세션 재현 · 시작 시각만 어긋나게 48회 | **3/3 → 0/3** · **6 → 0**               |
| ⑥ 구매사 × 공급사 취소 | 2세션 재현 (1:1 · 묶음 라인)     | **3/3 → 0/3**                           |

</div>

같은 장바구니로 수정 전후의 주문 결과(라인 20 · 헤더 1 · 장바구니 20행)를 비교해 차이가 없었다.

## 운영 반영

코드 수정은 2026-11-04 운영 브랜치까지 병합됐다. 주문 생성 · 채번 쪽 프로시저는 2026-10-06 운영 DB 에 적용됐고, 발주 생성 프로시저와 앱 코드 수정의 운영 반영은 확인하지 못했다.
