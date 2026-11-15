---
title: "마이크 하나로 화자 구분"
slug: "speaker-labels"
project: "stt"
order: 2
domain: "스트리밍"
keywords: ["화자 구분","목소리 벡터","CAM++","ONNX Runtime"]
evidence: ["measured","tested"]
draft: false
cover: null
notionEditedAt: "2026-11-11"
description: null
glance: {"headline":"마이크 하나로 녹음한 두 사람의 대화에 문장마다 화자 번호를 붙여, 한국어 낭독 음성 대화에서 문장의 93.2%를 맞혔다","problem":["상담 녹음은 휴대폰 한 대가 마주 앉은 두 사람의 목소리를 한 줄기로 보내, 그대로 받아쓰면 대화 전체가 한 사람의 말이 된다.","번호는 문장과 함께 바로 보내야 해서, 대화를 다 들은 뒤 다시 묶는 방식은 쓸 수 없다."],"solution":["문장마다 목소리 벡터를 만들어 지금까지 들은 화자들의 평균과 견주고, 닮지 않은 1초 이상의 말만 새 화자로 연다.","앱은 두 번째 화자가 나오면 같은 방에 작업을 하나 더 만들어, 기록 조회와 요약이 그대로 두 사람의 대화로 읽게 했다."],"result":["한국어 낭독 음성으로 만든 두 사람 대화 112개에서 문장의 93.2%에 맞는 화자 번호를 붙였다(인원 최대 2명).","인원을 4명까지 열어 두면 두 사람을 평균 3.05명으로 갈라, 상담 녹음은 인원을 2명으로 고정했다.","화자 모델은 CPU 에서 문장당 14~53ms 로 돌아 GPU 메모리를 쓰지 않는다."]}
leadFigure: {"light":"/content-assets/stt/speaker-labels/diagram-1.light.svg","dark":"/content-assets/stt/speaker-labels/diagram-1.dark.svg","alt":"한 줄기 소리에 두 사람 다이어그램"}
---

## 한 줄기 소리에 두 사람

화상 상담은 참가자마다 연결이 따로라 누가 말했는지 이미 안다. **상담 녹음**은 다르다 — 휴대폰 한 대가 마주 앉은 두 사람의 목소리를 한 줄기로 보낸다. 그대로 받아쓰면 대화 전체가 한 사람의 말로 기록된다. 그래서 실시간 받아쓰기에 '화자 몇 명'을 함께 주면, 문장마다 **화자 번호**(목소리가 처음 나온 순서대로 1, 2, …)를 붙이게 했다.

<figure class="diagram"><img src="/content-assets/stt/speaker-labels/diagram-1.light.svg" alt="한 줄기 소리에 두 사람 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/speaker-labels/diagram-1.dark.svg" alt="한 줄기 소리에 두 사람 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- 받아쓰기가 이미 말이 멈춘 곳에서 문장을 자른다. 화자 구분은 그 **문장 단위**로 한다.
- 화자마다 지금까지 들은 문장의 **평균 벡터**(문장 길이로 가중)를 두고 견준다. 1초 이상인 문장만 평균을 움직인다.
- 붙인 번호는 **나중에 고치지 않는다** — 문장과 함께 바로 보내야 하기 때문이다.
- 화자 모델 때문에 받아쓰기를 막지 않는다. 모델을 쓸 수 없으면 한 번 알리고 번호 없이 이어 간다 — 받아쓴 말이 화자 번호보다 중요하다.

---

## 짧은 말은 화자를 정하지 못하게

0.5초짜리 '네'의 목소리 벡터는 흔들림이 크다. 짧은 말도 새 화자를 열 수 있으면 같은 사람이 둘로 갈라지고, 인원이 2명으로 묶여 있으면 **두 자리를 한 사람이 차지**해 그 뒤 대화가 절반쯤 틀린다.

<figure class="diagram"><img src="/content-assets/stt/speaker-labels/diagram-2.light.svg" alt="짧은 말은 화자를 정하지 못하게 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/speaker-labels/diagram-2.dark.svg" alt="짧은 말은 화자를 정하지 못하게 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

문턱값(0.45\~0.6), 화자를 정할 최소 길이(1초 · 2초), 평균을 움직이는 조건, 매번 전체를 다시 묶는 방법을 견줬고, 지금 값이 가장 나았다.

<div class="table-wrap">

| 고르지 않은 안             | 이유                                                                             |
| -------------------- | ------------------------------------------------------------------------------ |
| 대화를 다 들은 뒤 전체를 다시 묶기 | 붙인 번호가 나중에 바뀐다 — 자막은 문장과 함께 바로 나가야 한다. 견준 방법 중에서도 지금 방식이 더 나았다                 |
| 영어로 학습된 다른 공개 화자 모델  | 같은 조건에서 한국어의 다른 사람 사이 유사도 중앙값이 0.43\~0.63 — 고른 모델은 0.24\~0.31 로 사람을 더 잘 떼어 놓았다 |

