---
title: "녹음 파일 받아쓰기"
slug: "batch-transcription"
project: "stt"
order: 4
domain: "배치"
keywords: ["SSE","문장별 시각","PyAV 판 고정","임시 파일"]
evidence: ["tested"]
draft: false
cover: null
notionEditedAt: "2026-11-11"
description: null
glance: {"headline":"녹음 파일을 문장별 시각과 함께 받아쓰고, 확인하다 찾은 PyAV 판 호환 문제를 판 고정과 테스트로 막았다","problem":["상담 녹음 파일은 문장마다 시각이 있어야 하고, 말소리가 없는 녹음도 정상 결과로 다뤄야 한다.","로컬 확인에서 파일 받아쓰기가 모두 '소리를 읽지 못함'으로 실패했다 — 실시간 받아쓰기는 멀쩡했다."],"solution":["문장마다 시작 · 끝 시각을 붙여 한 번에 또는 나오는 대로 보내고, 부르는 쪽이 떠나면 다음 문장에서 멈춘다.","faster-whisper 가 파일을 열 때 넘기는 인자를 PyAV 19 가 없앤 것이 원인이라, 19 미만으로 고정하고 설치된 PyAV 로 작은 파일을 실제로 여는 테스트를 더했다."],"result":["로컬에서 17.4초 음성 파일이 2.7초에 문장 셋과 시각으로 돌아왔고, 나오는 대로 받기는 문장 셋 → 끝 → 종료 순서로 왔다.","PyAV 19 가 깔린 환경에서는 그 테스트가 같은 오류로 실패한다.","앱의 녹음 파일 올리기는 바로 돌려주고 뒤에서 받아쓰며, 서비스에는 파일 이름 대신 확장자만 보낸다(앱 테스트 5개 통과)."]}
leadFigure: {"light":"/content-assets/stt/batch-transcription/diagram-1.light.svg","dark":"/content-assets/stt/batch-transcription/diagram-1.dark.svg","alt":"문장마다 시각을 붙여, 한 번에 또는 나오는 대로 다이어그램"}
---

## 문장마다 시각을 붙여, 한 번에 또는 나오는 대로

음성 · 영상 파일을 받아 **문장마다 시작 · 끝 시각**이 붙은 글로 돌려준다. 한 번에 받거나, 문장이 나오는 대로(SSE) 받는다. 요약은 하지 않는다 — 필요하면 기존 요약 기능을 따로 부른다.

<figure class="diagram"><img src="/content-assets/stt/batch-transcription/diagram-1.light.svg" alt="문장마다 시각을 붙여, 한 번에 또는 나오는 대로 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/batch-transcription/diagram-1.dark.svg" alt="문장마다 시각을 붙여, 한 번에 또는 나오는 대로 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- **말소리가 없는 파일은 오류가 아니라 빈 결과**다. 상담 녹음에서는 빈 녹음도 정상 결과로 다뤄야 하기 때문이다 — 기존 음성 파일 요약은 이 경우 오류를 낸다.
- 크기 상한을 넘는 파일은 거절한다.
- 요청 기록에는 파일 이름 · 소리 길이 · 문장 수만 남기고, **받아쓴 글과 파일은 남기지 않는다**.

---

## 나오는 대로 받다가 떠나면 멈춘다

<figure class="diagram"><img src="/content-assets/stt/batch-transcription/diagram-2.light.svg" alt="나오는 대로 받다가 떠나면 멈춘다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/batch-transcription/diagram-2.dark.svg" alt="나오는 대로 받다가 떠나면 멈춘다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- 다 받아쓰면 '끝'(문장 수 · 언어 · 길이) 뒤에 종료 표시가 온다. 읽을 수 없는 파일이면 오류 한 줄 뒤에 끝난다.
- 부르는 쪽이 연결을 쥐고 있는 동안만 처리하므로 **작업 저장소가 필요 없다**. 떠나면 다음 문장에서 멈춘다.

---

## 긴 파일과 실시간이 한 모델을 나눠 쓴다

