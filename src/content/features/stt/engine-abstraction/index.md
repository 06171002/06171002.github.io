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
leadFigure: {"light":"/content-assets/stt/engine-abstraction/diagram-1.light.svg","dark":"/content-assets/stt/engine-abstraction/diagram-1.dark.svg","alt":"구조 다이어그램"}
---

## 개요

STT·LLM **외부 엔진을 Factory와 추상 베이스 클래스 뒤로 숨겨**, 비즈니스 로직 수정 없이 .env 설정만으로 교체 가능하게 한 설계. STT 3종(Faster-Whisper / WhisperLive / Google STT), LLM 3종(Ollama / LM Studio / Gemini)을 동일 인터페이스로 갈아끼운다.

<div class="table-wrap">

| **STT 3종** | **LLM 3종** | **Factory + ABC** | **설정 교체**      | **로컬/클라우드** |
| ---------- | ---------- | ----------------- | -------------- | ----------- |
| 공통 4메서드    | 공통 추상 3메서드 | 인터페이스 통일          | 엔진 · 제공자 설정 2개 | 비용·보안 선택    |

</div>

---

## 왜 이 설계가 필요했는가 (Problem)

<aside class="callout tone-scenario" data-icon="🔒">

**시나리오 1 — 벤더 종속**\
단일 STT/LLM 엔진에 묶이면 가격 인상·API 변경·서비스 중단이 그대로 리스크가 된다.

</aside>

<aside class="callout tone-scenario" data-icon="⚖️">

**시나리오 2 — 비용 vs 품질 vs 보안 상충**\
민감한 상담 음성은 외부 전송이 부담스러워 로컬 처리가 필요하지만, 최고 품질은 클라우드다. 상황별로 다른 선택이 필요하다.

</aside>

<aside class="callout tone-scenario" data-icon="🧬">

**시나리오 3 — 교체가 코드 수정으로 번짐**\
호출부 곳곳이 특정 엔진의 API에 직접 의존하면, 엔진 하나 바꾸는 데 전 계층을 손대야 한다.

</aside>

---

## 구조

<figure class="diagram"><img src="/content-assets/stt/engine-abstraction/diagram-1.light.svg" alt="구조 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/stt/engine-abstraction/diagram-1.dark.svg" alt="구조 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

---

## 핵심 설계 결정

### 1. STT Factory — 설정값으로 엔진 주입

<aside class="callout tone-orange" data-icon="🏭">

STT 서비스가 엔진 설정(또는 작업별 모드 값)을 읽어 구현 모듈을 선택·위임한다.\
→ 호출부는 파일 전사 / 스트리밍 전사 / 세그먼트 전사 등 **공통 4메서드만** 알면 된다.

</aside>

```text
# STT Factory — 설정값에 따라 엔진 모듈 주입
기본 엔진 불러오기():
    if 엔진 설정 == "faster-whisper": 엔진 = Faster-Whisper 구현
    elif 엔진 설정 == "whisperlivekit": 엔진 = WhisperLive 구현
    else: 오류("지원하지 않는 STT 엔진")
세그먼트 전사(오디오 바이트, 초기 프롬프트):
    return 엔진.세그먼트 전사(오디오 바이트, 초기 프롬프트)  # 호출부는 엔진 종류를 모른다
```

### 2. LLM 추상 베이스 클래스 (ABC)

<aside class="callout tone-blue" data-icon="🧩">

LLM 추상 베이스 클래스가 연결 확인 / 요약 / 도메인 요약 3개 **추상 메서드를 강제**한다.\
→ Ollama·LM Studio·Gemini 구현체가 이를 각자 구현하고, 입출력(텍스트 → 요약 dict)은 동일하다.

</aside>

```text
# LLM 추상 베이스 — 모든 구현체가 상속하는 계약
class LLM 서비스(ABC):
    @abstractmethod 연결 확인() -> bool
    @abstractmethod 요약(대화록) -> dict
    @abstractmethod 도메인 요약(대화록) -> dict
```

### 3. 설정 기반 교체 + 성능 튜닝

<aside class="callout tone-green" data-icon="🎛️">

설정 파일에서 엔진·모델 크기·연산 정밀도(int8/float16)·디바이스(cpu/cuda)·beam size(실시간 경로만)를 제어한다.\
배치 파이프라인은 작업 메타데이터의 모드 값으로 **작업별 동적 선택**(예: 클라우드 모드 → Google STT + Gemini)도 지원한다.

</aside>

```text
# 설정값 — 엔진 · 모델 · 디바이스 · 정밀도
STT 엔진 = "faster-whisper"  # | "whisperlivekit"
모델 크기 = "base"  # tiny ~ large-v3
디바이스 = "cuda"  # auto | cpu | cuda | mps
연산 정밀도 = "float16"  # int8 | float16 | float32
LLM 제공자 = "ollama"  # | "lmstudio" | "gemini"
```

---

## 엔진 비교

<div class="table-wrap">

