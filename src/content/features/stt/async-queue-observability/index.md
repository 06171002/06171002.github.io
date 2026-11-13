---
title: "비동기 큐 & 관측성"
slug: "async-queue-observability"
project: "stt"
order: 3
domain: "인프라"
keywords: ["Celery 재시도","에러로그","구조화 로깅","NullPool"]
evidence: ["tested"]
draft: false
cover: null
notionEditedAt: "2026-08-31"
description: null
leadFigure: {"light":"/content-assets/stt/async-queue-observability/diagram-1.light.svg","dark":"/content-assets/stt/async-queue-observability/diagram-1.dark.svg","alt":"백그라운드 작업이 조용히 실패하지 않게 다이어그램"}
---

## 백그라운드 작업이 조용히 실패하지 않게

무거운 STT + 요약을 Celery 백그라운드로 돌리고, 실패를 추적 · 통보하는 운영 기반이다. 세 가지가 걸렸다.

- Celery 태스크는 동기 함수인데, 상태 관리 모듈과 파이프라인은 async 로 작성돼 그대로는 부를 수 없다.
- async 커넥션 풀을 Celery 의 여러 프로세스 · 여러 이벤트 루프에서 함께 쓰면, 커넥션이 만들어진 루프 밖에서 재사용돼 불안정해진다.
- 백그라운드 작업의 실패는 사용자도 운영자도 모른 채 지나가기 쉽다. 원인을 추적할 수단이 없으면 디버깅이 불가능하다.

<figure class="diagram"><img src="/content-assets/stt/async-queue-observability/diagram-1.light.svg" alt="백그라운드 작업이 조용히 실패하지 않게 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/async-queue-observability/diagram-1.dark.svg" alt="백그라운드 작업이 조용히 실패하지 않게 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- **① 동기 ↔ async 브리지** — Celery 태스크 안에서 `asyncio.run` 으로 async 파이프라인을 실행한다. 결과는 Celery 결과 백엔드 대신 작업 테이블에 직접 저장해 비즈니스 로직과 묶고, 오류가 나면 새 이벤트 루프를 만들어 상태 · 로그를 기록한다.
- **② NullPool** — Celery 쪽은 커넥션 풀링을 끄고(NullPool) 작업마다 독립 커넥션을 쓴다. FastAPI 메인 앱은 커넥션 풀을 쓴다.
- **③ 구조화 JSON 로깅** — 시각 · 레벨 · 로거 · 메시지에 작업 ID 같은 추가 컨텍스트를 합쳐 JSON 한 줄로 남긴다. 운영은 JSON(ELK/Datadog 연동), 개발은 컬러 포맷으로 자동 전환한다.
- **④ 에러 로그 테이블 · 헬스체크** — 실패는 서비스명 · 메시지 · 스택으로 적재해 조회 API 로 본다. 헬스체크는 DB · Redis · STT · LLM 을 점검하고, LLM 을 뺀 항목 중 하나라도 정상이 아니면 503 을 돌려준다.

---

## 실패 후처리 — 한 단계가 죽어도 나머지는 간다

파이프라인 예외는 한 곳에서 잡아 세 단계로 후처리한다. 단계마다 따로 try/except 로 감쌌다. DB 가 죽어 에러 로그를 못 남기더라도 상태 갱신과 SSE 통보는 돼야, 사용자가 최소한 '실패했다'는 사실은 알 수 있기 때문이다.

<figure class="diagram"><img src="/content-assets/stt/async-queue-observability/diagram-2.light.svg" alt="실패 후처리 — 한 단계가 죽어도 나머지는 간다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/async-queue-observability/diagram-2.dark.svg" alt="실패 후처리 — 한 단계가 죽어도 나머지는 간다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

이 성질은 리팩터링으로 try 를 하나로 합치면 조용히 사라진다. 그래서 실패 지점을 바꿔 가며 넣는 테스트로 고정했다.

<div class="table-wrap">

| **넣은 실패**            | **기대 동작**                     |
| -------------------- | ----------------------------- |
| 에러 로그 실패 (DB 다운)     | 상태 갱신 · 이벤트 통보는 계속한다          |
| 상태 갱신 실패             | 이벤트 통보는 계속한다                  |
| 이벤트 통보 실패 (Redis 다운) | 원본 예외를 다시 던지는 결정은 그대로다        |
| **세 단계 모두 실패**       | **원본 예외(진짜 원인)가 그대로 위로 올라간다** |

</div>

마지막 항목이 핵심이다 — <strong>후처리 실패가 원인 예외를 가려 버리면 디버깅이 불가능해진다.</strong>

---

## 결과 — 실패 후처리 테스트 13/13

<div class="table-wrap">

| **구분**  | **검증 내용**                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------- |
| 정상      | 예외가 없으면 **아무 부수효과도 남기지 않는다**                                                                            |
| 순서 · 전달 | 에러 로그 → 상태 갱신 → 이벤트 통보 순서로, 에러 메시지가 세 경로에 일관되게 간다(작업 ID · 단계 · 페이로드 구조 포함). DB 에러 로그에는 스택 트레이스가 함께 저장된다 |
| 정책      | 기본은 예외 재전파, 재전파를 끄면 소멸 · 실패 상태를 지정하면 상태와 이벤트 페이로드 모두 반영                                                 |
| **내성**  | **한 단계가 실패해도 뒤 단계는 계속한다**(실패 지점 3곳) · **세 단계가 모두 실패해도 원본 예외가 그대로 전파된다**                                 |
| 가드      | 테스트가 쓰는 작업 상태 대역이 원본 정의와 같은지 검사한다                                                                       |

</div>

<strong>대역을 쓰되 원본과의 어긋남은 자동으로 잡는다.</strong> 작업 상태 정의는 상태 관리 모듈 안에 있고, 그 모듈이 DB · 캐시 모듈을 끌어와 단독으로 불러오기 어렵다. 그래서 값을 복제해 쓰되, 원본 소스를 파싱해 멤버가 일치하는지 검사하는 테스트를 두었다. 원본에 상태가 추가되면 그 테스트가 먼저 깨져 대역 갱신을 강제한다.
