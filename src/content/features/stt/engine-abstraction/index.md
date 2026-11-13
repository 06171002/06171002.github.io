---
title: "멀티 엔진 추상화 (STT·LLM)"
slug: "engine-abstraction"
project: "stt"
order: 2
domain: "엔진"
keywords: ["Factory","추상 베이스","로컬/클라우드 전환"]
evidence: ["measured"]
draft: false
cover: null
notionEditedAt: "2026-08-31"
description: null
leadFigure: {"light":"/content-assets/stt/engine-abstraction/diagram-1.light.svg","dark":"/content-assets/stt/engine-abstraction/diagram-1.dark.svg","alt":"엔진은 설정으로 갈아 끼운다 다이어그램"}
---

## 엔진은 설정으로 갈아 끼운다

STT · LLM 외부 엔진을 Factory 와 추상 베이스 클래스 뒤로 숨겨, 비즈니스 로직을 고치지 않고 .env 설정만으로 바꾼다. 한 엔진에 묶이면 가격 인상 · API 변경 · 서비스 중단이 그대로 위험이 된다. 민감한 상담 음성은 밖으로 보내기 부담스러워 로컬 처리가 필요하지만 최고 품질은 클라우드다. 그리고 호출부가 특정 엔진 API 에 직접 기대면, 엔진 하나 바꾸는 데 모든 계층을 손대야 한다.

<figure class="diagram"><img src="/content-assets/stt/engine-abstraction/diagram-1.light.svg" alt="엔진은 설정으로 갈아 끼운다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/engine-abstraction/diagram-1.dark.svg" alt="엔진은 설정으로 갈아 끼운다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

- **STT Factory** — STT 서비스가 엔진 설정(또는 작업별 모드 값)을 읽어 구현 모듈을 골라 위임한다. 호출부는 파일 전사 · 스트리밍 전사 · 세그먼트 전사 등 공통 4메서드만 안다.
- **LLM 추상 베이스** — 연결 확인 · 요약 · 도메인 요약 세 메서드를 강제한다. 세 구현체의 입출력(대화록 → 요약 dict)이 같다.
- **설정으로 교체 · 튜닝** — 설정 파일에서 엔진 · 모델 크기 · 연산 정밀도(int8/float16) · 디바이스(cpu/cuda) · beam size(실시간 경로만)를 정한다. 배치 파이프라인은 작업 메타데이터의 모드 값으로 작업마다 고른다(예: 클라우드 모드 → Google STT + Gemini).

<div class="table-wrap">

| **엔진**              | **종류 · 배포**      | **특징**                               |
| ------------------- | ---------------- | ------------------------------------ |
| Faster-Whisper (기본) | STT · 로컬 GPU/CPU | RMS 무음 필터 + 환각 필터 내장, 초기 프롬프트로 문맥 유지 |
| WhisperLive         | STT · 로컬         | 연결마다 독립 인스턴스, diarization 옵션         |
| Google STT          | STT · 클라우드       | 파일 크기 · 길이로 동기/비동기 API 자동 선택         |
| Ollama (기본)         | LLM · 로컬         | JSON 출력 형식 강제 + 3회 재시도(온도 단계 상향)     |
| LM Studio           | LLM · 로컬         | OpenAI 호환, 마크다운 제거 후 정규식 JSON 추출     |
| Gemini              | LLM · 클라우드       | 공식 SDK, 타입 안전 설정                     |

</div>

로컬(Ollama · Faster-Whisper)은 비용이 0이고 데이터를 밖으로 보내지 않는다 — 민감한 데이터에 맞다. 클라우드(Gemini · Google STT)는 고품질이지만 비용이 높다. STT 3종 공통 인터페이스, LLM 3종 추상 베이스, .env 설정 두 개(STT 엔진 · LLM 제공자)만으로 엔진 교체, 작업 메타데이터의 모드 값으로 건별 선택이 동작한다.

---

## 설정 매트릭스 실측 (2026-08-30 · 배포 환경)