| **STT 엔진**          | **배포**     | **특징**                               |
| ------------------- | ---------- | ------------------------------------ |
| Faster-Whisper (기본) | 로컬 GPU/CPU | RMS 무음 필터 + 환각 필터 내장, 초기 프롬프트로 문맥 유지 |
| WhisperLive         | 로컬         | 연결마다 독립 인스턴스, diarization 옵션         |
| Google STT          | 클라우드       | 파일 크기·길이로 동기/비동기 API 자동 선택           |

</div>

<div class="table-wrap">

| **LLM 엔진**  | **배포** | **특징**                           |
| ----------- | ------ | -------------------------------- |
| Ollama (기본) | 로컬     | JSON 출력 형식 강제 + 3회 재시도(온도 단계 상향) |
| LM Studio   | 로컬     | OpenAI 호환, 마크다운 제거 후 정규식 JSON 추출 |
| Gemini      | 클라우드   | 공식 SDK, 타입 안전 설정                 |

</div>

<aside class="callout tone-gray" data-icon="💡">

**트레이드오프 선택**

- <strong>로컬(Ollama·Faster-Whisper)</strong> — 비용 0·데이터 외부 미전송(민감 데이터 보안)
- <strong>클라우드(Gemini·Google STT)</strong> — 고품질·높은 비용

</aside>

---

## 구현 범위

### 만든 것

<div class="table-wrap">

| **항목**                                                      | **상태** |
| ----------------------------------------------------------- | ------ |
| STT 3종 공통 인터페이스 (Faster-Whisper / WhisperLive / Google STT) | 동작     |
| LLM 3종 추상 베이스 (Ollama / LM Studio / Gemini)                 | 동작     |
| .env 설정 두 개(STT 엔진 · LLM 제공자)만으로 엔진 교체                      | 동작     |
| 작업 메타데이터의 모드 값으로 건별 동적 선택                                   | 동작     |

</div>

### 설정 매트릭스 실측 (2026-08-30 · 배포 환경)

<aside class="callout tone-blue" data-icon="📡">

실제 배포 환경(**GPU 없는 CPU 인스턴스**)에서 30초 한국어 음성을 설정 8종으로 돌렸다.\
유사도는 **medium · int8_float32 · beam5 를 기준점**으로 둔 상대값이다(가장 큰 모델 = 최고 품질 가정).

</aside>

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

<aside class="callout tone-green" data-icon="✅">

<strong>코드 기본 설정이 medium 대비 89% 일치하면서 3.5배 빠르다.</strong>\
다만 이 표는 30초 파일 하나를 무음 제거 없이 통째로 넣은 결과다 — 짧은 구간을 VAD 로 잘라 넣는 실시간 경로에는 그대로 옮길 수 없다(아래 발견 참조).

</aside>

<div class="table-wrap">

| **발견**                                                      | **의미**                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **beam 5 가 오히려 정확도를 낮춘다** (0.892 → 0.877)                   | 🔴 <strong>이 해석은 철회한다.</strong> 측정값은 맞지만 결론을 지탱하지 못한다 — 같은 표본 음성의 이전 벤치마크(2026-08-17)에서 **greedy(1)가 "가정"을 "과정"으로 잘못 알아들은 관찰**이 있어 배포에서는 실시간도 beam 5 로 올렸다(배치는 원래 5). 내 지표는 **특정 단어 오인식을 잡지 못한다**(표본 1개 · 실제 도메인이 아닌 오디오 · medium 을 정답으로 가정한 상대 유사도). 그 관찰을 뒤집을 강도가 아니다. |
| **int8 ↔ int8_float32 차이 없음** (유사도 동일 · RTF 0.188 vs 0.186) | 정밀도를 올릴 이유가 없다. 다만 **새 발견이 아니라 재확인**이다 — 배포 설정에도 '출력이 문자 단위로 같고 속도도 같다'는 같은 결론이 이미 적혀 있었다. CPU 경로에서는 int8 로 고정해도 무방하다                                                                                                                                                    |
| 🔴 **turbo 는 이 조건에서 8자만 출력했다**                              | 이 벤치마크는 앞뒤 무음이 붙은 30초 파일을 VAD 없이 넣는데, 그 조건에서 turbo 가 구간을 뭉개 몇 글자만 낸다(6·7·8 이 똑같이 실패한 이유). 실시간 경로는 앞단 VAD 로 무음을 잘라 넣으므로 그대로 적용되지 않는다 — 이전 점검(2026-08-17)에서 이 원인을 좁힌 뒤 배포 모델로 turbo 를 골랐다                                                                                  |
| **medium 도 파일 기준으로는 실시간 안쪽** (RTF 0.532 < 1.0)              | 다만 실시간 경로는 짧은 구간마다 30초 단위로 채워 계산하므로, 파일 하나의 RTF 로는 구간당 처리 시간을 알 수 없다(「실시간 스트리밍 STT」 카드의 지연 분해 참조). 모델 선택의 근거로 쓰려면 구간 단위로 다시 재야 한다                                                                                                                                        |

</div>
