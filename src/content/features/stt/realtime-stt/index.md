---
title: "실시간 스트리밍 STT"
slug: "realtime-stt"
project: "stt"
order: 5
domain: "스트리밍"
keywords: ["WebSocket","Silero VAD","ThreadPool","큐 분리","Redis Pub/Sub"]
evidence: ["tested","measured"]
draft: false
cover: null
notionEditedAt: "2026-08-31"
description: null
glance: {"headline":"실시간 음성 전사 — 추론은 스레드풀로 빼고 무음은 STT 전에 걸러, 배포 서버에서 단일 세션 실시간 전사를 유지했다","problem":["STT 추론은 동기 연산이라 이벤트 루프에서 돌리면 다른 연결의 송수신이 모두 멈춘다.","들어오는 소리를 전부 STT에 넣으면 무음에서 자원을 낭비하고 없는 말이 생기며, 연결이 끊기면 마지막 발화가 사라진다."],"solution":["입력 · 결과 큐를 나누고 추론은 스레드풀로 넘겨 이벤트 루프를 비웠다.","32ms 프레임마다 음성 확률로 발화 경계를 자르는 상태머신으로 무음을 STT 전에 거르고, 연결이 끊기면 남은 버퍼를 채워 강제 전사한다."],"result":["상태머신 테스트 17/17 통과 — 무음만 들어오면 세그먼트가 하나도 나오지 않는다(hypothesis 300 케이스).","배포 서버(CPU)에서 30초 음성을 실시간 배속으로 흘리자 자막 지연 5.1~6.0초(평균 약 5.5초)로 구간이 쌓이지 않고 실시간을 따라갔다."]}
leadFigure: {"light":"/content-assets/stt/realtime-stt/diagram-1.light.svg","dark":"/content-assets/stt/realtime-stt/diagram-1.dark.svg","alt":"소리가 자막이 되기까지 다이어그램"}
---

## 소리가 자막이 되기까지

WebSocket 으로 들어오는 오디오 청크를 버퍼링 없이 실시간으로 전사한다. 세 가지가 걸렸다.

- STT 추론은 CPU · GPU 를 붙잡는 동기 연산이라, 이벤트 루프에서 바로 돌리면 추론하는 동안 다른 연결의 송수신이 모두 멈춘다.
- 들어오는 소리를 전부 STT 에 넣으면 침묵까지 연산해 자원을 낭비하고, 무음에서 없는 말(환각)이 생긴다.
- VAD 가 발화 끝을 확정하기 전에 연결이 끊기면, 버퍼에 남은 마지막 발화가 전사되지 않고 사라진다.

<figure class="diagram"><img src="/content-assets/stt/realtime-stt/diagram-1.light.svg" alt="소리가 자막이 되기까지 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/realtime-stt/diagram-1.dark.svg" alt="소리가 자막이 되기까지 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

---

## 추론은 스레드풀로 — 이벤트 루프를 비운다

수신과 인식을 떼어 놓으려고 입력 큐와 결과 큐를 나누고, STT 추론은 스레드풀(워커 3개)로 넘긴다.

<figure class="diagram"><img src="/content-assets/stt/realtime-stt/diagram-2.light.svg" alt="추론은 스레드풀로 — 이벤트 루프를 비운다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/realtime-stt/diagram-2.dark.svg" alt="추론은 스레드풀로 — 이벤트 루프를 비운다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

---

## 무음은 STT 전에 거른다 — 발화 분할 상태머신

16kHz 오디오를 32ms 프레임마다 Silero VAD 에 넣어 음성 확률을 받고(임계값 0.5, 민감도 설정 3 이상이면 0.6), 상태머신으로 발화를 자른다. 무음 구간은 STT 로 가지 않는다.

<figure class="diagram"><img src="/content-assets/stt/realtime-stt/diagram-3.light.svg" alt="무음은 STT 전에 거른다 — 발화 분할 상태머신 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/realtime-stt/diagram-3.dark.svg" alt="무음은 STT 전에 거른다 — 발화 분할 상태머신 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