GPU 없는 CPU 배포 환경에서 30초 한국어 음성을 설정 8종으로 돌렸다. 유사도는 medium · int8_float32 · beam5 를 기준점으로 둔 상대값이다(가장 큰 모델 = 최고 품질로 가정). turbo 계열(6\~8)은 이 조건에서 실패해 그래프에서 뺐다(아래 표).

<figure class="diagram"><img src="/content-assets/stt/engine-abstraction/diagram-2.light.svg" alt="설정 매트릭스 실측 (2026-08-30 · 배포 환경) 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/engine-abstraction/diagram-2.dark.svg" alt="설정 매트릭스 실측 (2026-08-30 · 배포 환경) 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

<div class="table-wrap">

| **설정**                                              | **RTF**      | <strong>추론(s)</strong> | **유사도**      |
| --------------------------------------------------- | ------------ | ---------------------- | ------------ |
| <strong>1. small · int8 · beam1 (코드 기본 설정)</strong> | **0.150**    | 4.5                    | **0.892**    |
| 2. small · int8 · beam5                             | 0.188        | 5.6                    | 0.877        |
| 3. small · int8_float32 · beam5                     | 0.186        | 5.6                    | 0.877        |
| 4. medium · int8 · beam5                            | 0.532        | 15.9                   | 1.000        |
| 5. medium · int8_float32 · beam5 <em>(기준)</em>      | 0.535        | 16.1                   | 1.000        |
| 6\~8. turbo 계열                                      | 0.143\~0.145 | 4.3\~4.4               | 🔴 **0.126** |

</div>

<strong>코드 기본 설정이 medium 대비 89% 일치하면서 3.5배 빠르다.</strong> 다만 이 표는 30초 파일 하나를 무음 제거 없이 통째로 넣은 결과다 — 짧은 구간을 VAD 로 잘라 넣는 실시간 경로에는 그대로 옮길 수 없다.

<div class="table-wrap">

| **발견**                                                      | **의미**                                                                                                                                                                                                                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **beam 5 가 오히려 정확도를 낮춘다** (0.892 → 0.877)                   | 🔴 <strong>이 해석은 철회한다.</strong> 측정값은 맞지만 결론을 지탱하지 못한다 — 같은 표본 음성의 이전 벤치마크(2026-08-17)에서 greedy(1)가 "가정"을 "과정"으로 잘못 알아들은 관찰이 있어 배포에서는 실시간도 beam 5 로 올렸다(배치는 원래 5). 이 지표는 특정 단어 오인식을 잡지 못한다(표본 1개 · 실제 도메인이 아닌 오디오 · medium 을 정답으로 가정한 상대 유사도) |
| **int8 ↔ int8_float32 차이 없음** (유사도 같음 · RTF 0.188 vs 0.186) | 정밀도를 올릴 이유가 없다. 새 발견이 아니라 재확인이다 — 배포 설정에도 '출력이 문자 단위로 같고 속도도 같다'는 같은 결론이 적혀 있었다. CPU 경로에서는 int8 로 고정해도 된다                                                                                                                                    |
| 🔴 **turbo 는 이 조건에서 8자만 출력했다**                              | 앞뒤 무음이 붙은 30초 파일을 VAD 없이 넣는 조건에서 turbo 가 구간을 뭉개 몇 글자만 낸다(6 · 7 · 8 이 똑같이 실패한 이유). 실시간 경로는 앞단 VAD 로 무음을 잘라 넣으므로 그대로 적용되지 않는다 — 이전 점검(2026-08-17)에서 이 원인을 좁힌 뒤 배포 모델로 turbo 를 골랐다                                                              |
| **medium 도 파일 기준으로는 실시간 안쪽** (RTF 0.532 < 1.0)              | 실시간 경로는 짧은 구간마다 30초 단위로 채워 계산하므로, 파일 하나의 RTF 로는 구간당 처리 시간을 알 수 없다. 모델 선택의 근거로 쓰려면 구간 단위로 다시 재야 한다                                                                                                                                            |

</div>
