---
title: "공급사 발주·배송 관리"
slug: "supplier-po-delivery"
project: "b2b"
order: 3
domain: "거래"
keywords: ["주문라인 1:1 분할출고 매칭","합배송 운송장 자동전파","운송장 엑셀 일괄출고","배송완료 단일화(수기=배치)","배송추적 배치"]
evidence: ["tested"]
draft: false
cover: null
notionEditedAt: "2026-08-31"
description: null
leadFigure: {"light":"/content-assets/b2b/supplier-po-delivery/diagram-1.light.svg","dark":"/content-assets/b2b/supplier-po-delivery/diagram-1.dark.svg","alt":"발주에서 배송완료까지 다이어그램"}
---

## 발주에서 배송완료까지

공급사는 주문 때 자동으로 나뉜 발주(PO)를 받아 접수 → 출고(운송장) → 배송중 → 배송완료로 처리한다. 이 흐름에서 네 가지가 걸렸다.

- 발주 라인은 같은 상품을 주문한 여러 주문 라인을 합친 것이라, 여러 운송장으로 나눠 출고하면 "이 운송장이 어느 주문 건인가"를 잃는다. 고객별 배송 현황도 부분 정산도 안 된다.
- 같은 곳으로 가는 여러 배송을 한 박스로 묶으면, 작업자가 같은 운송장번호를 건마다 입력해야 한다.
- 수십 · 수백 건의 운송장을 화면에서 한 건씩 넣을 수는 없다.
- 배송완료는 공급사 수기 · 관리자 수기 · 택배 추적 배치 세 곳에서 일어난다. 각자 구현하면 로직이 어긋난다.

<figure class="diagram"><img src="/content-assets/b2b/supplier-po-delivery/diagram-1.light.svg" alt="발주에서 배송완료까지 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/supplier-po-delivery/diagram-1.dark.svg" alt="발주에서 배송완료까지 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

---

## ① 출고 1건 = 주문 라인 1개

발주 라인은 같은 상품을 여러 주문 라인에서 합쳐 받는다(N:1). 접수할 때 유효 수량만큼 **출고 수량 1인 배송 레코드**를 만들고, 주문 라인을 번호 순으로 돌며 남은 수량을 차감해 레코드마다 주문 라인 하나를 가리키게 했다. 합치면서 잃었던 "이 출고가 어느 주문 건인가"가 돌아온다.

<figure class="diagram"><img src="/content-assets/b2b/supplier-po-delivery/diagram-2.light.svg" alt="① 출고 1건 = 주문 라인 1개 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/supplier-po-delivery/diagram-2.dark.svg" alt="① 출고 1건 = 주문 라인 1개 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- 주문 라인 상태는 자기 출고가 매핑된 발주 라인 상태를 그대로 따른다. 정방향 발주에 한해서다 — 반품 · 교환의 마이너스 발주와 옛 데이터는 매핑이 비어 있을 수 있다.
- **검증 10/10** — property 4종 · 무작위 32,000건 + 경계 예시 6. 보존(배분한 양 + 남은 양 = 처음 양), 선택 규칙(잔여가 충분한 가장 앞선 주문 라인), 소진(다 배분한 뒤의 출고는 예외), 그리고 **거절 시 무변경** — 남은 양을 넘는 출고는 예외이고 어떤 잔여도 바뀌지 않는다. 부분 차감이 남으면 재시도 때 수량이 두 번 빠진다. 지금은 순회 구조 덕에 지켜지지만, 차감을 루프 앞으로 옮기는 리팩터링 한 번에 조용히 깨지는 성질이라 테스트로 잠갔다.

---

## ② 합배송 — 운송장은 대표 한 건에만

사용자가 한 박스로 묶은 배송건들은 같은 번들키를 갖는다. 대표 1건에 운송장을 넣으면 같은 번들키의 '준비' 상태 형제에 같은 운송장이 들어간다. 수령지가 같은지를 코드가 판단하지 않는다 — 사용자가 묶은 기준을 따른다.

<figure class="diagram"><img src="/content-assets/b2b/supplier-po-delivery/diagram-3.light.svg" alt="② 합배송 — 운송장은 대표 한 건에만 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/supplier-po-delivery/diagram-3.dark.svg" alt="② 합배송 — 운송장은 대표 한 건에만 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- 합포장 설정은 레코드를 다시 만들지 않고 번들키만 바꿔, 레코드를 가리키는 참조가 그대로 남는다.
- 묶음의 일부만 운송장을 고치려 하면 예외다 — 묶음은 통째로만 처리한다. 박스 번호는 '현재 최대 + 1'로 매겨 겹치지 않는다.

---

## ③ 엑셀 일괄 출고 — 배송 레코드 번호가 왕복 키

