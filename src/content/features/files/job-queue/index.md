---
title: "작업 대기열 — 임대를 잃은 작업"
slug: "job-queue"
project: "files"
order: 3
domain: "작업 처리"
keywords: ["DB 작업 대기열","SKIP LOCKED","임대 토큰","주기 작업 잠금"]
evidence: ["tested"]
draft: false
cover: null
notionEditedAt: "2026-11-11"
description: null
glance: {"headline":"메시지 브로커 없이 DB 로 만든 작업 대기열에서, 임대를 잃은 작업이 남의 파일을 지울 수 있던 구멍을 임대 토큰으로 막았다","problem":["처리가 임대 기한을 넘기면 작업이 회수되어 다른 작업자가 같은 업로드를 또 처리한다.","결과 기록이 누가 잡았는지 보지 않아, 늦게 끝난 실행이 같은 키에 먼저 등록된 파일의 내용을 지울 수 있었다."],"solution":["작업을 잡을 때마다 무작위 임대 토큰을 적고, 결과 기록 · 기한 연장 · 등록은 토큰이 같을 때만 한다.","처리하는 동안 임대 기한의 1/3 마다 기한을 늘리고, 저장소에서 지우기 직전에 임대를 다시 확인한다."],"result":["묵은 토큰의 연장 · 성공 · 재시도 · 실패 기록이 모두 거부되고, 임대를 잃은 처리는 등록도 삭제도 하지 않는다(테스트).","두 서버를 띄운 통합 테스트에서 엇갈려 처리한 직접 업로드 6개가 각각 한 번에 처리되고, 주기 작업은 회차마다 한 서버만 돌았다."]}
leadFigure: {"light":"/content-assets/files/job-queue/diagram-2.light.svg","dark":"/content-assets/files/job-queue/diagram-2.dark.svg","alt":"임대를 잃은 작업이 남의 파일을 지울 수 있었다 다이어그램"}
---

## 메시지 브로커 없이 DB 로

업로드 뒤 처리 · 재검사 같은 작업은 **DB 의 작업 기록과 서버 안 작업자**로 돌린다. 설치형으로 배포하는 환경은 구성 요소가 적을수록 좋아, Redis · RabbitMQ · SQS 같은 메시지 큐는 고르지 않았다. 작업은 **상태 변경과 같은 트랜잭션**에서 넣는다 — '상태는 바뀌었는데 작업이 없는' 경우도, 그 반대도 생기지 않는다.

<figure class="diagram"><img src="/content-assets/files/job-queue/diagram-1.light.svg" alt="메시지 브로커 없이 DB 로 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/files/job-queue/diagram-1.dark.svg" alt="메시지 브로커 없이 DB 로 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- 작업자는 SKIP LOCKED 로 남이 잡은 행을 건너뛰며 작업을 집고, 집을 때 **임대 기한**을 적는다.
- 실패하면 시도할 때마다 두 배로 늘어나는 간격 뒤에 다시 하고, 정한 횟수를 넘으면 실패로 끝내며 마무리 처리를 부른다.
- 주기 작업이 임대 기한이 지난 작업을 대기로 되돌린다. 처리 중에 서버가 죽어도 작업이 사라지지 않는다.

---

## 임대를 잃은 작업이 남의 파일을 지울 수 있었다

서버 여러 대 운영을 설계하며 코드를 점검하다, 세 가지가 겹친 결함을 찾았다.

- 처리가 오래 걸려도 **임대 기한을 늘리지 않는다**. 기한이 지나면 회수되어, 다른 작업자가 같은 업로드를 또 처리한다.
- 결과 기록(성공 · 재시도 · 실패)은 작업이 '실행 중'인지만 보고 **누가 잡았는지는 보지 않는다**. 다시 집힌 작업도 '실행 중'이라, 늦게 끝난 실행의 기록이 그대로 통과한다.
- 저장 위치가 파일 ID 로 정해져 **두 실행이 같은 키에 쓴다**. 늦게 끝난 쪽은 등록에서 '처리 중 아님'을 받으면 취소로 보고 자기가 쓴 키를 지웠다. 그 키가 먼저 등록된 파일의 원본 · 썸네일이다.

<figure class="diagram"><img src="/content-assets/files/job-queue/diagram-2.light.svg" alt="임대를 잃은 작업이 남의 파일을 지울 수 있었다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/files/job-queue/diagram-2.dark.svg" alt="임대를 잃은 작업이 남의 파일을 지울 수 있었다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

