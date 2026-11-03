# 학교 식물 탐사대 — AI 생태 탐사 웹앱 (1차 뼈대)

사진으로 발견하는 우리 학교 식물도감. 카메라로 식물을 찍고, AI가 후보를 제안하면, 국립수목원 공공데이터로 확인하고, 관찰 기록을 도감 카드로 남기는 초등 과학 탐구 웹앱.

- AI(제미나이)는 **후보를 제안**하는 도구, 국립수목원 API는 **공식 정보를 확인**하는 도구
- 사용자(교사)마다 **자기 키를 넣어 쓰는 구조** — 서버는 키를 저장하지 않음
- 휴대폰(카메라)·노트북(파일 선택) 모두 동작, HTTPS 배포 시 카메라 사용 가능

## 1. 빠른 시작

```bash
npm install
cp .env.example .env.local      # 키 없이 써 보려면 MOCK=1 로
npm run dev                      # http://localhost:3000
```

- 모의 모드(`MOCK=1`): 국립수목원·제미나이를 호출하지 않고 `samples/` 자료로 전체 흐름 시연 (키 불필요)
- 실제 모드(`MOCK=0`): 화면 하단 **설정**에서 키 두 개 입력 → 연결 확인 → 저장

## 2. 전체 흐름

```
① 발견  /            사진 촬영·업로드 + 장소 + 사전 관찰(잎 모양·잎맥·줄기)
   ↓  POST /api/identify (제미나이)            → 후보 2~3종 {국명, 학명, 신뢰도, 근거}
② 추정  /            후보 고르기 또는 직접 입력
   ↓  GET /api/plants/search?q=국명 (국립수목원) → 도감번호  (0건이면 학명 속명으로 재검색)
③ 확인  /plant/[no]  GET /api/plants/detail?no= (국립수목원) → 형태·특징·생육환경·분포·유사종…
                      POST /api/explain (제미나이)  → 쉬운 설명 + 관찰 질문 3개 + 비교 힌트
④ 기록  /plant/[no]  일치/불일치/모름 · 관찰 질문 답 · 새로 알게 된 점 → 나의 도감 저장
📒 나의 도감 /my      이 기기(localStorage)에 저장된 카드, 인쇄
🔍 검색  /search      이름으로 찾는 작은 도감 (1단계 기능)
⚙️ 설정  /settings    키 입력·연결 확인·저장 방식·삭제
👩‍🏫 교사  /teacher     학급 설정 QR (학생 기기에 키 일괄 저장)
```

## 3. 키 구조 (사용자별)

| 어디에 | 무엇이 | 비고 |
|---|---|---|
| 브라우저 저장소 (`keys`) | 공공데이터포털 디코딩 키, 제미나이 키 | "이 기기에 저장"=localStorage, "이번만"=sessionStorage |
| 요청 헤더 | `x-data-key`, `x-gemini-key` | `lib/client/keys.ts` 의 `api()` 가 자동으로 붙임 |
| 서버 함수 | `lib/server/keys.ts` 의 `getKeys(req)` | 헤더에서 읽어 외부 호출 후 버림, 저장·기록 없음 |
| 서버 환경변수 | `DATA_GO_KR_KEY`, `GEMINI_API_KEY` | `ALLOW_SHARED_KEY=1` 일 때만, 헤더에 키가 없을 때 대신 사용 (강사 시연용) |

- 키가 없으면 서버가 `401 {error:"NO_DATA_KEY"|"NO_GEMINI_KEY"}` → 클라이언트가 설정 화면으로 이동
- 캐시는 검색어·도감번호 기준(키와 무관, 24시간) → 한 반이 같은 식물을 찾아도 호출 1회
- 학생 기기 배포: 설정 화면에서 직접 입력 또는 `/teacher` 의 QR(주소 `#k=…` 프래그먼트, 서버에 전송되지 않음)

## 4. 국립수목원 API (활용명세 확정)

기본 주소 `https://apis.data.go.kr/1400119/PlantResource` · 응답 XML

