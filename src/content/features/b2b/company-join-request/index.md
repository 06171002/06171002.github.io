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
---

## 개요

<aside class="callout tone-blue" data-icon="📨">

기업의 가입 요청(고객사/공급사 전환, 계열사 추가 등)을 접수하고 승인/반려하는 워크플로우를 관리하는 기능. <strong>상태 머신(State Machine)</strong> 패턴으로 요청 상태 전이를 명확하게 관리한다.

</aside>

<div class="table-wrap">

| **채널별 상태머신** | **2단계 / 1단계 승인**         | **역할 추가 분기**  | **전이마다 이력** | **자동승인 3중 가드**  |
| ------------ | ------------------------ | ------------- | ----------- | --------------- |
| 고객사 · 공급사    | 고객사는 설정 후 최종승인 · 공급사는 즉시 | 기업 마스터 재생성 없음 | 누가 · 언제 · 왜 | 초대 매칭을 서버에서 재검증 |

</div>

---

## 왜 이 설계가 필요했는가 (Problem)

B2B 가입 워크플로우의 복잡성 — 단일 상태머신·단일 검증으로는 풀리지 않는 3가지 도메인 난제.

<aside class="callout tone-scenario" data-icon="🎯">

**시나리오 1 — 채널별 다른 검증·후속처리**\
고객사와 공급사는 입력 검증 규칙이 다르다 (통장사본 첨부는 공급사에만 있고 선택이다).

- **고객사** — 승인 후에도 카테고리·상품 설정 → 최종승인 **2단계**
- **공급사** — 즉시 슈퍼관리자 생성 **1단계**

→ 단일 상태머신·단일 검증으로 처리 시 채널별 분기 폭발.

</aside>

<aside class="callout tone-scenario" data-icon="⚠️">

<strong>시나리오 2 — 역할 추가 (Cross-Role)</strong>\
이미 고객사로 가입한 기업이 공급사 역할을 추가하는 케이스. 기업 마스터를 재생성하면 중복 → 공급사 추가 정보만 생성 + 권한만 부여.\
→ 신규 가입과 역할 추가의 처리 분기점이 명확해야 함.

</aside>

<aside class="callout tone-scenario" data-icon="🔁">

**시나리오 3 — 반려·재신청 사이클**\
반려된 요청을 사용자가 보완 후 재신청.

- **사이클** — 반려 → 재요청 → 재검토 → 승인 또는 반려 무한 반복 가능
- **감사 요구** — 매 시점 누가 어떤 사유로 처리했는지 추적 필수

→ 상태 변경 이력을 모든 전이마다 INSERT.

</aside>

이 3가지를 동시에 해결하기 위해 **채널별 상태머신 분리 + 역할추가 분기 로직 + 이력 테이블 분리** 의 조합으로 결정.

---

## 검토했던 대안 (Analyze)

"하나의 가입 요청이 채널·기존 역할·재신청 여부에 따라 다르게 처리되어야 한다"는 요구를 풀 4가지 방법을 비교했다.

<div class="table-wrap">

| **대안**                             | **장점**                                | **기각 사유**                                                     |
| ---------------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| 1. 단일 상태머신 (요청 → 승인 → 완료)          | 구현 단순, 학습 곡선 낮음                       | 채널별 처리 차이를 if/else 로 분기 → 복잡도 폭발. 2단계(고객사)·1단계(공급사) 승인 표현 어려움 |
| 2. 채널별 별도 테이블·서비스 분리               | 완전 격리, 채널별 독립 변경                      | 코드 중복(검증·이력·이메일 모두 2벌). 역할추가 시점에 양쪽 테이블 동기화 → 정합성 위험          |
| 3. 단일 테이블 + 채널별 상태머신 분기            | 스키마 단일화 + 상태 전이만 채널별 분기               | 채널별 후속처리(슈퍼관리자 생성 시점·이메일 등)도 분기 필요                            |
| 4. 단일 테이블 + 채널별 상태머신 + 후속처리 분기 메서드 | 상태머신 명확 + 후속처리 채널별 캡슐화 + 역할추가는 별도 분기점 | 후속처리 분기가 한 서비스 메서드에 모임 — 채널 늘면 Strategy 추출 검토 (현 2채널은 수용 가능)  |

</div>

<aside class="callout tone-green" data-icon="✅">

**선택: 4번**\
채널별 분기 명료성·역할추가 처리·재신청 사이클 추적 모두 충족.

- **채널 식별** — 요청 채널 코드
- **상태 전이** — 엔티티의 가드 메서드(처리 가능 · 최종승인 가능 판정)
- **후속처리** — 승인 서비스의 채널 분기

→ 채널이 2개뿐이라 Strategy 인터페이스 추상화는 **의도적으로 보류** — over-engineering 회피

</aside>

---

## 1. 기업 유입 프로세스