받아쓰기 모델은 서버 전체에서 한 번에 하나만 돈다. 잠금을 파일 전체에 잡으면 긴 파일이 끝날 때까지 실시간 문장이 기다린다. 그래서 잠금은 받아쓰기의 **한 걸음(약 30초 분량)마다** 잡았다 놓는다 — 걸음 사이에 실시간 문장이 잠금을 얻을 자리를 둔다.

<figure class="diagram"><img src="/content-assets/stt/batch-transcription/diagram-3.light.svg" alt="긴 파일과 실시간이 한 모델을 나눠 쓴다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/batch-transcription/diagram-3.dark.svg" alt="긴 파일과 실시간이 한 모델을 나눠 쓴다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

---

## 확인하다 찾은 PyAV 판 문제

로컬 확인에서 파일 받아쓰기가 모두 '소리를 읽지 못함'으로 실패했다. 실시간 받아쓰기는 멀쩡했다.

<figure class="diagram"><img src="/content-assets/stt/batch-transcription/diagram-4.light.svg" alt="확인하다 찾은 PyAV 판 문제 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/batch-transcription/diagram-4.dark.svg" alt="확인하다 찾은 PyAV 판 문제 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- **원인** — faster-whisper(1.2.1)가 파일을 열 때 넘기는 인자 하나를 PyAV 19 가 없앴다. 서버 이미지는 PyAV 판을 고정하지 않고 설치하므로, 다음 이미지 빌드에서 그대로 들어갈 수 있었다. 기존 음성 파일 요약도 같은 길로 파일을 연다.
- **고친 것** — PyAV 를 19 미만으로 고정했다. 그리고 **설치된 PyAV 로 작은 파일(1초 · 스테레오 · 44.1kHz)을 실제로 열어 16kHz 모노 1초가 되는지** 보는 테스트를 더했다. 받아쓰기 모델 없이 돈다.
- PyAV 19 가 깔린 환경에서는 이 테스트가 같은 오류로 실패한다(2026-11-15 확인).

---

## 앱에서 — 올리면 바로 돌려주고 뒤에서

화상 상담 앱의 녹음 파일 올리기도 이 기능을 쓴다.

- 올리면 바로 기록 번호를 돌려주고, 받아쓰기와 요약은 뒤에서 한다. 서비스가 한 번에 하나씩 받아쓰므로 앱도 차례대로 보낸다.
- 기록은 실시간 상담 녹음과 같은 자리에 남긴다 — 파일 하나가 방 하나 + 작업 하나라, 상담 기록 목록 · 상세 조회를 바꾸지 않았다.
- 파일 이름에는 사람 이름이 들어 있을 수 있어 서비스에는 **확장자만** 보낸다.
- 앱이 결과를 기다리고 있지 않아도 기록은 남는다 — 앱은 목록에서 본다.

---

## 확인

<strong>로컬 확인 (2026-11-11)</strong> — 로컬 PC 의 CPU 에서 작은 모델(base)과 한국어 합성 음성 17.4초로.

<div class="table-wrap row-header">

|           | 결과                  |
| --------- | ------------------- |
| 한 번에 받기   | 2.7초에 문장 셋과 시각      |
| 나오는 대로 받기 | 문장 셋 → 끝 → 종료 표시 순서 |

</div>

<div class="table-wrap">

| 테스트          | 무엇을                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| 서비스          | 문장별 시각 · 말소리 없는 파일은 빈 결과 · 나오는 대로 받기의 순서 · 읽을 수 없는 파일은 오류 한 줄 · 크기 상한과 인증 · 설치된 PyAV 로 파일 열기 · 요청 기록에 글이 없음     |
| 앱 (5개 모두 통과) | 올린 파일이 방 하나 · 끝난 작업 하나 · 문장이 됨 · 읽지 못한 파일은 실패한 작업 · 앱이 듣고 있지 않아도 기록 · 기록을 못 만들면 아무것도 보내지 않고 파일을 지움 · 짧은 확장자만 남김 |

</div>
