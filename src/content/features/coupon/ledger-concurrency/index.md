---
title: "선착순 발급과 원장 동시성"
slug: "ledger-concurrency"
project: "coupon"
order: 3
domain: "동시성"
keywords: ["조건부 갱신","잠금 순서","외래 키 공유 잠금","원장 일관성 테스트"]
evidence: ["tested"]
draft: false
cover: null
notionEditedAt: "2026-11-10"
description: null
glance: {"headline":"선착순 · 1인 한도 · 이중 사용을 조건부 갱신과 하나의 잠금 순서로 지키고, 테스트가 찾은 교착 두 가지를 순서를 바로잡아 없앴다","problem":["선착순 쿠폰 · 1인 한도 · 포인트 잔액은 동시 요청이 몰리면 초과 발급이나 이중 사용이 나기 쉽다.","선착순 100장 · 1인 1장 쿠폰에 서로 다른 회원 1,000명의 요청을 한꺼번에 보내자 교착 852건과 500 응답이 나왔다."],"solution":["수량 · 한도 · 상태는 조건부 갱신으로, 포인트는 잔액 행 잠금으로 지키고, 모든 원장 작업이 같은 순서로 잠근다.","외래 키 확인이 쿠폰 행에 거는 공유 잠금 때문에 쿠폰 행을 카운터보다 먼저 잠그고, 다시 선점할 때는 필요한 행을 모두 잠근 뒤 앞의 선점을 푼다."],"result":["같은 테스트가 정확히 100장 · 교착 0건으로 끝나고, 한 회원의 주문 96건을 섞어 보내는 테스트는 6번 돌려 다시 실행 0건이었다.","끝난 뒤 잔액 행 = 적립 건 잔액의 합 = 거래 기록의 합이 맞고, 잠금과 조건부 갱신을 빼면 테스트가 실패한다."]}
leadFigure: {"light":"/content-assets/coupon/ledger-concurrency/diagram-2.light.svg","dark":"/content-assets/coupon/ledger-concurrency/diagram-2.dark.svg","alt":"테스트가 찾은 교착 — 처음 받는 회원 1,000명 다이어그램"}
---

## 지켜야 할 것과 방법

선착순 쿠폰은 정한 수량보다 많이 나가면 안 되고, 1인 1장 쿠폰은 같은 회원이 동시에 눌러도 한 장만 나가야 한다. 한 쿠폰을 두 주문이 동시에 쓰거나 포인트를 두 번 쓰는 일도 막아야 하고, 응답을 못 받아 같은 요청을 다시 보내도 한 번만 처리해야 한다. 대상마다 방법을 정했다.

<div class="table-wrap">

| 대상               | 방법                                                             |
| ---------------- | -------------------------------------------------------------- |
| 선착순 총 수량         | 조건부 갱신 — 발급 수가 총 수량보다 작을 때만 1 늘린다                              |
| 1인 발급 · 사용 횟수    | 쿠폰 · 회원마다 카운터 행 하나(유일 키)를 두고 조건부로 늘린다                          |
| 같은 쿠폰을 두 주문이 동시에 | 발급 건 상태를 조건부로 바꾼다(발급 → 선점, 바뀐 행이 1일 때만 성공)                     |
| 포인트              | 회원 · 종류마다 잔액 행을 잠그고(SELECT … FOR UPDATE) 적립 건에서 뺀다             |
| 같은 요청 반복         | 주문 번호 · 클레임 번호 · 요청 키로 한 번만 처리한다 — 같은 내용이면 처음 결과를, 다른 내용이면 409 |

</div>

<div class="table-wrap">

| 고르지 않은 안                     | 이유                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 건수를 센 뒤 넣기                   | 동시에 온 요청이 같은 건수를 읽고 함께 넣을 수 있다                                                                                               |
| DB 기본 격리 수준(REPEATABLE READ) | 잠금을 기다린 뒤에도 트랜잭션을 시작할 때의 값을 보여 준다. 그사이 다른 요청이 확정한 값을 읽어야 해서 READ COMMITTED 로 두고, 수량 · 한도 · 상태는 격리 수준이 아니라 조건부 갱신과 행 잠금으로 지킨다 |

</div>

---

## 잠그는 순서 하나

발급 · 선점 · 확정 · 해제 · 취소가 모두 같은 순서로 잠근다. 같은 종류 안에서는 ID 순이다.

<figure class="diagram"><img src="/content-assets/coupon/ledger-concurrency/diagram-1.light.svg" alt="잠그는 순서 하나 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/coupon/ledger-concurrency/diagram-1.dark.svg" alt="잠그는 순서 하나 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

교착이나 같은 키의 동시 요청으로 끝난 트랜잭션은 잠깐 쉬고 처음부터 다시 실행한다. 다시 실행하면 먼저 끝난 요청의 행을 읽어 '같은 요청 반복'으로 처리한다. 다시 실행할 때마다 경고 로그를 남긴다 — 순서를 지키면 교착은 드물어야 하므로, 로그가 자주 보이면 순서가 어긋난 곳이 있다는 뜻이다.