<div class="table-wrap">

| **구분** | **고객사**                  | **공급사**              |
| ------ | ------------------------ | -------------------- |
| 승인 단계  | **2단계** — 승인 → 설정 → 최종승인 | **1단계** — 승인 시 즉시 완료 |
| 첨부     | 사업자등록증                   | 사업자등록증 + 통장사본(선택)    |

</div>

### 상태 전이 — 고객사

<figure class="diagram"><img src="/content-assets/b2b/company-join-request/diagram-1.light.svg" alt="상태 전이 — 고객사 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/company-join-request/diagram-1.dark.svg" alt="" class="diagram-dark" loading="lazy" decoding="async" aria-hidden="true"></figure>

### 상태 전이 — 공급사

<figure class="diagram"><img src="/content-assets/b2b/company-join-request/diagram-2.light.svg" alt="상태 전이 — 공급사 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/company-join-request/diagram-2.dark.svg" alt="" class="diagram-dark" loading="lazy" decoding="async" aria-hidden="true"></figure>

<aside class="callout tone-purple" data-icon="🤖">

<strong>자동승인 경로 (2026-08-21 신설)</strong> — 직거래 초대를 받은 미가입 공급사가 가입하면, **관리자 검토 없이** 가입 직후 내부 호출로 바로 승인된다.

승인 주체가 *관리자* 말고 *초대 매칭* 이 하나 더 생긴 셈이라, 가드를 세 겹으로 둔다.\
① 처리 가능 상태(요청 · 재요청)만\
② **신규 공급사 요청만** — 기존 기업의 역할추가는 불가\
③ 🔴 **초대 매칭을 서버에서 재검증** — <em>"호출하는 쪽의 판정을 신뢰하지 않는다"</em>. 미소진 초대가 0건이면 거부하고 **수동 승인 경로로 돌려보낸다**

</aside>

<div class="table-wrap">

| **항목**   | **관리자 승인**        | **직거래 자동승인**                                                |
| -------- | ----------------- | ----------------------------------------------------------- |
| 승인 주체    | 관리자 (승인자 기록)      | **시스템** — 승인자 칸은 **비워 둔다**. 관리자 테이블 FK 라 실존 관리자만 넣을 수 있기 때문 |
| 기업 생성 옵션 | 승인 게이트 없음 · 즉시 사용 | **동일** — 공급사는 최종승인 단계가 없어 즉시 사용                             |
| 부가 마킹    | —                 | **운영사 대행 미사용**으로 표시되어 일반 공급사 목록에서 제외                        |
| 이력       | 관리자               | 시스템 행위자로 이력 INSERT — **감사 추적은 동일하게 남는다**                    |

</div>

<aside class="callout tone-orange" data-icon="🧹">

**트랜잭션 순서가 설계된 지점** — 계정(IAM) 생성을 트랜잭션 안 **맨 마지막**에 둔다.\
IAM 생성은 별도 서비스 커밋이라 <strong>롤백이 안 된다.</strong> 앞에 두면 뒤 단계 실패 시 **고아 계정**이 남고, 아이디를 선점해 **재시도가 영구히 불가능**해진다.

</aside>

### 상태별 설명

<div class="table-wrap">

| **상태** | **설명**          | **후속 액션**            |
| ------ | --------------- | -------------------- |
| 요청     | 초기 요청 접수        | 관리자 검토 대기            |
| 재요청    | 반려 후 재신청        | 관리자 재검토 대기           |
| 설정 대기  | 1차 승인 완료 (고객사만) | 카테고리/상품 설정 대기        |
| 승인     | 최종 승인 완료        | 슈퍼관리자 계정 생성, 이메일 발송  |
| 반려     | 반려              | 반려 사유 이메일 발송, 재신청 가능 |

</div>

---

## 2. 시나리오별 흐름

<details class="heading-toggle h3">
<summary>시나리오 A: 고객사 신규 가입</summary>

<aside class="callout tone-blue" data-icon="1️⃣">

**요청 접수** — 기업명, 사업자번호, 담당자정보, 사업자등록증 첨부 → **요청** 상태로 저장

</aside>

<aside class="callout tone-blue" data-icon="2️⃣">

**1차 승인** — 관리자 승인 → 기업 마스터 + 고객사 추가정보 + 정산/여신/서비스 정보 + 권한그룹 복제 → **설정 대기** (슈퍼관리자 생성 보류)

</aside>

<aside class="callout tone-blue" data-icon="3️⃣">

**설정** — 담당자가 관리자 화면에서 카테고리/상품 설정

</aside>

<aside class="callout tone-blue" data-icon="4️⃣">

**최종 승인** — 카테고리/상품 설정 완료 검증 → 슈퍼관리자 계정 생성 → **승인** 상태, 계정 안내 이메일 발송

</aside>

</details>

