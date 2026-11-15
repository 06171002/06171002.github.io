---
title: "실시간 받아쓰기 — 밀려도 건너뛰지 않는다"
slug: "realtime-stt"
project: "stt"
order: 1
domain: "스트리밍"
keywords: ["WebSocket","Silero VAD","faster-whisper","순서 보장"]
evidence: ["tested","measured"]
draft: false
cover: null
notionEditedAt: "2026-11-11"
description: null
glance: {"headline":"말이 멈춘 곳에서 문장을 자르고, 받아쓰기가 밀려도 한 문장도 건너뛰지 않고 순서대로 돌려준다","problem":["부르는 쪽은 끊김 없는 소리를 아무 데서나 잘라 보낼 뿐, 문장이 어디서 끝나는지 알려 주지 않는다.","받아쓰기는 서버 전체에서 한 번에 하나만 돌아 밀릴 수 있는데, 밀린 소리를 버리면 상담 기록에 빈 구간이 생긴다."],"solution":["32ms 프레임마다 음성 확률을 보고, 0.5초 쉬면 문장을 닫고 쉬지 않으면 15초에서 자르며 0.25초보다 짧은 소리는 버린다.","문장을 연결마다 대기열에 넣어 하나씩 순서대로 받아쓰고, 건너뛰는 대신 문장마다 얼마나 늦었는지를 함께 보낸다."],"result":["첫 문장을 받아쓰는 동안 다섯 문장이 들어와도 다섯 개가 순서대로 돌아오는 것을 테스트로 고정했다.","로컬에서 한국어 음성 17.4초를 실시간 속도로 보내자 문장 넷이 순서대로 왔고('네'도 따로), 늦은 정도는 480~580ms 였다.","연결 둘을 동시에 열어도 둘 다 문장 넷을 받았고, 뒤 차례 연결은 약 1000ms 로 늦게 받았다."]}
leadFigure: {"light":"/content-assets/stt/realtime-stt/diagram-1.light.svg","dark":"/content-assets/stt/realtime-stt/diagram-1.dark.svg","alt":"소리가 문장이 되기까지 다이어그램"}
---

## 소리가 문장이 되기까지

화상 상담 자막처럼 끊김 없이 들어오는 소리를 받아 **문장 단위**로 돌려준다. 부르는 쪽은 머리 없는 PCM 을 아무 데서나 잘라 보낼 뿐, 문장이 어디서 끝나는지는 알려 주지 않는다. 서버가 말이 멈춘 곳을 찾아 한 문장씩 받아쓴다. 요약 · 번역은 하지 않는다 — 연결 하나가 화자 한 명이고, 누가 말했는지는 부르는 쪽이 안다.

<figure class="diagram"><img src="/content-assets/stt/realtime-stt/diagram-1.light.svg" alt="소리가 문장이 되기까지 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/realtime-stt/diagram-1.dark.svg" alt="소리가 문장이 되기까지 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

문장의 시각은 벽시계가 아니라 **받은 샘플 수**로 센다 — 연결을 연 뒤 몇 초째 소리인지가 그대로 자막 시각이 된다.

---

## 말이 멈춘 곳에서 자른다

32ms 프레임마다 Silero VAD 로 음성 확률을 받아 문장을 자른다. faster-whisper 에 들어 있는 모델이라 새 의존성이 없다.

<figure class="diagram"><img src="/content-assets/stt/realtime-stt/diagram-2.light.svg" alt="말이 멈춘 곳에서 자른다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/realtime-stt/diagram-2.dark.svg" alt="말이 멈춘 곳에서 자른다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- **시작과 끝의 문턱을 다르게** 뒀다. 0.5 이상이면 말이 시작되고, 말하는 중에는 0.35 아래로 떨어져야 침묵으로 센다 — 약하게 발음한 음절에서 문장이 끊기지 않게.
- 말이 시작되기 직전 **0.2초를 붙여** 첫 음절이 잘리지 않게 한다.
- VAD 모델은 부를 때마다 빈 상태에서 시작한다. 그래서 새 프레임 앞에 **직전 1초**를 붙여 넣어 판단할 근거를 준다.
- 아무 데서나 자른 소리도 한 번에 보낸 것과 **같은 문장**이 된다. 프레임에 모자란 바이트는 다음 조각과 이어 붙이고, 끝낼 때 남은 바이트는 침묵으로 채워 마지막 음절까지 받아쓴다.

