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
leadFigure: {"light":"/content-assets/stt/async-queue-observability/diagram-1.light.svg","dark":"/content-assets/stt/async-queue-observability/diagram-1.dark.svg","alt":"핵심 설계 결정 다이어그램"}
---

## 개요

무거운 STT+요약을 **Celery 백그라운드로 처리**하고, 실패를 추적·통보하는 운영 기반.

- 동기인 Celery 태스크와 async 파이프라인을 안전하게 잇는다
- async DB 커넥션은 멀티프로세스 환경에서 **NullPool**로 운용한다
- 구조화 JSON 로깅 + 에러 로그 테이블 + 통합 헬스체크로 관측성을 확보했다

<div class="table-wrap">

| **Celery 동시성 2** | **동기↔async 브리지** | **NullPool** | **구조화 JSON 로깅** | **헬스체크 4점검**     |
| ---------------- | ---------------- | ------------ | --------------- | ---------------- |
| Redis broker     | `asyncio.run`    | 멀티프로세스 안전    | 운영=JSON / 개발=컬러 | DB·Redis·STT·LLM |

</div>

---

## 왜 이 설계가 필요했는가 (Problem)

<aside class="callout tone-scenario" data-icon="🔀">

**시나리오 1 — 동기 Celery ↔ async 코드**\
Celery 태스크는 동기 함수인데, 상태 관리 모듈과 파이프라인은 async로 작성돼 있어 그대로는 호출할 수 없다.

</aside>

<aside class="callout tone-scenario" data-icon="🧵">

**시나리오 2 — async DB 풀의 멀티프로세스 위험**\
async 커넥션 풀을 Celery 멀티프로세스·멀티이벤트루프에서 공유하면, 커넥션이 생성된 루프 밖에서 재사용되며 불안정해진다.

</aside>

<aside class="callout tone-scenario" data-icon="🕳️">

**시나리오 3 — 실패가 조용히 묻힘**\
백그라운드 작업의 실패는 사용자도 운영자도 모른 채 지나가기 쉽다. 원인 추적 수단이 없으면 디버깅이 불가능하다.

</aside>

---

## 핵심 설계 결정

<figure class="diagram"><img src="/content-assets/stt/async-queue-observability/diagram-1.light.svg" alt="핵심 설계 결정 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/async-queue-observability/diagram-1.dark.svg" alt="핵심 설계 결정 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

### 1. 동기↔async 브리지 + 결과는 DB 직접 저장

<aside class="callout tone-orange" data-icon="🌉">

Celery 태스크 안에서 `asyncio.run` 으로 async 파이프라인을 실행한다.

- Celery 결과 백엔드 대신 **작업 테이블에 직접 저장** — 비즈니스 로직과 통합
- 에러 시에는 **새 이벤트 루프**를 만들어 상태·로그를 기록

</aside>

```text
# 동기 Celery 태스크 → async 파이프라인 실행
@Celery 태스크
def 전사·요약 파이프라인(작업 ID, 오디오 경로):
    try:
        return asyncio.run(배치 파이프라인(작업 ID, 오디오 경로))
    except 예외 as e:
        async def 실패 처리():  # 새 이벤트 루프에서 후처리
            await 에러 로그 기록(작업 ID, 단계, e)
            await 상태 갱신(작업 ID, 실패, 메시지=e)
        asyncio.run(실패 처리())
```

### 2. NullPool — 멀티프로세스/루프 안전

<aside class="callout tone-blue" data-icon="🧵">

Celery 등 멀티프로세스·멀티이벤트루프 환경에서는 async 커넥션 풀 공유가 위험하므로 <strong>풀링을 비활성화(NullPool)</strong> 해 매 작업마다 독립 커넥션을 쓴다. (FastAPI 메인 앱은 커넥션 풀 사용)

</aside>

```text
# 멀티프로세스/루프 환경에선 풀링을 끈 NullPool 로
from sqlalchemy.pool import NullPool
엔진 = create_async_engine(DB 주소, poolclass=NullPool, ...)
```

### 3. 구조화 JSON 로깅 + 환경별 포맷

<aside class="callout tone-green" data-icon="📝">

JSON 포매터가 시각·레벨·로거·메시지에 <strong>추가 컨텍스트(작업 ID 등)</strong> 를 합쳐 JSON 한 줄로 출력한다.

- **운영** — JSON(ELK/Datadog 연동)
- **개발** — 컬러 포맷으로 자동 전환

</aside>