<details class="heading-toggle h3">
<summary>시나리오 B: 공급사 신규 가입</summary>

<aside class="callout tone-green" data-icon="1️⃣">

**요청 접수** — 사업자등록증 첨부 (통장사본 선택) → **요청** 상태로 저장

</aside>

<aside class="callout tone-green" data-icon="2️⃣">

<strong>승인 (즉시 완료)</strong> — 관리자 승인 → 기업 생성 + 공급사 추가정보 + 정산정보 + 공급사 권한 부여 → 슈퍼관리자 **즉시 생성** → **승인** 상태, 이메일 발송

</aside>

</details>

<details class="heading-toggle h3">
<summary>시나리오 C: 역할 추가 / 반려</summary>

<aside class="callout tone-yellow" data-icon="🔁">

**Cross-Role** — 기존 고객사에 공급사 역할 추가 (또는 반대) → 승인 시 기업 생성 생략, 역할 추가 처리만 → 추가 정보 생성 + 해당 사이트 권한 부여 → 고객사·공급사 화면 모두 접근 가능

</aside>

<aside class="callout tone-red" data-icon="❌">

**반려 → 재신청** — 관리자가 반려 사유 입력 → **반려** 상태 + 반려 사유/재신청 링크 포함 이메일 발송 → 담당자가 정보 수정 후 재신청 → **재요청** 상태

</aside>

</details>

### 승인 시 채널별 후속 처리

<div class="table-wrap">

| **채널** | **상태**  | **슈퍼관리자** | **이메일**  |
| ------ | ------- | --------- | -------- |
| 고객사    | → 설정 대기 | 보류        | 미발송      |
| 공급사    | → 승인    | 즉시 생성     | 계정 안내    |
| 역할 추가  | → 승인    | 생략        | 역할 추가 안내 |

</div>

---

## 3. 데이터 흐름

### 승인 시 데이터 생성 흐름

<figure class="diagram"><img src="/content-assets/b2b/company-join-request/diagram-3.light.svg" alt="승인 시 데이터 생성 흐름 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/company-join-request/diagram-3.dark.svg" alt="" class="diagram-dark" loading="lazy" decoding="async" aria-hidden="true"></figure>

<details class="heading-toggle h3">
<summary>채널별 데이터 생성 범위</summary>

<div class="table-wrap">

| **데이터**     | **고객사**                            | **공급사**                            | **역할 추가**                          | **생성 시점**           |
| ----------- | ---------------------------------- | ---------------------------------- | ---------------------------------- | ------------------- |
| 가입 요청       | <span class="chosen-mark">✅</span> | <span class="chosen-mark">✅</span> | <span class="chosen-mark">✅</span> | 요청 접수               |
| 요청 이력       | <span class="chosen-mark">✅</span> | <span class="chosen-mark">✅</span> | <span class="chosen-mark">✅</span> | 상태 변경 시마다           |
| 기업 마스터      | <span class="chosen-mark">✅</span> | <span class="chosen-mark">✅</span> | ❌                                  | 승인 시                |
| 고객사 정보      | <span class="chosen-mark">✅</span> | ❌                                  | <span class="chosen-mark">✅</span> | 승인 시                |
| 공급사 정보      | ❌                                  | <span class="chosen-mark">✅</span> | <span class="chosen-mark">✅</span> | 승인 시                |
| 여신 정보       | <span class="chosen-mark">✅</span> | ❌                                  | <span class="chosen-mark">✅</span> | 승인 시                |
| 정산 정보       | <span class="chosen-mark">✅</span> | <span class="chosen-mark">✅</span> | <span class="chosen-mark">✅</span> | 승인 시                |
| 서비스 구독      | <span class="chosen-mark">✅</span> | ❌                                  | <span class="chosen-mark">✅</span> | 승인 시                |
| 권한그룹        | <span class="chosen-mark">✅</span> | <span class="chosen-mark">✅</span> | <span class="chosen-mark">✅</span> | 승인 시                |
| 사용자 (슈퍼관리자) | <span class="chosen-mark">✅</span> | <span class="chosen-mark">✅</span> | ❌                                  | 최종승인(고객사) / 승인(공급사) |
| 사용자 권한그룹    | <span class="chosen-mark">✅</span> | <span class="chosen-mark">✅</span> | ❌                                  | 최종승인(고객사) / 승인(공급사) |

</div>

</details>

---

## 4. ERD

<figure class="diagram"><img src="/content-assets/b2b/company-join-request/diagram-4.light.svg" alt="4. ERD 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/b2b/company-join-request/diagram-4.dark.svg" alt="" class="diagram-dark" loading="lazy" decoding="async" aria-hidden="true"></figure>

---

## 5. 검증 규칙

<div class="table-wrap">

