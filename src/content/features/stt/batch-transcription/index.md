---
title: "배치 전사·요약"
slug: "batch-transcription"
project: "stt"
order: 1
domain: "배치"
keywords: ["Celery","SSE","멀티파트 업로드"]
evidence: ["tested"]
draft: false
cover: null
notionEditedAt: "2026-08-31"
description: null
leadFigure: {"light":"/content-assets/stt/batch-transcription/diagram-1.light.svg","dark":"/content-assets/stt/batch-transcription/diagram-1.dark.svg","alt":"긴 녹음은 뒤에서, 진행은 실시간으로 다이어그램"}
---

## 긴 녹음은 뒤에서, 진행은 실시간으로

업로드된 오디오를 백그라운드(Celery)에서 전사 · 요약하고, 진행 상황을 SSE 로 실시간 푸시한다. 긴 오디오의 전사 + 요약은 수십 초 \~ 수 분이 걸려서, HTTP 요청 안에서 동기로 처리하면 게이트웨이 타임아웃과 커넥션 점유가 생긴다. 전부 끝나야 결과를 주면 사용자는 그동안 진행을 알 수 없고, 작업 도중에 SSE 를 연결하면 이미 지나간 세그먼트를 놓쳐 화면이 비어 보인다.\
그래서 업로드는 202 로 바로 받고, 워커가 세그먼트를 하나씩 저장 · 발행한다.

<figure class="diagram"><img src="/content-assets/stt/batch-transcription/diagram-1.light.svg" alt="긴 녹음은 뒤에서, 진행은 실시간으로 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/batch-transcription/diagram-1.dark.svg" alt="긴 녹음은 뒤에서, 진행은 실시간으로 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

---

## Look-ahead — 마지막 세그먼트를 미리 안다

다음 세그먼트를 한 칸 미리 읽어 지금 것이 마지막인지 판별한다. 중간은 '처리 중', 마지막은 '전사 완료'로 태깅하고, 각 세그먼트를 바로 DB 에 저장하고 Redis 로 발행한다 — 메모리에는 한 개씩만 둔다. SSE 클라이언트는 이 태그로 스트림이 끝났는지 판단하므로, 태그가 어긋나면 화면이 영원히 기다리거나 대화가 잘린 채 끝난 것처럼 보인다.

<figure class="diagram"><img src="/content-assets/stt/batch-transcription/diagram-2.light.svg" alt="Look-ahead — 마지막 세그먼트를 미리 안다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/batch-transcription/diagram-2.dark.svg" alt="Look-ahead — 마지막 세그먼트를 미리 안다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

---

## SSE — 늦게 연결해도 처음부터 본다

<figure class="diagram"><img src="/content-assets/stt/batch-transcription/diagram-3.light.svg" alt="SSE — 늦게 연결해도 처음부터 본다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/batch-transcription/diagram-3.dark.svg" alt="SSE — 늦게 연결해도 처음부터 본다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

늦게 연결해도 전체 히스토리를 받고, 이미 끝난 작업은 쓸데없이 구독하지 않는다.

---

## 실패는 한 곳에서, 무음은 실패가 아니다

<figure class="diagram"><img src="/content-assets/stt/batch-transcription/diagram-4.light.svg" alt="실패는 한 곳에서, 무음은 실패가 아니다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/batch-transcription/diagram-4.dark.svg" alt="실패는 한 곳에서, 무음은 실패가 아니다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- **3단계 에러 후처리** — async 컨텍스트 매니저로 파이프라인 예외를 한 곳에서 잡는다. 구조화 로그를 남긴 뒤 ① 에러 로그 테이블(단계 · 메시지 · 스택)에 적고 ② 상태를 실패로 바꾸고 ③ Redis 로 오류 이벤트를 발행해 SSE 클라이언트가 바로 알게 한다. 예외는 삼켜 Celery 태스크가 죽지 않는다.
- **무음은 정상 종결** — 세그먼트가 하나도 없으면(무음 파일 · 인식 불가) 실패가 아니라 빈 요약으로 끝낸다. LLM 을 부르지 않고(빈 대화록으로 부르면 비용만 나간다), 오류 이벤트도 내지 않는다(내면 SSE 클라이언트가 실패로 표시한다).

