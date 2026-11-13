---
title: "기업회원요청관리"
slug: "company-join-request"
project: "b2b"
order: 7
domain: "기업관리"
keywords: ["상태 머신","감사 이력","승인/반려 워크플로우"]
evidence: ["tested"]
draft: false
cover: null
notionEditedAt: "2026-08-31"
description: null
leadFigure: {"light":"/content-assets/b2b/company-join-request/diagram-2.light.svg","dark":"/content-assets/b2b/company-join-request/diagram-2.dark.svg","alt":"승인하면 만들어지는 것 다이어그램"}
---

## 가입 요청 하나, 채널 둘

기업이 고객사 · 공급사로 가입하거나, 이미 가입한 기업이 다른 역할을 추가하는 요청을 접수하고 승인 · 반려하는 기능이다. 채널마다 검증과 후속 처리가 다르다. **고객사**는 승인 뒤 카테고리 · 상품을 설정하고 나서야 최종 승인되는 2단계, **공급사**는 승인하면 바로 슈퍼관리자를 만드는 1단계다. 반려 → 재신청은 몇 번이고 돌 수 있어서, 매 시점 누가 어떤 사유로 처리했는지가 남아야 한다.

<figure class="diagram"><img src="/content-assets/b2b/company-join-request/diagram-1.light.svg" alt="가입 요청 하나, 채널 둘 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/company-join-request/diagram-1.dark.svg" alt="가입 요청 하나, 채널 둘 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

승인했을 때 채널별로 하는 일은 이렇게 갈린다.

<div class="table-wrap">

| **채널** | **승인 뒤 상태** | **슈퍼관리자**      | **이메일**      |
| ------ | ----------- | -------------- | ------------ |
| 고객사    | 설정 대기       | 보류 (최종승인 때 생성) | 최종승인 때 계정 안내 |
| 공급사    | 승인          | 즉시 생성          | 계정 안내        |
| 역할 추가  | 승인          | 생략             | 역할 추가 안내     |

</div>

이미 고객사인 기업이 공급사 역할을 더하면 기업 마스터를 다시 만들지 않는다 — 공급사 추가 정보를 만들고 권한만 붙인다. 신규 가입과 역할 추가의 분기점을 승인 처리 한 곳에 두었다.

---

## 승인하면 만들어지는 것

<figure class="diagram"><img src="/content-assets/b2b/company-join-request/diagram-2.light.svg" alt="승인하면 만들어지는 것 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/company-join-request/diagram-2.dark.svg" alt="승인하면 만들어지는 것 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

여기서 순서가 설계된 곳이 하나 있다. 슈퍼관리자의 로그인 계정은 별도 계정 서비스(IAM)에 만드는데, 그쪽은 따로 커밋돼 우리 트랜잭션이 롤백돼도 되돌아가지 않는다.

<figure class="diagram"><img src="/content-assets/b2b/company-join-request/diagram-3.light.svg" alt="승인하면 만들어지는 것 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/company-join-request/diagram-3.dark.svg" alt="승인하면 만들어지는 것 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

---

## 자동승인 — 초대 매칭은 서버가 다시 확인한다

2026-08-21 에 경로가 하나 생겼다. 직거래 초대를 받은 미가입 공급사가 가입하면 관리자 검토 없이 가입 직후 바로 승인된다. 승인 주체가 관리자 말고 '초대 매칭'이 하나 더 생긴 셈이라 가드를 세 겹으로 두었다.

<figure class="diagram"><img src="/content-assets/b2b/company-join-request/diagram-4.light.svg" alt="자동승인 — 초대 매칭은 서버가 다시 확인한다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/company-join-request/diagram-4.dark.svg" alt="자동승인 — 초대 매칭은 서버가 다시 확인한다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- ③은 **호출하는 쪽의 판정을 믿지 않는다**는 뜻이다. 미소진 초대가 0건이면 거부하고 수동 승인 경로로 돌려보낸다.
- 승인자 칸은 비워 둔다 — 관리자 테이블을 가리키는 칸이라 실존 관리자만 넣을 수 있다. 대신 이력에는 시스템 행위자로 남아 감사 추적은 똑같다.
- 자동승인된 공급사는 '운영사 대행 미사용'으로 표시돼 일반 공급사 목록에서 빠진다. 공급사는 최종승인 단계가 없어 관리자 승인과 마찬가지로 바로 쓸 수 있다.

---

## 상태 전이를 강제하고, 전부 남긴다

- **전이는 엔티티가 강제한다** — 승인 · 반려는 요청 · 재요청에서만, 최종승인은 설정 대기에서만 된다. 상태 검사가 서비스 곳곳에 흩어져 있으면 하나만 빠져도 비정상 전이가 생긴다.
- **모든 전이를 이력으로** — 상태가 바뀔 때마다 요청 이력에 누가 · 언제 · 어떤 사유로 처리했는지 남긴다. 반려 → 재신청이 몇 번 돌아도 추적된다.
- **중복 가입 차단** — 이미 등록된 사업자번호와, 같은 사업자번호로 진행 중(요청 · 재요청)인 요청을 둘 다 확인한다. 최종승인 전에는 카테고리 · 상품 설정이 끝났는지 본다.

<div class="table-wrap">

| **검토한 안**                                           | **판단**                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 단일 상태 머신 + if/else                                  | 채널 차이가 분기로 불어나고, 고객사 2단계 · 공급사 1단계 승인을 표현하기 어렵다                                      |
| 채널별 테이블 · 서비스 분리                                    | 검증 · 이력 · 이메일이 두 벌이 되고, 역할 추가 때 양쪽 테이블을 맞춰야 한다                                       |
| <strong>단일 테이블 + 채널별 상태 전이 + 후속 처리 분기 (선택)</strong> | 스키마 · 상태 검증은 공통으로 쓰고 후속 처리만 채널별로 나눈다. 채널이 둘뿐이라 Strategy 추상화는 일부러 미뤘다 — 채널이 늘면 그때 꺼낸다 |

</div>

**테스트로 잠근 계약 — 15개**

<div class="table-wrap">

| **대상**    | **테스트**       | **고정한 것**                                                                                                                                                                              |
| --------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API 계약    | 컨트롤러 슬라이스 3/3 | 목록 200 · 검색 조건이 서비스로 그대로 전달된다 · 반려 사유가 없으면 400                                                                                                                                         |
| 승인 게이트    | 서비스 단위 7/7    | 수기 등록 고객사는 비활성으로 만들고 설정 대기 요청을 함께 만든다(공급사 단독은 즉시 활성) · 이관 경로는 고객사여도 활성 — 잠기면 되살릴 승인 경로가 없다 · 최종승인 활성화는 다시 해도 안전하다(이미 활성이면 그대로) · 설정 대기 중에는 화면 토글로 잠금을 풀 수 없다(게이트 우회 차단 · 같은 값 재저장은 허용) |
| 직거래 초대 매칭 | 서비스 단위 5/5    | 미소진 초대와 사업자번호가 맞으면 대행 미사용으로 표시하고, 없으면 그대로 둔다 · 매칭되면 즉시 승인 + 목록 제외, 없으면 거부(수동 승인 유지) · 고객사 요청은 매칭을 시도하지 않는다                                                                             |

</div>

초대 쪽 연동은 「직거래(Direct Trade) 트랙」 카드에 있다.