---

## 테스트가 찾은 교착 — 처음 받는 회원 1,000명

처음 정한 순서는 카운터가 쿠폰 행보다 앞이었다. 선착순 100장 · 1인 1장 쿠폰에 **서로 다른 회원 1,000명**의 요청을 한꺼번에 보내는 테스트에서 **교착 852건과 500 응답**이 나왔다. 카운터 행과 발급 건을 넣을 때 DB 가 외래 키를 확인하며 부모인 <strong>쿠폰 행에 공유 잠금(S)</strong> 을 걸고, 이어서 발급 수를 늘리려고 같은 행의 <strong>배타 잠금(X)</strong> 을 기다리다 서로 막혔다 — 「동시 업로드 교착」과 같은 원리다.

<figure class="diagram"><img src="/content-assets/coupon/ledger-concurrency/diagram-2.light.svg" alt="테스트가 찾은 교착 — 처음 받는 회원 1,000명 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/coupon/ledger-concurrency/diagram-2.dark.svg" alt="테스트가 찾은 교착 — 처음 받는 회원 1,000명 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

**쿠폰 행을 먼저** 잠그게 바꿨다. 총 수량(쿠폰 행)을 먼저 늘린 뒤 카운터를 넣고, 1인 한도에 걸리면 늘린 발급 수를 되돌린다. 카운터를 넣을 때의 외래 키 확인은 이미 쥔 X 안에서 끝난다. 선점 · 해제 · 늦은 확정 · 취소도 같은 순서로 맞췄다.

<figure class="diagram"><img src="/content-assets/coupon/ledger-concurrency/diagram-3.light.svg" alt="테스트가 찾은 교착 — 처음 받는 회원 1,000명 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/coupon/ledger-concurrency/diagram-3.dark.svg" alt="테스트가 찾은 교착 — 처음 받는 회원 1,000명 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

같은 테스트가 **정확히 100장 · 교착 0건**으로 끝난다.

---

## 테스트가 찾은 교착 둘 — 같은 회원의 주문 96건

한 회원의 다운로드 · 선점 · 다시 선점 · 확정 · 선점 취소 · 부분 취소 · 전체 취소 · 구매 적립을 <strong>스레드 16개로 섞어 보내는 테스트(주문 96건)</strong> 에서 교착이 한 번에 12\~26건 나고, 전체 테스트를 돌릴 때 500 으로 새어 나왔다. 같은 주문 번호로 **다시 선점**할 때 앞의 선점을 먼저 풀면서 포인트 잔액 행을 잠그고, 그 뒤에 새 계산에 쓸 쿠폰 쪽 행을 잠가 순서가 뒤집혔다.

<figure class="diagram"><img src="/content-assets/coupon/ledger-concurrency/diagram-4.light.svg" alt="테스트가 찾은 교착 둘 — 같은 회원의 주문 96건 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/coupon/ledger-concurrency/diagram-4.dark.svg" alt="테스트가 찾은 교착 둘 — 같은 회원의 주문 96건 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

고친 뒤 같은 테스트를 6번 돌려 다시 실행이 0건이었다.

---

## 확인

테스트는 일회성 MySQL 로 HTTP 부터 DB 까지 실제로 잇는다.

<div class="table-wrap">

| 무엇을         | 어떻게 확인했나                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| 선착순         | 총 100장 쿠폰에 요청 1,000개(스레드 32개로 한꺼번에) → 정확히 100장, 나머지 900개는 '다 나감'. 1인 1장까지 건 쿠폰에 서로 다른 회원 1,000명 → 정확히 100장, 교착 0건         |
| 사용할 때 세는 수량 | 총 5장 · 1인 1회 자동 적용 쿠폰에 회원 40명이 동시에 선점 → 정확히 5건                                                                            |
| 1인 한도       | 같은 회원이 동시에 10번 다운로드 → 한도만큼만                                                                                               |
| 이중 사용       | 같은 발급 건으로 두 주문 동시 선점 → 하나만 성공. 잔액 5,000원에 4,000원짜리 선점 둘 → 하나만 성공, 잔액이 음수가 되지 않는다. 둘 다 10번 되풀이한다                           |
| 같은 요청 반복    | 같은 선점 · 같은 클레임을 동시에 5번 → 한 번만 처리                                                                                          |
| 원장 일관성      | 주문 96건을 섞어 보낸 뒤 5xx 없음, 잔액 행 = 쓸 수 있는 적립 건의 잔액 합 = 거래 기록의 합, 1인 사용 카운터 · 자동 적용 쿠폰 수량 = 살아 있는 주문 수, 발급 건 상태 = 붙어 있는 주문의 상태 |

</div>

- 잠금과 조건부 갱신을 빼면 이 테스트들이 실패하는 것을 확인했다.