</div>

---

## 모델 — CPU 에서, 새 의존성 없이

- 3D-Speaker 의 CAM++(Apache-2.0)를 sherpa-onnx 프로젝트가 ONNX 로 내보낸 파일(28MB)을 쓴다. 한국어 화자 구분 공개 모델은 찾지 못해 중국어로 학습된 모델이다.
- CPU 에서 ONNX Runtime 으로 돌린다. ONNX Runtime 과 NumPy 는 faster-whisper 가 이미 가져오므로 **새 의존성이 없고**, GPU 메모리도 쓰지 않는다.
- 입력 특징(kaldi 방식 log-mel 80차원)은 NumPy 로 직접 계산한다. kaldi-native-fbank 와 소수 넷째 자리까지 같고, 2초 · 6초 문장에서 sherpa-onnx 가 낸 벡터와 코사인 1.00000 이다.
- 모델은 처음 쓸 때 내려받고 SHA-256 을 확인한다. 값이 다르거나 받다 끊기면 쓰지 않는다.

---

## 측정 — 한국어 낭독 음성으로 만든 두 사람 대화 112개

Zeroth-Korean 테스트 묶음(CC BY 4.0)에서 화자 8명 × 클립 6개로 두 사람 대화 112개(28쌍 × 4번)를 만들었다. 대화마다 문장 24개 — 한 사람당 0.5초 3개 · 1초 4개 · 2초 3개 · 4초 2개를 섞었다. 번호는 도착 순서대로 붙이고 고치지 않았다. 정확도는 붙인 번호를 실제 두 사람에 가장 잘 맞게 대응시켰을 때 맞은 문장의 비율이다.

<div class="table-wrap row-header">

|                                      | 인원 최대 2명                            | 최대 4명 |
| ------------------------------------ | ----------------------------------- | ----- |
| 평균 정확도                               | <span class="tc-green">93.2%</span> | 90.3% |
| 찾은 화자 수 (실제 2명)                      | 2.00                                | 3.05  |
| 문장당 계산 시간 (CPU, 0.5 · 1 · 2 · 4초 문장) | 14 · 20 · 28 · 53ms                 | 같음    |

</div>

<figure class="diagram"><img src="/content-assets/stt/speaker-labels/diagram-3.light.svg" alt="측정 — 한국어 낭독 음성으로 만든 두 사람 대화 112개 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/speaker-labels/diagram-3.dark.svg" alt="측정 — 한국어 낭독 음성으로 만든 두 사람 대화 112개 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

인원을 넉넉히 주면 두 사람뿐인데도 세 명으로 갈라지는 일이 많고(평균 3.05명), 짧은 문장이 더 많이 틀린다. 인원을 알면 그 수를 주는 편이 낫다 — 상담 녹음은 **2명으로 고정**했다.

---

## 앱에서 — 화자마다 작업 하나

화상 상담 앱은 상담 녹음을 받아쓸 때 화자 2명 구분을 요청한다. 두 번째 화자가 처음 나오면 **같은 방에 작업을 하나 더** 만들어 그 사람의 문장을 담는다. 화상 상담의 '참가자 한 명 = 작업 하나'와 같은 모양이라, 상담 기록 조회와 방 요약이 그대로 두 사람의 대화로 읽는다. 기록 구조는 바꾸지 않았다.

<figure class="diagram"><img src="/content-assets/stt/speaker-labels/diagram-4.light.svg" alt="앱에서 — 화자마다 작업 하나 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/speaker-labels/diagram-4.dark.svg" alt="앱에서 — 화자마다 작업 하나 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- 두 번째 화자의 작업에는 녹음한 사람의 이름을 붙이지 않는다 — 누구인지 모른다. 앱으로 보내는 자막에도 이름 대신 번호를 싣는다.
- 작업을 만들지 못하면 그 문장은 원래 작업에 담는다 — 말을 잃는 것보다 화자를 잃는 편이 낫다.

---

## 확인

<div class="table-wrap">

| 무엇을                | 어떻게 확인했나                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------- |
| 정확도 · 인원 · 계산 시간   | 위 측정 (2026-11-11)                                                                        |
| 번호 붙이는 규칙          | 서비스 테스트 — 처음 말한 순서대로 번호, 1초 미만은 화자를 열지도 평균을 움직이지도 못함, 요청한 인원을 넘지 않음, 너무 짧아 벡터가 없으면 직전 화자 |
| 모델 문제로 받아쓰기를 막지 않음 | 서비스 테스트 — 체크섬이 다르면 모델을 쓰지 않음, 모델이 없으면 번호 없이 이어 감, 목소리를 못 읽은 문장도 말은 그대로                   |
| 앱의 화자별 작업          | 앱 테스트 — 녹음의 화자마다 작업, 작업을 못 만들어도 문장은 남음, 번호가 없으면 예전처럼 작업 하나                               |

</div>