| 오퍼레이션 | 요청 변수 | 응답 핵심 항목 |
|---|---|---|
| `GET /plantPilbkSearch` | `serviceKey`, `pageNo`, `numOfRows`, `reqSearchWrd`(국명/학명) | `plantPilbkNo`, `plantGnrlNm`, `plantSpecsScnm`, `familyKorNm`, `genusKorNm`, `totalCount` |
| `GET /plantPilbkInfo` | `serviceKey`, `reqPlantPilbkNo` | `shpe` 형태, `spft` 특징, `grwEvrntDesc` 생육환경, `dstrb` 분포, `osDstrb`, `rrngType`, `rrngGubun`, `smlrPlntDesc` 유사종, `useMthdDesc`, `prtcPlnDesc`, `orplcNm`, `inductionDesc`, `engNm` |

- 응답에 **이미지 항목 없음** → 카드 사진은 학생이 찍은 사진
- 결과코드 `00` 정상, `03` 데이터 없음, 인증 오류는 `OpenAPI_ServiceResponse > cmmMsgHeader > returnReasonCode`(20/22/30/31)
- 개발계정 일 1,000건, 운영계정은 활용사례 등록 후 증설 신청
- 이용허락: 출처표시·상업적 이용금지·변경금지 → 원문은 수정 없이 표시, AI 재구성 글은 별도 탭에 표시

곤충(2차): `https://apis.data.go.kr/1400119/InsectService` 의 `insectPilbkSearch`(`reqSearchWrd`) / `insectPilbkInfo`(`reqInsctPilbkNo`), 상세 항목 `gnrlDsrct` 일반 특징, `ecoDsrct` 생태, `habitDsrct` 습성, `emrgcEraDscrt` 출현시기, `eggDsrct`/`larvaDsrct`/`pupaDsrct`/`femaleDsrct`/`maleDsrct` 한살이, `winterDsrct` 월동

## 5. 0단계 — 실제 응답 검증 (연수 전, 강사)

```bash
# .env.local 에 DATA_GO_KR_KEY=디코딩키 를 넣은 뒤
node scripts/check-api.mjs
```

검색어별 결과 수와 첫 결과를 출력하고, 원문 XML을 `samples/real_*.xml` 로 저장한다. "은행" 과 "은행나무" 의 totalCount 를 비교하면 부분일치 여부를 알 수 있다. 실제 응답을 `samples/plantPilbkSearch.xml`, `samples/plantPilbkInfo_<도감번호>.xml` 이름으로 바꿔 두면 모의 모드가 실제 자료로 동작한다.

## 6. 배포 (Vercel)

1. 저장소를 깃허브에 올리고 Vercel 에서 가져오기
2. 환경변수: 참가자용 배포본은 `MOCK=0`, `ALLOW_SHARED_KEY=0` 만 설정 (키 없음). 강사 시연본은 `ALLOW_SHARED_KEY=1` + 키 두 개
3. 배포 주소(HTTPS)로 휴대폰 접속 → 카메라 사용 가능. QR 코드로 주소 배포

## 7. 폴더 구조

```
app/
  layout.tsx, globals.css          공통 틀, 머리글 연결 상태, 하단 탭
  page.tsx                         ① 발견 → ② 추정  (components/DiscoverFlow.tsx)
  search/page.tsx                  🔍 이름 검색
  plant/[no]/page.tsx              ③ 확인 + ④ 기록  (components/PlantDetail.tsx)
  my/page.tsx                      📒 나의 도감
  settings/page.tsx                ⚙️ 키 설정
  teacher/page.tsx                 👩‍🏫 학급 설정 QR
  components/                      Steps, KeyStatus, KeyFromFragment, BottomNav
  api/plants/search, api/plants/detail, api/identify, api/explain, api/check
lib/server/keys.ts                 헤더에서 키 읽기 (사용자별 키 구조의 핵심)
lib/server/datagokr.ts             국립수목원 호출·XML→JSON·캐시·모의
lib/server/gemini.ts               제미나이 식별·설명 (JSON 스키마 강제)
lib/client/keys.ts                 브라우저 키 보관 + api() 공통 호출
lib/client/{image,draft,cards}.ts  사진 축소, 작업 중 자료, 도감 카드
samples/                           모의 응답 XML (실제 응답으로 교체 가능)
scripts/check-api.mjs              0단계 검증 스크립트
```

## 8. 다음 단계

- 곤충 탐사(2차): `lib/server/insects.ts` + `/api/insects/*` 추가, 발견 화면에 식물/곤충 전환
- 학급 공유 도감(Supabase): 교사 로그인 + 학급 코드로 키를 서버에 암호화 저장 → 학생 기기에 키 없음
- 비슷한 식물 비교: `smlrPlntDesc` 로 두 카드 나란히 보기