---

## 밀려도 건너뛰지 않는다

받아쓰기는 서버 전체에서 한 번에 하나만 돈다. 연결이 여럿이거나 말이 빨리 이어지면 문장이 차례를 기다린다. 밀린 소리를 버리면 자막은 빨라지지만 **상담 기록에 빈 구간**이 생긴다. 그래서 건너뛰지 않고, 대신 문장마다 **얼마나 늦었는지**를 함께 보낸다.

<figure class="diagram"><img src="/content-assets/stt/realtime-stt/diagram-3.light.svg" alt="밀려도 건너뛰지 않는다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/realtime-stt/diagram-3.dark.svg" alt="밀려도 건너뛰지 않는다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- 대기열은 연결마다 하나이고 넣은 순서대로만 꺼내므로, 문장 번호가 말한 순서와 같다.
- 늦은 정도는 대기열에 넣은 때부터 보낼 때까지 — 차례를 기다린 시간과 받아쓴 시간이다. 문장을 끊는 침묵 0.5초는 여기에 늘 더해진다.
- 같은 연결에서 **앞서 받아쓴 글의 끝 200자**를 다음 문장의 문맥으로 넘긴다. 이름과 용어가 문장을 넘어 이어진다.
- 문장 하나를 받아쓰지 못하면 그 문장만 오류로 알리고 연결은 이어 간다.

---

## 연결을 끝낼 때

<figure class="diagram"><img src="/content-assets/stt/realtime-stt/diagram-4.light.svg" alt="연결을 끝낼 때 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/realtime-stt/diagram-4.dark.svg" alt="연결을 끝낼 때 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- 마지막 문장까지 받으려면 '끝'을 보내고 '다 됨'을 기다린다. 그냥 끊으면 아직 받아쓰지 못한 말은 버린다 — 결과를 돌려줄 곳이 없기 때문이다.
- '끝' 없이 끊긴 연결도 동시 연결 자리를 돌려준다.
- 요청 기록에는 받은 소리 길이 · 문장 수 · 가장 컸던 늦은 정도만 남기고, **받아쓴 글과 소리는 남기지 않는다**. 소리는 메모리에만 둔다.

---

## 확인

**테스트** — VAD 와 받아쓰기 모델을 가짜로 바꿔 동작만 본다.

<div class="table-wrap">

| 무엇을          | 어떻게 확인했나                                                         |
| ------------ | ---------------------------------------------------------------- |
| 밀려도 빠짐없이     | 첫 문장을 받아쓰는 동안 다섯 문장이 들어와도 다섯 개가 순서대로 오고, 다섯째 문장이 첫 문장보다 늦었다고 알린다 |
| 아무 데서나 자른 소리 | 샘플과 프레임을 가르는 333바이트씩 보내도 한 번에 보낸 것과 같은 문장                        |
| 쉬지 않는 말      | 상한을 2초로 두고 5초를 이어 말하면 2초짜리 문장 둘 — 자른 곳에서 빠지는 소리가 없다              |
| 끝과 마지막 음절    | '끝'을 보내면 말하던 문장까지 받아쓴 뒤 '다 됨' · 프레임에 7샘플 모자란 끝도 남는다              |
| 동시 연결 상한     | 상한 1 에서 둘째 연결은 '바쁨' — 첫 연결이 '끝' 없이 끊긴 뒤 다시 하면 또 들어간다             |
| 요청 기록        | 기록에 받아쓴 글도 입력 글도 없다                                              |

</div>

<strong>로컬 확인 (2026-11-11)</strong> — 로컬 PC 의 CPU 에서 작은 모델(base)과 한국어 합성 음성 17.4초(문장 넷, '네' 한 마디 포함)로, 100ms 조각을 실시간 속도로 보냈다.

<div class="table-wrap row-header">

|                | 결과                                             |
| -------------- | ---------------------------------------------- |
| 16kHz 로        | 문장 넷이 순서대로 — 짧은 '네'도 따로. 늦은 정도 480\~580ms      |
| 같은 소리를 48kHz 로 | 같은 문장 넷                                        |
| 연결 둘을 동시에      | 둘 다 문장 넷. 뒤 차례 연결의 늦은 정도는 약 1000ms — 앞 연결의 두 배 |

</div>
