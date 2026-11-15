---
title: "할인 순서와 줄별 배분"
slug: "discount-allocation"
project: "coupon"
order: 1
domain: "할인 계산"
keywords: ["단계별 할인","줄별 안분","끝전 처리","무작위 주문 검사"]
evidence: ["tested"]
draft: false
cover: null
notionEditedAt: "2026-11-10"
description: null
glance: {"headline":"쿠폰 여러 장 · 배송비 쿠폰 · 포인트를 네 단계로 차례로 빼고 줄마다 나눠, 할인 합계가 줄 금액을 넘지 않게 했다","problem":["한 주문에 상품 · 주문 · 배송비 쿠폰과 포인트를 함께 쓸 때 쿠폰마다 원래 금액으로 계산해 더하면, 할인 합계가 줄 금액을 넘을 수 있다.","부분 반품 때 환불을 맞추려면 할인을 상품 줄마다 나눠 둬야 하는데, 나누면 끝전이 남는다."],"solution":["상품 쿠폰 → 주문 쿠폰 → 배송비 쿠폰 → 포인트 순서로, 단계마다 앞 단계 할인을 뺀 금액을 기준으로 계산한다.","할인을 기준 금액 비율로 나눠 내리고, 남는 금액은 가장 큰 줄에 더하되 그 줄의 금액을 넘으면 다음 줄로 넘긴다."],"result":["무작위 주문 5,000건에서 쿠폰마다 줄별 배분의 합이 할인액과 같고, 줄마다 쿠폰과 포인트의 합이 줄 금액을 넘지 않는다.","설계 예시(상품 79,000원 + 배송비 3,000원 → 결제 67,000원)와 대조한 두 쇼핑몰의 쿠폰 15가지 모양을 테스트로 그대로 재현한다."]}
leadFigure: {"light":"/content-assets/coupon/discount-allocation/diagram-1.light.svg","dark":"/content-assets/coupon/discount-allocation/diagram-1.dark.svg","alt":"네 단계 — 앞 단계를 뺀 금액에서 다이어그램"}
---

## 네 단계 — 앞 단계를 뺀 금액에서

쇼핑몰은 장바구니 줄 금액과 회원 · 주문 · 상품 속성을 보내고, 엔진은 쓸 수 있는 쿠폰과 **줄별 할인**을 돌려준다. 한 주문에 상품 쿠폰 · 주문 쿠폰 · 배송비 쿠폰 · 포인트를 함께 쓸 수 있어 계산 순서를 네 단계로 정했다. 단계마다 **앞 단계 할인을 뺀 금액**이 다음 단계의 기준이라, 할인 합계가 줄 금액을 넘지 않는다.

<figure class="diagram"><img src="/content-assets/coupon/discount-allocation/diagram-1.light.svg" alt="네 단계 — 앞 단계를 뺀 금액에서 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/coupon/discount-allocation/diagram-1.dark.svg" alt="네 단계 — 앞 단계를 뺀 금액에서 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- 같은 단계에 쿠폰이 여러 장이면 정액 → 정률, 같은 방식 안에서는 할인값이 큰 것부터 적용한다. 쿠폰마다 앞 쿠폰을 뺀 금액이 기준이다.
- 최소 주문 금액은 그 쿠폰 대상 줄의 **쿠폰 적용 전** 합계로 판정한다. 쿠폰을 더 골라도 판정이 바뀌지 않는다.
- 무료배송은 쿠폰을 적용한 결과로 다시 판단한다. 배송비가 0이 되면 배송비 쿠폰은 쓰지 않고 쿠폰함에 남는다.
- 포인트는 상품 줄에만 쓴다. 배송비는 포인트로 내지 않는다.

<div class="table-wrap">

| 고르지 않은 안                | 이유                                                                   |
| ----------------------- | -------------------------------------------------------------------- |
| 쿠폰마다 원래 금액으로 따로 계산해 더하기 | 할인 합계가 줄 금액을 넘을 수 있다. 40,000원 줄에 정액 30,000원 쿠폰 두 장이면 할인이 60,000원이 된다 |
| 쿠폰 종류마다 한 장만 쓰기         | 대조한 두 쇼핑몰 모두 쿠폰마다 함께 쓸 수 있는지를 두고, 함께 쓸 수 있는 쿠폰끼리는 여러 장을 쓴다           |

</div>

---

## 줄마다 나누고, 남는 1원은 큰 줄로

부분 반품 때 환불을 맞추려면 주문 할인을 **상품 줄마다** 나눠 둬야 한다. 기준 금액 비율로 나눠 안분 단위로 내리면 끝전이 남는다. 남는 금액은 기준 금액이 **가장 큰 줄**(같으면 앞 줄)에 더하고, 그 줄의 기준 금액을 넘게 되면 다음으로 큰 줄로 넘긴다.