| **검증 항목** | **설명**                          | **검증 위치**   |
| --------- | ------------------------------- | ----------- |
| 중복 사업자번호  | 이미 등록된 기업의 사업자번호인지 확인           | 기업 조회 쿼리    |
| 진행 중 요청   | 같은 사업자번호로 진행 중(요청·재요청)인 요청이 있는지 | 가입 요청 조회 쿼리 |
| 처리 가능 상태  | 승인·반려는 요청·재요청 상태에서만             | 엔티티 가드      |
| 최종 승인 가능  | 최종승인은 설정 대기 상태에서만               | 엔티티 가드      |
| 카테고리 설정   | 최종승인 전 카테고리 설정 완료 필수            | 가입 요청 조회 쿼리 |
| 상품 설정     | 최종승인 전 상품 설정 완료 필수              | 가입 요청 조회 쿼리 |

</div>

---

## 6. 설계가 만든 결과 (Result)

채널별 상태머신 분리 + 후속처리 채널 분기 + 이력 테이블 조합이 만든 효과. 아래 표는 **설계·코드 구조에서 도출한 정성적 효과**이고, 그 다음 절에 **테스트로 잠근 계약**을 따로 정리했다. (응답시간·처리량 같은 **성능 지표는 여전히 미측정**이다 — 이 기능은 부하가 아니라 상태 전이 정확성이 쟁점이라 판단했다.)

<div class="table-wrap">

| **관점**             | **단일 상태머신·if/else로 짰다면**                          | **현재 설계 결과**                                                                                                                                    |
| ------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **확장성**<br>(변경 격리) | 채널·역할·재신청 분기가 한 메서드에 누적 → 신규 채널 추가 시 핵심 흐름 전체를 수정 | 단일 테이블·상태 enum·엔티티 가드를 채널 공통으로 재사용 → 채널 추가 시 스키마·상태 검증은 그대로 두고 후속처리만 승인 서비스 분기에 케이스 추가. 고객사 2단계·공급사 1단계를 한 상태모델로 표현 (분기가 늘면 Strategy 추출이 다음 단계) |
| **안정성**<br>(전이 강제) | 상태 검증 로직이 서비스 곳곳에 산재 → 누락 시 비정상 전이 가능             | 전이 가능 여부를 엔티티 메서드로 강제 → 승인·반려는 요청·재요청, 최종승인은 설정 대기에서만. 비정상 전이를 런타임에서 차단                                                                         |
| **추적성**<br>(감사)    | 상태 변경 주체·사유 기록이 누락될 수 있음                          | 모든 전이를 요청 이력에 INSERT → 누가·언제·어떤 사유로 처리했는지 100% 추적 (B2B 감사 요구 충족)                                                                                |
| **무결성**<br>(중복 차단) | 역할 추가 시 기업 마스터를 재생성 → 중복 마스터 위험                   | 역할 추가는 추가정보만 생성 + 권한 부여 → 기업 마스터 중복 0건. 중복 사업자번호·진행 중 요청 이중 검증으로 중복 가입요청 차단                                                                     |

</div>

## 7. 테스트로 잠근 계약

<aside class="callout tone-evidence" data-icon="🧪">

**컨트롤러 슬라이스 + 서비스 단위 테스트 15개**가 API 계약·승인 게이트·초대 매칭을 고정한다.

</aside>

<div class="table-wrap">

| **대상**                   | **테스트**                              | **고정한 계약**                                                                                                                                                                        |
| ------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API 계약                   | 컨트롤러 슬라이스 **3/3**<br>(`@WebMvcTest`) | 목록 200 OK · **검색조건이 서비스 요청 객체로 그대로 전달**된다 · 반려 사유 누락 시 400 (`@NotBlank` 계약)                                                                                                       |
| 승인 게이트<br>(§1 유입 프로세스)   | 서비스 단위 **7/7**                       | 수기등록 **고객사**는 비활성으로 생성 + 설정 대기 요청행 동반 생성 · 수기등록 **공급사 단독**은 종전대로 즉시 활성<br>🔴 **이관 경로는 고객사여도 활성** — 잠기면 되살릴 승인 경로가 없다<br>· 최종승인 활성화는 **재시도가 안전**하다 (이미 활성이면 no-op)                 |
| 직거래 초대 매칭<br>(**신규 경로**) | 서비스 단위 **5/5**                       | 사업자번호가 **미소진 직거래 초대**와 일치하면 운영사 대행 미사용으로 마킹 · 일치 초대가 없으면 마킹하지 않음(기본 유지)<br>· **자동승인** — 초대 매칭 시 즉시 승인 + 목록 제외 마킹 / 매칭 없으면 **거부**(수동 승인 경로 유지)<br>· **고객사 요청은 초대 매칭을 시도조차 하지 않는다** |

</div>

> 연동 상세는 「직거래(Direct Trade) 트랙」 카드의 §6 연결·초대 생명주기 참조.