포맷마다 디코딩도 다르다. Raw PCM 은 NumPy 로 바로(가장 빠름), Opus · WebM 은 PyAV 스트리밍 파서로, 그 밖(MP3 등)은 Pydub 로 처리한다.

---

## 끊겨도 마지막 발화는 전사한다

<figure class="diagram"><img src="/content-assets/stt/realtime-stt/diagram-4.light.svg" alt="끊겨도 마지막 발화는 전사한다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/realtime-stt/diagram-4.dark.svg" alt="끊겨도 마지막 발화는 전사한다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

---

## 결과

**발화 분할 상태머신 테스트 17/17 통과** (pytest + hypothesis). 이 설계의 핵심 주장인 '무음은 STT 호출에서 빠진다'를 직접 검증했다.

<div class="table-wrap">

| **검증 내용**                                                   | **방식**                  |
| ----------------------------------------------------------- | ----------------------- |
| **무음만 들어오면 세그먼트가 한 번도 나오지 않는다**                             | hypothesis 300건 (임의 길이) |
| **최소 발화 길이(5프레임)에 못 미치면 침묵이 와도 버려진다**                       | hypothesis 200건         |
| 연속 음성 5프레임에 닿아야 발화로 인정한다                                    | 경계                      |
| 침묵 20프레임에 세그먼트를 낸다 · 19프레임까지는 내지 않는다                        | 경계 양방향                  |
| 세그먼트를 낸 뒤 상태를 완전히 초기화한다 (모델 내부 상태 포함)                       | —                       |
| **프레임 크기가 다르면 무시하고 상태를 바꾸지 않는다** — 부분 청크가 발화 경계를 어긋나게 하지 않게 | 5가지 크기                  |
| 종료 플러시는 최소 길이 조건을 무시하고 남은 버퍼를 낸다                            | 종료 유실 방지                |
| 민감도 설정 3 이상 → 임계값 0.6                                       | 설정 변환                   |

</div>

<strong>모델은 스텁, 상태머신은 실물로 테스트했다.</strong> Silero 모델의 정확도는 그 프로젝트의 책임이고, 내가 만든 것은 확률값을 받아 발화 경계를 자르는 상태머신이다. 그래서 모델을 '프레임별 음성 확률을 테스트가 정하는' 스텁으로 바꿔 경계 조건을 결정론적으로 고정했다 — 실제 모델은 수백 MB 를 내려받아야 하고 확률도 비결정적이라 경계를 검증할 수 없다. 설정 상수는 하드코딩하지 않고 실제 설정 파일을 읽는다. 운영 값이 바뀌면 테스트가 반응해야 하기 때문이다.\
<strong>배포 서버 실측 (2026-08-30)</strong> — 로컬이 아니라 GPU 없이 CPU 로만 추론하는 배포 서버에서 쟀다. 30초 한국어 음성을 실시간 배속(1.0x)으로 WebSocket 에 흘리고, 발화가 끝난 때부터 전사 결과가 DB 에 기록된 때까지를 자막 지연으로 판정했다(단일 세션).

<div class="table-wrap">

| **발화 구간**      | **길이** | **자막 지연** |
| -------------- | ------ | --------- |
| 7.39 → 12.83s  | 5.44s  | \~5.2s    |
| 13.02 → 18.94s | 5.92s  | \~5.1s    |
| 19.33 → 25.31s | 5.98s  | \~5.7s    |
| 25.60 → 29.98s | 4.38s  | \~6.0s    |

</div>

<figure class="diagram"><img src="/content-assets/stt/realtime-stt/diagram-5.light.svg" alt="결과 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/realtime-stt/diagram-5.dark.svg" alt="결과 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

<strong>자막 지연 5.1\~6.0초(평균 약 5.5초), 처리량은 실시간을 따라간다.</strong> 자막이 기록되는 간격(6 · 7 · 5초)이 오디오 간격(6.11 · 6.37 · 4.67초)과 거의 같다 — 구간이 쌓이지 않는다는 뜻이다. 지연은 처리량 부족이 아니라 일정한 오프셋이다.