<figure class="diagram"><img src="/content-assets/b2b/supplier-po-delivery/diagram-4.light.svg" alt="③ 엑셀 일괄 출고 — 배송 레코드 번호가 왕복 키 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/supplier-po-delivery/diagram-4.dark.svg" alt="③ 엑셀 일괄 출고 — 배송 레코드 번호가 왕복 키 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- 택배사는 코드값과 한글 이름을 둘 다 받아 정규화한다. 이미 출고했거나 운송장이 있는 건은 막는다(중복 차단).
- 엑셀이 긴 숫자를 지수(3.17E+11)로 바꾸지 않게 관리번호 · 운송장 열을 텍스트 서식으로 내려보낸다.

---

## 취소 3트랙 — 수량 보존식

발주 라인은 취소를 누가 했는지 따로 센다. 합쳐 버리면 '누가 왜 취소했는가'가 사라져 정산 · 책임 소재를 가릴 수 없다.

<aside class="callout tone-gray" data-icon="⚖️">

**주문수량 = 고객사 귀책 취소 + 공급사 귀책 취소 + 출고 + 미출고**\
누적이 주문수량과 같아질 때만 라인을 취소 · 완료로 닫는다.

</aside>

- 공급사가 부분 취소하면 실결제 단가가 높은 주문 라인부터 차감한다 — 고객사가 돌려받는 총액이 가장 크도록. 쿠폰 · 포인트는 비례 배분한다.
- 경쟁하는 갱신은 '누적 + 요청 ≤ 주문수량' 조건으로 막고, 갱신된 행이 0이면 충돌로 보고 예외를 낸다. 환원은 예산 기업이면 예산 사용 내역에 음수 행, 아니면 여신으로 한다.\
  **검증 8/8** — property 4종 · 총 32,000건. 어떤 순서 · 분할로 취소해도 누적이 주문수량을 넘지 않고(초과 요청은 필드를 바꾸지 않는다), 정확히 같아질 때만 '발주 취소'로 바뀌며, 미출고까지 네 항의 합이 같으면 '배송 완료'로 닫힌다. 미출고는 누적이 아니라 덮어쓰기다. 무작위 취소 시퀀스 안에서 성공(잔여 ≥ 요청 → 누적 증가)과 거절(잔여 < 요청 → 예외 · 필드 무변경)을 함께 덮는다. 예를 들어 주문 10개에 고객사 7 취소 뒤 공급사 4를 시도하면, 공급사 취소 수량은 3이 아니라 **0** 이어야 한다.

---

## 배송완료는 한 곳에서

<figure class="diagram"><img src="/content-assets/b2b/supplier-po-delivery/diagram-5.light.svg" alt="배송완료는 한 곳에서 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/supplier-po-delivery/diagram-5.dark.svg" alt="배송완료는 한 곳에서 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- **공통 완료 처리기** — 공급사 수기 · 관리자 수기 · 택배 추적 배치가 모두 이 하나를 부른다. 배송 레코드 완료 → 발주 라인 상태 → 입고검수 생성(구매사의 자동 입고 설정에 따라) → 검수 상태 집계 → 발주 · 주문 상태 동기화, 다섯 단계를 한 트랜잭션으로 묶었다. 입고할 수량이 0 이하면 검수 생성과 알림을 건너뛰고, 만들어진 라인이 없으면 배치는 알림을 보내지 않는다(멱등).
- **택배 추적 배치** — 외부 조회 API 는 트랜잭션 밖에서 건별로 부르고, 행 단위 후처리만 짧은 트랜잭션으로 묶었다. 수백 번의 HTTP 동안 DB 커넥션을 쥐지 않기 위해서다. 한 행의 실패는 격리해 배치 전체를 지킨다. 여러 인스턴스의 중복 실행은 ShedLock 으로 막고, 시간 창(출고 1시간 뒤 \~ 21일 전) · 실행 간격 · FIFO + LIMIT 으로 외부 API 호출 수를 제한했다.
- **직배송** — 운송장이 없어 '배송중'으로 들어가는 방법만 다르고, 수기 배송완료로만 끝난다. 엑셀 출고 · 배송 목록 · 추적 배치 세 경로 모두에서 직배송을 막아 두었다.

---

## 그 밖에 검증한 계약

<div class="table-wrap">

| **대상**                   | **고정한 것**                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| 엑셀 양식 (관리자 4 · 공급사 3)    | 필수 표기 열과 파서가 읽는 열이 정확히 같다 — 열 순서 · 헤더 문자열도 바뀌면 안 된다. 관리자 · 공급사 양식이 같은 모양이고, 작성 가이드의 합배송 · 분할출고 안내가 남아 있다 |
| 클레임 상태 축 (관리자 1 · 공급사 2) | 클레임 상태는 헤더에서 온다 — 한 신청이 라인 단계별로 쪼개져 집계되지 않는다                                                             |
| 수거 시작 알림 (7)             | 상품명 요약의 경계(없음 · 빈 목록 · 1건 · N건 → '외 N-1건')와 발주 라인 기준 상품명                                                 |
| 직거래 배제 (5 · 예산 환원 2)     | 직거래 발주가 대행 목록에 섞이지 않고, 부분 취소의 예산 환원은 직거래 원장으로만 간다 — 「직거래(Direct Trade) 트랙」 카드                            |

</div>