---

## 결과 — look-ahead 파이프라인 테스트 10/10

<div class="table-wrap">

| **구분** | **검증 내용**                                                                 |
| ------ | ------------------------------------------------------------------------- |
| **태깅** | 세그먼트가 몇 개든 <strong>마지막 하나만 '전사 완료'</strong>, 나머지는 '처리 중' (1\~30개 무작위)     |
| 경계     | 세그먼트가 <strong>하나뿐이면 그 하나가 바로 '전사 완료'</strong> — off-by-one 이 가장 잘 드러나는 지점 |
| 순서     | 세그먼트 번호 1부터 순서대로 · 본문과 DB 저장 순서가 같다                                       |
| 누락 방지  | 세그먼트마다 **저장과 발행을 모두** 한다                                                  |
| 흐름     | 전사 후 '전사 완료' → LLM 요약 → 최종 요약 발행 → '완료'                                   |
| 무음     | 세그먼트 0개면 **LLM 을 부르지 않고 '완료'로 종결**, 오류 이벤트 없음                             |
| 실패     | 전사 도중 예외 → 오류 이벤트 발행 + DB 로그, **예외는 삼켜 Celery 태스크가 죽지 않는다**               |

</div>

look-ahead 는 off-by-one 이 나기 가장 쉬운 패턴이라, 세그먼트 수를 1\~30 으로 무작위로 바꿔 가며 정확히 하나만 '전사 완료'인지 확인했다. 세그먼트가 1개인 경우(첫 세그먼트 = 마지막)는 분기가 달라 따로 경계 테스트로 고정했다.

---

## 배포 환경의 자원 예산 (2026-08-30 확인)

배치 워커와 실시간 스트리밍 API 는 **같은 서버의 같은 CPU 를 나눠 쓴다**(GPU 없음). 그래서 Celery 동시성 2 는 따로 정한 숫자가 아니라 실시간 경로와 예산을 나눈 결과다.

<figure class="diagram"><img src="/content-assets/stt/batch-transcription/diagram-5.light.svg" alt="배포 환경의 자원 예산 (2026-08-30 확인) 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/batch-transcription/diagram-5.dark.svg" alt="배포 환경의 자원 예산 (2026-08-30 확인) 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

실시간 스트리밍은 API 서버가 전담하고 워커는 배치만 처리하므로 API 에 코어를 더 배분했다. 워커는 Celery 자식 프로세스마다 추론 스레드가 따로 생겨서 동시성과 자식당 추론 스레드를 함께 묶었다 — GPU 구성의 동시성 4 를 CPU 배포에서 2 로 줄인 이유다. 그래서 배치 쪽은 최대 4 스레드로 상한이 있고, 상한이 없는 쪽은 실시간 경로다(세션마다 스레드풀이 새로 생긴다 — 「실시간 스트리밍 STT」 카드).

<div class="table-wrap">

| **STT 설정** | <strong>실시간(API 서버)</strong> | <strong>배치(워커)</strong> | **비고**                                                                                        |
| ---------- | ---------------------------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| beam 크기    | 코드 기본 1 (greedy) · 배포 **5**  | **5** (라이브러리 기본값)       | 30초 표본 음성 벤치마크에서 greedy 가 "가정"을 "과정"으로 잘못 알아들어, 배포에서는 실시간도 5 로 올렸다. 배치 경로는 beam 을 설정에서 읽지 않는다 |
| 연산 정밀도     | int8                         | int8                    | int8_float32 는 출력이 문자 단위로 같고 속도도 같아 올릴 이유가 없었다                                                |

</div>

코드 기본값으로는 실시간 beam 1 · 배치 beam 5 로 갈리지만, <strong>배포에서는 실시간도 beam 5 로 맞춰 두 경로가 같았다.</strong> 또 배치 경로는 beam 을 설정에서 읽지 않아 라이브러리 기본값을 따른다 — 「멀티 엔진 추상화 (STT·LLM)」 카드의 설정 기반 튜닝이 beam 에 대해서는 실시간 경로에만 닿는다.