```text
# JSON 포매터 — 로그 한 건을 JSON 한 줄로
로그 = {시각(UTC), 레벨, 로거 이름, 메시지}
if 추가 데이터가 있으면: 로그에 합침  # 작업 ID, 수치 등
if 예외 정보가 있으면: 로그["exception"] = 예외 포맷(예외 정보)
return JSON 문자열(로그)  # 한글 그대로
```

### 4. 에러 로그 테이블 + 통합 헬스체크

<aside class="callout tone-green" data-icon="🩺">

**에러 로그 테이블**\
실패는 에러 로그 테이블에 **서비스명·메시지·스택**으로 적재하고 조회 API로 본다.

**통합 헬스체크**\
헬스체크는 **DB·Redis·STT·LLM** 연결을 점검해, 하나라도 정상이 아니면 **503**을 반환한다.

</aside>

```text
# 헬스체크 — 핵심 의존성 점검, 하나라도 실패면 503
DB = 연결 확인 결과
STT = 모델 로드 여부
서비스 = {api: ok, DB, Redis, STT, LLM 제공자}
if LLM 을 뺀 항목 중 하나라도 ok 가 아니면:
    return 503 + 점검 결과
```

---

## 설계가 만든 결과 (Result)

<aside class="callout tone-blue" data-icon="📊">

이 설계의 목적은 <strong>"백그라운드 작업의 실패가 조용히 묻히지 않게 하는 것"</strong> 이다.\
그 중 실패 후처리 컨텍스트의 **3단계 후처리(에러 로그 · 상태 갱신 · 이벤트 통보)와 예외 재전파**를 테스트로 검증했다.

</aside>

### 검증 결과

실패 후처리 테스트 · **13/13 통과** (pytest)

<div class="table-wrap">

| **구분**                | **검증 내용**                                       |
| --------------------- | ----------------------------------------------- |
| 정상                    | 예외가 없으면 **아무 부수효과도 남기지 않는다**                    |
| 순서                    | 에러 로그 → 상태 갱신 → 이벤트 통보 순서대로 수행                  |
| 전달                    | 에러 메시지가 세 경로에 일관되게 전달 (작업 ID · 단계 · 페이로드 구조 포함) |
| 상세                    | DB 에러 로그에는 **스택 트레이스가 함께** 저장된다                 |
| 정책                    | 기본은 예외 재전파 / 재전파를 끄면 소멸                         |
| 정책                    | 실패 상태를 지정하면 상태·이벤트 페이로드 모두 반영                   |
| <strong>★ 내성</strong> | **한 단계가 실패해도 뒤 단계는 계속 수행된다** (3개 실패 지점 파라미터화)   |
| <strong>★ 내성</strong> | **세 단계가 모두 실패해도 원본 예외가 그대로 전파된다**               |
| 가드                    | 작업 상태 대역이 원본 정의와 일치하는지 드리프트 검사                  |

</div>

### 진짜 가치는 3단계 수행이 아니라 부분 실패 내성이다

<aside class="callout tone-orange" data-icon="🛡️">

<strong>DB 가 죽어 에러 로그를 못 남기더라도 상태 갱신과 SSE 통보는 돼야 한다.</strong>\
그래야 사용자가 최소한 "실패했다"는 사실은 알 수 있다. 세 단계가 각각 try/except 로 감싸인 이유가 이것이고,\
이 성질은 <strong>리팩터링으로 try 를 하나로 합치면 조용히 사라진다.</strong>\
그래서 실패 지점을 파라미터화해 고정했다.

</aside>

<div class="table-wrap">

| **주입한 실패**           | **기대 동작**                        |
| -------------------- | -------------------------------- |
| 에러 로그 실패 (DB 다운)     | 상태 갱신 · 이벤트 통보는 계속 수행            |
| 상태 갱신 실패             | 이벤트 통보는 계속 수행                    |
| 이벤트 통보 실패 (Redis 다운) | 원본 예외 전파 결정은 유지                  |
| **세 단계 모두 실패**       | **원본 예외("진짜 원인")가 그대로 상위로 올라간다** |

</div>

> 마지막 항목이 핵심이다 — <strong>후처리 실패가 원인 예외를 가려버리면 디버깅이 불가능해진다.</strong>

### 대역을 쓰되 원본과의 어긋남을 자동 감지한다

<aside class="callout tone-gray" data-icon="🔍">

작업 상태 정의는 상태 관리 모듈 안에 있고, 그 모듈이 상대 임포트로 DB · 캐시 모듈을 끌어와 <strong>단독 로드가 어렵다.</strong> 그래서 값을 복제해 쓰되, 원본 소스를 파싱해 **멤버가 일치하는지 검사하는 테스트**를 뒀다.\
→ 원본에 상태가 추가되면 그 테스트가 먼저 깨져 대역 갱신을 강제한다.

</aside>
