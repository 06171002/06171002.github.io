---
title: "동시 업로드 교착"
slug: "upload-deadlock"
project: "files"
order: 1
domain: "업로드"
keywords: ["외래 키 공유 잠금","잠금 순서","동시성 회귀 테스트","시범 연동"]
evidence: ["tested","measured"]
draft: false
cover: null
notionEditedAt: "2026-11-10"
description: null
glance: {"headline":"시범 연동에서 나온 동시 업로드 교착을 숨은 외래 키 잠금까지 따라가, 잠그는 순서를 바꿔 없앴다","problem":["기존 사내 서비스에 시범으로 붙여 같은 프로젝트에 파일 5개를 동시에 올리자, 처리 작업 하나가 교착으로 실패했다.","재시도로 받았지만 그 파일만 확인에 12.3초가 걸렸다(나머지 4개는 1.3~3.3초)."],"solution":["교착 기록을 읽어, 업로드 상태를 바꿀 때 외래 키 확인이 프로젝트 행에 공유 잠금을 숨겨 건다는 것을 찾았다.","자기 행 → 프로젝트 사용량 → 상태 순서로 잠그게 바꿔, 외래 키 확인이 이미 쥔 배타 잠금 안에서 끝나게 했다."],"result":["같은 프로젝트의 등록 · 영구 삭제를 8개씩 동시에 6번 돌리는 테스트가 고치기 전엔 모두 교착으로 실패하고, 고친 뒤엔 모두 통과한다.","시범 환경에서 5개 한 번 · 10개씩 세 번 다시 올려 교착 · 재시도 0번, 확인은 최대 6.0초였다."]}
leadFigure: {"light":"/content-assets/files/upload-deadlock/diagram-2.light.svg","dark":"/content-assets/files/upload-deadlock/diagram-2.dark.svg","alt":"숨은 공유 잠금 다이어그램"}
---

## 무엇이 일어났나

기존 사내 서비스의 업로드를 이 서버의 직접 업로드로 바꿔 보는 **시범 연동**에서, 같은 프로젝트에 1MB 파일 5개를 동시에 올렸다. 4개는 1.3\~3.3초에 확인됐는데, 1개는 처리 작업이 **교착(deadlock)으로 실패**했다. 작업 대기열이 10초 뒤 다시 실행해 결국 받았지만, 그 파일은 확인까지 **12.3초**가 걸렸다.

<figure class="diagram"><img src="/content-assets/files/upload-deadlock/diagram-1.light.svg" alt="무엇이 일어났나 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/files/upload-deadlock/diagram-1.dark.svg" alt="무엇이 일어났나 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

재시도가 있어 파일을 잃지는 않았다. 하지만 같은 프로젝트의 처리가 겹칠 때마다 날 수 있는 교착이라, 서버를 여러 대로 늘리면 더 자주 겹친다. 그래서 원인부터 찾았다.

---

## 숨은 공유 잠금

DB 가 남긴 **교착 기록**을 읽어 보니, 두 처리 작업이 각자 <strong>프로젝트 행에 공유 잠금(S)</strong> 을 쥔 채 같은 행의 <strong>배타 잠금(X)</strong> 을 기다리고 있었다. 코드에는 프로젝트 행을 읽는 문장이 없었다. S 잠금은 **외래 키 확인**이 걸었다.

- 처리 작업은 먼저 업로드 기록의 **상태**를 바꾼다.
- 그 상태 칸은 외래 키(프로젝트)가 쓰는 <strong>(프로젝트, 상태) 색인</strong>에 들어 있다. 색인 항목이 바뀌면 DB(InnoDB)는 외래 키를 다시 확인하며 부모인 프로젝트 행에 **S 잠금**을 건다.
- 이어서 프로젝트의 **저장 사용량**을 늘리려고 같은 행을 **X 로 올리려다**, 같은 일을 하는 다른 작업의 S 에 막힌다.

<figure class="diagram"><img src="/content-assets/files/upload-deadlock/diagram-2.light.svg" alt="숨은 공유 잠금 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/files/upload-deadlock/diagram-2.dark.svg" alt="숨은 공유 잠금 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

**영구 삭제**도 같은 모양이었다. 파일 상태(역시 프로젝트가 앞에 오는 색인)를 바꾼 뒤 사용량을 줄인다. 시범에서는 나지 않았지만, 정리 작업의 영구 삭제와 처리 작업이 겹치면 같은 교착이 날 수 있어 함께 고쳤다.

---

## 잠그는 순서를 바꿨다

두 트랜잭션 모두 **자기 행을 먼저** 잠가 상태만 확인하고(SELECT … FOR UPDATE), 그다음 **사용량을 바꿔 프로젝트 행을 X 로** 잡은 뒤, **마지막에 상태를 바꾼다**. 상태를 바꿀 때의 외래 키 확인은 이미 쥔 X 안에서 끝나므로 새 S 가 생기지 않는다.

<figure class="diagram"><img src="/content-assets/files/upload-deadlock/diagram-3.light.svg" alt="잠그는 순서를 바꿨다 다이어그램" class="diagram-light" loading="lazy" decoding="async"><img src="/content-assets/files/upload-deadlock/diagram-3.dark.svg" alt="잠그는 순서를 바꿨다 다이어그램" class="diagram-dark" loading="lazy" decoding="async"></figure>

공개 API 와 DB 스키마는 바꾸지 않았다.

<div class="table-wrap">

| 고르지 않은 안           | 이유                                                                           |
| ------------------ | ---------------------------------------------------------------------------- |
| 프로젝트 행을 맨 먼저 잠그기   | 취소 · 복원 같은 한 줄 변경은 자기 행을 먼저 잡고 프로젝트 행에 S 를 건다. 순서가 반대가 되어 그 변경들과 새로 교착할 수 있다 |
| 외래 키만을 위한 색인 따로 두기 | 스키마 변경(마이그레이션)이 필요하다                                                         |

</div>

---

## 확인

**회귀 테스트** — 일회성 MySQL 에서 같은 프로젝트의 **등록 8개 · 영구 삭제 8개 · 둘을 섞은 8개**를 동시에 시작해 각각 6번 돌린다. 고치기 전에는 세 테스트 모두 교착으로 실패했고, 고친 뒤에는 모두 통과한다.\
**시범 재확인** — 고친 서버로 시범 환경을 다시 띄워, 같은 프로젝트에 5개를 한 번, 10개씩 세 번 동시에 올렸다.

<div class="table-wrap row-header">

|            | 고치기 전                        | 고친 뒤                                                |
| ---------- | ---------------------------- | --------------------------------------------------- |
| 동시 업로드     | 5개 한 번                       | 5개 한 번 · 10개씩 세 번                                   |
| 교착 · 재시도   | 1번 (10초 뒤 재시도로 받음)           | <span class="tc-green">0번</span>                    |
| 확인까지 걸린 시간 | 4개 1.3\~3.3초 · 교착 난 1개 12.3초 | 5개 2.9\~4.8초 · 10개 최대 6.0초 — 처리 작업자 2개가 차례로 처리하는 시간 |

</div>

<strong>이 카드의 코드 · 테스트 · 분석 문서는 AI 코딩 에이전트와 함께 썼다(커밋마다 공동 작성 표기).</strong>