처리 하나가 임대 기한을 넘길 때 난다 — 큰 파일, 느린 저장소, 검사기 재시도가 겹치면 넘길 수 있다. 작업자가 기본 2개라 **서버 한 대에서도** 난다. 실제로 일어난 기록은 없고, 코드를 읽어 찾은 결함이다.

---

## 임대 토큰

<figure class="diagram"><img src="/content-assets/files/job-queue/diagram-3.light.svg" alt="임대 토큰 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/files/job-queue/diagram-3.dark.svg" alt="임대 토큰 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- 작업을 잡을 때마다 **무작위 임대 토큰**(128비트)을 적고, 결과 기록과 기한 연장은 토큰이 같을 때만 한다.
- 처리하는 동안 임대 기한의 **1/3 마다** 기한을 늘린다.
- 등록 트랜잭션이 작업 행을 잠그고 토큰을 확인한다. 임대를 잃은 실행은 등록하지 않는다.
- 저장소에서 지우기 직전에 임대를 다시 확인하고, 확인에 실패하거나 DB 오류가 나면 지우지 않는다.

<div class="table-wrap">

| 고르지 않은 안     | 이유                                                                   |
| ------------ | -------------------------------------------------------------------- |
| 실행마다 다른 저장 키 | 저장 키 규칙과 문서가 바뀐다. 임대를 잃은 실행이 쓴 객체는 이긴 실행이 같은 키에 같은 내용을 쓰므로 그대로 둬도 된다 |

</div>

---

## 서버가 여러 대일 때 — 주기 작업은 회차마다 한 대만

정리 · 재검사 등록 · 작업 회수 같은 주기 작업이 서버마다 돌면 겹친다. 재검사 등록이 두 서버에서 겹치면 교착으로 그 회차가 멈출 수도 있다. 작업마다 **잠금 행 하나**를 두고, '잠금 기한 < 지금(DB 시각)'일 때만 바꾸는 **조건부 갱신**을 한다. 1행을 바꾼 서버만 그 회차를 실행한다.

<figure class="diagram"><img src="/content-assets/files/job-queue/diagram-4.light.svg" alt="서버가 여러 대일 때 — 주기 작업은 회차마다 한 대만 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/files/job-queue/diagram-4.dark.svg" alt="서버가 여러 대일 때 — 주기 작업은 회차마다 한 대만 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- 실행이 길어져 회차가 겹쳐도, 각 작업이 조건부 갱신이라 결과가 꼬이지 않는다.
- 같은 일을 하는 분산 잠금 라이브러리(ShedLock)도 있지만, 의존성이 늘고 작업 대기열과 같은 방식(조건부 갱신)이라 직접 만들었다.

---

## 확인

<div class="table-wrap">

| 무엇을       | 어떻게 확인했나                                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| 묵은 토큰     | MySQL 통합 테스트 — 묵은 토큰으로는 연장 · 성공 · 재시도 · 실패 기록이 모두 거부된다                                                     |
| 기한 연장     | 300ms 임대를 100ms 마다 늘려, 처리하는 동안 3번 넘게 연장된다                                                                  |
| 임대를 잃은 처리 | 등록도 저장소 삭제도 하지 않는다. 기한을 과거로 바꿔 강제로 임대를 잃게 해도 먼저 등록된 파일이 남는다(보안 체크리스트 행)                                    |
| 죽은 작업자    | 임대 기한이 지난 작업은 대기로 돌아가 다른 작업자가 처리한다(보안 체크리스트 행)                                                             |
| 서버 두 대    | 두 앱을 같은 DB · 시험 저장소에 띄운 통합 테스트 — 서버를 엇갈려 발급 · 완료한 직접 업로드 6개가 각각 한 번의 시도로 처리되고, 세 회차 모두 한 서버만 주기 작업 잠금을 잡는다 |

</div>

- 이 단계를 마친 뒤 전체 테스트(앱 351개 · DB 마이그레이션 20개)가 실패 없이 돌았다.
- 시범 연동에서 교착으로 실패한 처리 작업을 재시도가 10초 뒤 받아 냈다 — 「동시 업로드 교착」

<strong>이 카드의 코드 · 테스트 · 설계 문서는 AI 코딩 에이전트와 함께 썼고, 임대 토큰과 주기 작업 잠금을 포함한 서버 여러 대 운영 단계의 '정할 것' 12개는 내가 검토해 정했다(2026-11-11).</strong>