<figure class="diagram"><img src="/content-assets/coupon/discount-allocation/diagram-2.light.svg" alt="줄마다 나누고, 남는 1원은 큰 줄로 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/coupon/discount-allocation/diagram-2.dark.svg" alt="줄마다 나누고, 남는 1원은 큰 줄로 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

포인트도 같은 방식으로, 쿠폰을 뺀 남은 줄 금액 비율로 나눈다. 안분 단위는 쇼핑몰마다 정한다.

---

## 계산 예시 — 82,000원이 67,000원으로

줄 3개, 쿠폰 3장(모두 함께 쓸 수 있음), 포인트 2,000원을 쓴 주문이다. 안분 단위는 1원이고, 무료배송 기준은 모든 쿠폰을 적용한 뒤 100,000원이다.

<figure class="diagram"><img src="/content-assets/coupon/discount-allocation/diagram-3.light.svg" alt="계산 예시 — 82,000원이 67,000원으로 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/coupon/discount-allocation/diagram-3.dark.svg" alt="계산 예시 — 82,000원이 67,000원으로 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

<div class="table-wrap">

| 줄       | 금액     | 쿠폰 A  | 쿠폰 B  | 쿠폰 C  | 포인트   | 결제     |
| ------- | ------ | ----- | ----- | ----- | ----- | ------ |
| ① 셔츠 2개 | 40,000 | 2,858 | 2,510 | —     | 1,005 | 33,627 |
| ② 바지 1개 | 30,000 | 2,142 | 1,882 | —     | 752   | 25,224 |
| ③ 양말 3개 | 9,000  | —     | 608   | —     | 243   | 8,149  |
| 배송비     | 3,000  | —     | —     | 3,000 | —     | 0      |
| 합계      | 82,000 | 5,000 | 5,000 | 3,000 | 2,000 | 67,000 |

</div>

- 쿠폰 A 의 대상은 의류인 ①②(70,000원)다. 10%는 7,000원이지만 최대 5,000원이다. 40,000 : 30,000 으로 나누면 2,857 과 2,142 이고, 남은 1원은 큰 줄인 ①에 더한다.
- 쿠폰 B 의 최소 주문 금액은 쿠폰 적용 전 합계 79,000원으로 판정한다. 5,000원을 남은 금액 37,142 : 27,858 : 9,000 으로 나눈다.
- 포인트 2,000원은 쿠폰 뒤 남은 34,632 : 25,976 : 8,392 로 나눈다.

---

## 목록 · 미리보기 · 선점 · 취소가 같은 계산을 쓴다

계산 모듈은 DB 도 프레임워크도 모르는 순수 Java 모듈이다. 쿠폰 · 줄 · 속성을 받아 할인과 줄별 배분을 돌려줄 뿐이고, 쓸 수 있는 쿠폰 목록 · 결제 화면 미리보기 · 선점 · 취소가 모두 이 모듈을 쓴다. 각자 따로 계산하면 같은 쿠폰을 두고 목록과 결제가 다른 답을 내기 쉽다.

<figure class="diagram"><img src="/content-assets/coupon/discount-allocation/diagram-4.light.svg" alt="목록 · 미리보기 · 선점 · 취소가 같은 계산을 쓴다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/coupon/discount-allocation/diagram-4.dark.svg" alt="목록 · 미리보기 · 선점 · 취소가 같은 계산을 쓴다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

선점할 때 계산한 줄별 배분을 저장해 두고, 확정 · 조회는 그 값을 그대로 쓰고 취소는 그 값을 나눈다. 그 사이 관리자가 쿠폰을 고쳐도 확정 금액은 바뀌지 않는다.

---

## 확인

- 설계 문서의 계산 예시(결제 67,000원, 줄 ① 33,627원)를 계산 모듈 테스트와 API 통합 테스트(일회성 MySQL)로 그대로 재현한다. 무료배송 기준이 60,000원이면 배송비 쿠폰이 쓰이지 않고 쿠폰함에 남는 것도 본다.
- 대조한 두 쇼핑몰의 쿠폰 15가지 모양을 엔진의 쿠폰 설정과 속성으로 만들어 계산한다.
- **무작위 주문 5,000건** — 쿠폰마다 줄별 배분의 합 = 할인액, 줄마다 쿠폰 + 포인트 ≤ 줄 금액, 합계가 서로 맞고 단계 순서와 중복 규칙을 지킨다. 건마다 시드가 정해져 있어 실패하면 같은 주문을 다시 만든다.
- 남는 금액을 넘기는 상한을 빼면 이 테스트가 실패하는 것을 확인했다.
- 계산 모듈이 JDK 만 쓰는지 구조 테스트가 검사한다.
