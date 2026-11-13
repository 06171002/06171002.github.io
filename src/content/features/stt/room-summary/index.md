---
title: "다자 화상회의 룸 요약"
slug: "room-summary"
project: "stt"
order: 4
domain: "스트리밍"
keywords: ["방 단위 집계","통합 요약","1:N"]
evidence: ["tested"]
draft: false
cover: null
notionEditedAt: "2026-08-30"
description: null
leadFigure: {"light":"/content-assets/stt/room-summary/diagram-3.light.svg","dark":"/content-assets/stt/room-summary/diagram-3.dark.svg","alt":"언제 요약할지 — 4상태 판정 다이어그램"}
---

## 참가자마다 따로 전사하고, 요약은 방 하나로

WebRTC 다자 화상회의에서 참가자별 STT 작업을 방 단위로 묶고, 전원이 끝나면 전체 대화를 LLM 으로 통합 요약한다. 참가자마다 말하는 속도와 끝나는 때가 다른데, 결과는 회의 전체를 아우르는 요약 하나여야 한다.

<figure class="diagram"><img src="/content-assets/stt/room-summary/diagram-1.light.svg" alt="참가자마다 따로 전사하고, 요약은 방 하나로 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/room-summary/diagram-1.dark.svg" alt="참가자마다 따로 전사하고, 요약은 방 하나로 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- 참가자마다 독립 WebSocket · 작업으로 병렬 전사하고, 마지막 참가자의 종료를 감지해 Celery 로 요약한다. 방 정보가 없으면 같은 코드가 1:1 모드로 동작한다.
- 같은 참가자의 작업이 이미 대기 · 처리 중이면 중복 접속으로 보고 409, 완료 · 실패면 재접속을 허용한다.

<figure class="diagram"><img src="/content-assets/stt/room-summary/diagram-2.light.svg" alt="참가자마다 따로 전사하고, 요약은 방 하나로 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/room-summary/diagram-2.dark.svg" alt="참가자마다 따로 전사하고, 요약은 방 하나로 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

---

## 언제 요약할지 — 4상태 판정

일부는 아직 말하고 있고 일부는 실패했을 수 있다. 섣불리 요약하면 대화가 빠지고, 영원히 안 하면 요약이 나오지 않는다. 그래서 참가자 작업이 끝날 때마다 진행 중 · 성공 · 실패 작업을 세어 네 상태 중 하나로 판정하고, **준비됨일 때만** 요약을 시작한다. 요약이 시작되면 방이 '요약 중'으로 넘어가 되돌릴 수 없다.

<figure class="diagram"><img src="/content-assets/stt/room-summary/diagram-3.light.svg" alt="언제 요약할지 — 4상태 판정 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/room-summary/diagram-3.dark.svg" alt="언제 요약할지 — 4상태 판정 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- **요약 태스크는 최대 5회 재시도**하고, 들어올 때 준비 판정을 한 번 더 확인한다. 아직 준비가 안 됐으면 재시도로 미룬다(경쟁 조건 방어). 준비됐으면 참가자별 대화록을 '--- 참가자: 이름 ---' 구분자로 이어 붙여 LLM 통합 요약을 만들고 방에 저장한다.
- 판정은 작업 종료 훅(`finally`)에서 불린다. 여기서 예외가 튀면 다른 후처리까지 말리므로, 조회가 실패하면 예외 대신 '조회 오류'라는 값을 돌려주고 호출부는 트리거하지 않는다.
- 자동 트리거는 마지막 참가자 작업이 끝날 때, 수동 트리거는 요약 요청 API 로 한다. 정확한 성과 범위는 '방 단위 완료 판정 · 재시도 설계 + 통합 요약 생성'이다.

---

## 결과 — 요약 준비 판정 테스트 15/15

pytest + hypothesis 로 검증했다.

<div class="table-wrap">

| **구분**    | **검증 내용**                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------- |
| 상태        | 4상태 전수 — 작업 없음 / 미준비(보류 3조합) / 전원 실패 / 준비됨(성공 3조합) · 일부 실패해도 성공이 있으면 준비됨(한 명 실패로 전체 요약을 포기하지 않는다) |
| **불변식 ①** | **진행 중인 작업이 있으면 어떤 조합에서도 준비됨이 아니다** (500건)                                                        |
| **불변식 ②** | **준비됨이면 반드시 성공한 작업이 있다** (500건)                                                                   |
| 불변식       | 집계가 서로 모순된 값이어도 정의된 상태만 돌려준다 (300건)                                                               |
| 방어 · 격리   | 집계 키가 일부 빠져도 판정이 깨지지 않는다(없는 키는 0) · 조회가 실패하면 '조회 오류'를 돌려주고 예외를 밖으로 던지지 않는다                        |
| 호환        | 기존 준비 여부 함수는 준비됨일 때만 참                                                                            |

</div>

두 불변식은 각각 다른 사고를 막는다. **①**은 아직 말하고 있는 참가자의 대화가 빠진 채 요약이 만들어지는 것을, **②**는 성공이 0건인데 빈 대화록으로 LLM 을 부르는 것을 막는다. 둘 다 예시 테스트로는 조합을 덮을 수 없어 무작위 500건으로 확인했다.
