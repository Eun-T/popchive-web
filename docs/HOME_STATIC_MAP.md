# 홈 서울 Static Maps 미리보기

## 목차

1. [구현과 요청 흐름](#구현과-요청-흐름)
2. [서울 팝업 집계 계약](#서울-팝업-집계-계약)
3. [이미지와 마커](#이미지와-마커)
4. [키 설정과 서명](#키-설정과-서명)
5. [비용 관리](#비용-관리)
6. [검증과 한계](#검증과-한계)

## 구현과 요청 흐름

- `app/components/home/HomeSeoulMap.vue`를 TOP 10과 일본 신상 팝업 사이에 배치한다. 기존 섹션과 `/map` 화면은 변경하지 않는다.
- 제목은 기존 홈 기준 20px/700/28px, 설명은 보조색 14px이다. 상단 간격 52px, 헤더 아래 20px, 지도 높이 데스크톱 360px, 모바일 `clamp(240px, 60vw, 320px)`, radius 12px이다.
- SSR와 hydration 초기에는 Google 이미지 URL, `<img>`, preload가 없다. `IntersectionObserver`의 상하 200px 근처에 진입하면 한 번만 시작한다. 미지원 브라우저에는 대체 안내를 표시한다.
- 기존 `GET /api/popups/map?preview=seoul` 경로의 추가 조회 모드로 JSON을 받는다. 새 라우트·이미지 프록시·백엔드 API를 만들지 않았다. 기존 bounds 조회 모드는 유지한다.
- Nuxt 서버가 기존 공개 `/api/regions?countryCode=KR`을 조회하고, `/api/popups?status=ONGOING&languageCode=ko`와 `status=UPCOMING`의 전체 목록을 병렬 조회한다. 국가·지역·페이지 필터를 생략해 같은 두 목록 요청으로 한국·일본 통계와 기존 서울 마커 데이터를 함께 계산한다. 캐시가 없으면 백엔드 요청은 기존과 같은 총 3회다.
- 성공한 공개 JSON만 Nitro에 60초 캐시한다. 캐시 키에 서버 API Base URL과 서울 날짜가 포함된다. 브라우저 API 응답은 `no-store`다. 이미지나 Google API 키는 서버 캐시에 넣지 않는다.
- JSON 조회 성공 후 브라우저가 Google의 `https://maps.googleapis.com/maps/api/staticmap`을 `<img src>`로 직접 요청한다. JavaScript 지도 SDK를 홈에서 로드하지 않는다.
- 컴포넌트 생명주기 중 이미지 URL은 한 번만 설정한다. 스크롤·크기 변경·이미지 실패에 따른 재요청, 타이머 갱신, 자동 재시도가 없다. 홈을 떠났다가 다시 방문하면 새 생명주기이므로 요청이 다시 발생할 수 있다.
- API 실패 시 숫자를 표시하지 않는다. 키 미설정·이미지 오류는 대체 안내와 `/map` 이동 링크로 처리한다. 두 상태를 정상적인 0개와 구분한다.

## 서울 팝업 집계 계약

아래 근거는 `popku-be`의 코드를 읽기 전용으로 확인했다. 기존 조사 이력은 [API_INTEGRATION_AUDIT.md](./API_INTEGRATION_AUDIT.md), 일반 지도는 [GOOGLE_MAPS.md](./GOOGLE_MAPS.md)를 참고한다.

| 항목 | 확인된 계약 / 처리 |
| --- | --- |
| 전체 목록 | `PublicPopupController.browse`: limit/cursor/weekStart/weekEnd를 모두 생략하면 페이지네이션 없는 ListResponse. `PublicPopupMapper.xml`의 list 쿼리는 이 모드에서 LIMIT가 없다. |
| 페이지 목록 | limit=10 모드는 `{popups, nextCursor}`다. 홈의 최근 등록 10개 배열을 전체 개수로 사용하지 않는다. 전체 목록에는 totalElements가 없다. |
| 지역 | `PublicFilterOptionsController`의 `{id,name}[]`에서 성수/여의도/잠실/홍대·신촌/강남·서초/용산/서울 기타의 ID를 조회한다. `PopupRegionMatcher`가 서울을 이 7개로 분류한다. ID를 하드코딩하지 않는다. |
| 날짜 | `status=ONGOING`과 `status=UPCOMING`을 각각 요청한다. 서울 날짜로 종료일이 지난 항목을 다시 제외한다. 종료일 당일은 포함하고, 미래 시작일의 종료일 null은 허용한다. |
| 공개 상태 | 공개 GET `/api/popups`에서 반환된 데이터만 사용한다. 확인한 공개 목록 SQL/DTO에는 별도 published/visibility 필드나 초안 필터가 없다. 별도 공개 플래그를 검증했다고 주장하지 않는다. 공개 계약이 바뀌면 서버 필터를 재확인해야 한다. |
| 중복 | 두 전체 목록을 publicId로 합친다. 장소·좌표가 같아도 publicId가 다르면 별도 팝업이다. |
| 좌표 누락 | 전체 개수에 포함한다. 기존 API의 좌표 응답은 유지하지만 홈 지도 이미지에는 사용하지 않는다. |
| 계약 오류 | 지역 분류가 누락/중복되거나 응답이 페이지 형식으로 바뀌면 집계를 실패시킨다. 일부 결과나 0으로 대체하지 않는다. |

집계 기준은 **등록된 서울 지역 분류**다. 이미지의 표시 범위와 관계없이 서울 전체 등록 지역의 팝업 수를 집계한다. 지역 미등록·오분류 데이터까지 좌표로 추정해 보정하지 않는다. 데이터 정비는 이번 범위에 포함하지 않는다. 두 목록은 독립 요청이므로 변경이 동시에 발생하는 순간의 트랜잭션 스냅샷을 보장하지는 않는다.

## 이미지와 마커

- `app/utils/seoulStaticMap.ts`에서 URL을 만든다. `maptype=roadmap`, `language=ko`, `region=KR`, `format=png`, `scale=2`다.
- 중심 `(37.5300, 126.9780)`과 zoom **11**을 유지한다. Static Maps URL은 팝업 마커 없이 배경만 요청하며, 아래 지역별 집계를 HTML로 겹쳐 표시한다.
- 홈 전용 `NUXT_PUBLIC_GOOGLE_STATIC_MAP_ID`가 있으면 URL에 `map_id`로 추가하고, 비어 있으면 해당 파라미터 없이 기본 지도를 사용한다. 기존 iOS/Android/JavaScript Map ID 및 Cloud 스타일 설정은 변경하지 않는다.
- 첫 로딩 시 컨테이너 비율을 측정해 `size`의 각 변을 최대 640으로 제한한다. 예: 데스크톱 826×360 → `size=640x279&scale=2`, 실제 파일 1280×558px. 모바일 335×240 → `size=335x240&scale=2`.
- `object-fit: contain`으로 전체 이미지를 보존한다. 리사이즈 후 비율이 달라지면 여백이 생길 수 있으며, 이를 없애기 위해 새 유료 요청이나 로고/저작권 잘림을 만들지 않는다.
- `markers` 파라미터는 사용하지 않는다. 응답 `totalCount`는 서울 마커 집계를 위해 그대로 유지하며, 하단 통계는 별도 `popupStats.totalCount`(한국+일본 전체)를 사용한다. 마커 수 등 개발자용 하단 설명은 표시하지 않는다. 최종 인코딩 URL 16,384자 제한은 유지한다.
- 지도 이미지·원형 마커·대체 안내는 `/map`으로 이동한다. 하단의 40×40px 회색 원형 화살표는 실제 목록 라우트 `/places`로 이동한다. Google 로고·저작권을 덮는 안내나 버튼은 정상 이미지 위에 표시하지 않는다.
- 기존 `/map`의 진행 중 팝업만 조회하는 동작은 유지한다. 따라서 예정 팝업까지 포함한 홈의 개수와 기존 지도 화면의 결과는 다를 수 있다.

크기·scale·URL 길이의 근거: [Static Maps 시작 가이드](https://developers.google.com/maps/documentation/maps-static/start). 이미지 자체를 저장하거나 자체 CDN으로 재배포하지 않는다([공식 FAQ](https://developers.google.com/maps/faq#can-i-generate-a-map-image-using-the-maps-static-api-which-i-store-and-serve-from-my-website)).

### 하단 한국·일본 전체 통계

- 첫 줄은 `지금 만나볼 수 있는 팝업`(14px/400/보조색), 둘째 줄은 `총 N개`(단위 16px/500, 숫자 30px/700)다. 숫자와 단위는 baseline으로 정렬한다. 별도 카드나 테두리 없이 흰 배경을 사용한다.
- 기존 홈 최근 등록 응답은 limit=10이고 전체 개수 필드가 없다. 메인 배너와 NOW_HOT도 전체 목록이 아니며, 일본 신상 섹션과 `/places`는 목업 데이터를 사용하므로 집계 출처로 사용하지 않는다.
- 기존 상태별 목록 조회에서 국가·서울 지역 필터를 제거해 페이지네이션 없는 전체 응답을 받는다. `PublicPopupController.browse`는 limit/cursor/weekStart/weekEnd가 없을 때 전체 목록을 반환하며, 목록 SQL의 국가·지역 조건은 해당 값이 있을 때만 적용된다. 새 API나 국가별 추가 요청이 필요하지 않다.
- 공개 목록 중 countryCode가 KR 또는 JP이고 기존 서울 날짜 기준 진행 중/예정 조건을 만족하는 팝업을 publicId로 중복 제거한다. 같은 ID의 국가가 충돌하거나 페이지 응답으로 계약이 바뀌면 오류로 처리한다. 종료 항목은 제외한다. 별도 공개 플래그는 기존 공개 API 계약에 따른다.
- `popupStats`는 `{KR, JP, totalCount}`이며 totalCount는 두 국가의 고유 ID 총수다. 좌표·지역 누락 또는 서울 밖이라는 이유로 한국·일본 통계에서 제외하지 않는다. 서울의 `totalCount`, `areas`, `otherCount`는 같은 응답에서 기존 서울 ID/좌표 기준으로 별도로 계산한다.
- 데이터 대기 중에는 숫자 자리에 스켈레톤, 오류 시에는 `전체 팝업 수를 불러오지 못했습니다.`를 표시한다. 실패를 0개로 대체하지 않는다. 전체 목록이 정상적으로 비어 있을 때만 총 0개다.
- maxAge 60초/no SWR, 브라우저 no-store, 지도 Lazy Loading, 기존 이미지 요청·지역 원·시각적 offset은 유지한다. 응답 스키마와 조회 범위 변경을 위해 내부 캐시 이름만 v3로 구분한다.
- 2026-10-26 실제 공개 전체 응답으로 한국 20개·일본 2개·합계 22개를 확인했다. 서울 집계는 20개, 지역별 2·3·4·6·2·0개/기타 3개로 유지됐다. 수량을 코드에 고정하지 않았다.

### 서울 6개 지역 집계와 원형 오버레이

- 기존 집계 함수 `server/utils/seoulMapPreview.ts`에서 이미 받은 전체 진행 중/예정 목록을 재사용한다. 백엔드 요청은 캐시 미스 시 기존과 같은 3회(지역 옵션 1회 + 상태별 목록 2회)이며 지역별 요청은 없다.
- 기존 응답의 `areas`(지역별 count와 평균 위경도), `otherCount`를 사용한다. 새로운 엔드포인트는 없다. JSON 캐시의 maxAge 60초/no SWR와 브라우저 no-store를 유지한다.
- 목록 DTO에는 주소가 없으므로 공개 목록 SQL/DTO에 없는 주소를 가정하거나 상세 API를 추가 호출하지 않는다. API에서 받은 지역 ID를 확정된 지역 이름으로 해석하고 유효한 좌표까지 함께 확인한다. 이름 부분 문자열이나 팝업 제목으로 분류하지 않는다.
- 분류 기준은 `shared/utils/seoulMapAreas.ts`의 **보수적인 상권 범위**이며 행정구역 전체 경계가 아니다. 해당 원본 지역 ID 또는 서울 기타 ID와 아래 좌표 범위를 모두 만족해야 한다. 경계선·복수 후보·좌표 누락/오류·권역 불일치는 기타로 둔다. 서울 기타에 등록됐어도 명확한 핵심 상권 내부이면 분류한다.

| 표시 이름 | 허용 원본 지역 | 위도 / 경도 범위 (경계 제외) |
| --- | --- | --- |
| 홍대 | 홍대·신촌 또는 서울 기타 | 37.545~37.565 / 126.915~126.932. 신촌 쪽은 제외 |
| 용산 | 용산 또는 서울 기타 | 37.515~37.555 / 126.945~127.010 |
| 여의도·영등포 | 여의도 또는 서울 기타 | 여의도 핵심 37.515~37.535 / 126.915~126.940, 또는 영등포역 상권 37.509~37.523 / 126.895~126.913 |
| 성수 | 성수 또는 서울 기타 | 37.533~37.555 / 127.035~127.075 |
| 강남 | 강남·서초 또는 서울 기타 | 북측 핵심 37.513~37.535 / 127.022~127.065, 또는 역삼·삼성 핵심 37.495~37.513 / 127.031~127.065. 서초 쪽은 제외 |
| 잠실 | 잠실 또는 서울 기타 | 37.505~37.525 / 127.072~127.115 |

- 전체 목록을 먼저 publicId로 중복 제거한 뒤 각 항목을 한 지역에만 집계한다. 중복 ID의 좌표/분류가 충돌하면 해당 ID는 한 번만 기타로 센다. `6개 지역 합 + 기타 = totalCount`를 유지한다. 넓은 원본 권역이나 범위 밖 데이터를 가장 가까운 원에 억지로 넣지 않는다.
- 원의 기준 위치는 해당 지역에 실제 집계된 팝업 좌표의 산술평균이다. 고정 픽셀·임의의 대표 장소·신규 지오코딩을 사용하지 않는다. 0개 지역은 원을 표시하지 않는다.
- 디자인은 RN의 검은 원형 클러스터를 참고한 #111827/흰색 숫자 16px·600, 흰 테두리, 지름 44px이다. 모바일은 지름 40px과 작은 지역명으로 조정한다. RN 코드는 읽기 전용으로 확인했고 수정하지 않았다.
- [Google의 Web Mercator 좌표 설명](https://developers.google.com/maps/documentation/javascript/coordinates)에 따라 worldSize=256×2^zoom에서 중심점과 지역 위치의 픽셀 차이를 구한다. 이 차이에 원본 이미지의 절반 크기를 더하고, `object-fit:contain`의 실제 배율과 좌우/상하 여백을 적용한다. scale=2는 이미지와 좌표를 동시에 2배로 하므로 표시 배율에서 상쇄된다.
- `ResizeObserver`는 표시 영역 크기와 오버레이 좌표만 갱신한다. 원본 이미지 URL/size/scale/zoom/center를 바꾸지 않으며 Google 추가 요청을 발생시키지 않는다. 이미지 로딩 성공 후에만 원을 표시한다.
- 원·이름 전체가 이미지 밖으로 나가거나 저작권 하단 영역과 겹치면 해당 원은 숨긴다. 지도 가장자리로 옮겨 잘못된 위치를 표시하지 않는다. 기존 이미지를 매우 다른 비율로 축소하면 일부 원이 숨겨질 수 있다. 하단 전체 개수와 접근성용 지역별 안내는 유지한다.
- 오버레이는 기존 `/map` 링크 안에 있으며 별도 클릭 처리를 하지 않는다. 원 클릭도 `/map`으로 이동한다. SDK 로딩·Google Cloud 변경·지도 캡처/저장·백엔드/DB 변경은 없다.

지역 집계 적용 시점(2026-10-26)의 실제 공개 API 결과:

| 구분 | 개수 |
| --- | ---: |
| 서울 전체 | 20 |
| 홍대 | 2 |
| 용산 | 3 |
| 여의도·영등포 | 4 |
| 성수 | 6 |
| 강남 | 2 |
| 잠실 | 0 |
| 기타 | 3 |

서울 기타로 등록된 여의도 핵심 좌표의 2개 항목을 여의도·영등포에 포함했다. 홍대·신촌 중 신촌 쪽 1개, 강남·서초 중 서초 쪽 1개, 나머지 범위 밖 1개는 기타다. 수량은 이 시점의 조회 결과이며 제품 코드에 고정하지 않았다.

## 키 설정과 서명

로컬 `.env` 또는 Nuxt 실행 환경에 다음 **브라우저용 공개 키**를 설정하고 Nuxt 서버를 재시작한다. 실제 값은 문서나 커밋에 넣지 않는다.

```dotenv
NUXT_PUBLIC_GOOGLE_STATIC_MAPS_API_KEY=Static_Maps_브라우저용_키
NUXT_PUBLIC_GOOGLE_STATIC_MAP_ID=8874d01a85c7c50d6fe5cae7
```

1. Google Cloud에서 해당 프로젝트의 결제 연결과 **Maps Static API** 활성화를 확인한다.
2. API 키의 애플리케이션 제한을 **웹사이트(HTTP referrer)**로 설정한다. 실제 로컬 포트의 `http://localhost:포트/*` 및 실제 운영 HTTPS 도메인을 허용한다. 다른 호스트를 쓰면 별도 등록한다.
3. API 제한은 **Maps Static API**로 제한한다. 기존 JavaScript API 키를 자동 재사용하지 않는다. 동일 키 사용을 직접 결정할 경우에도 해당 API의 허용 여부를 확인해야 한다.
4. 브라우저가 Origin referrer를 보낼 수 있어야 한다. 현재 이미지는 `strict-origin-when-cross-origin`을 사용한다. 프록시/배포에서 Referer를 제거하는 설정이 있으면 별도 확인한다.

Map ID는 선택 사항이며 API 키를 대체하지 않는다. [Google 공식 Static Maps Map ID 문서](https://developers.google.com/maps/documentation/maps-static/map-ids/get-map-id#maps_static)는 Static Maps URL의 `map_id`를 지원한다. 실제 커스텀 스타일 표시를 위해서는 제공한 ID가 **Static maps용**이며, 기존 popku 스타일의 게시된 버전에 연결되어 있어야 한다([스타일 연결 안내](https://developers.google.com/maps/documentation/maps-static/cloud-customization/map-styles)). 이 Cloud 연결 상태는 이번 코드 작업에서 확인하거나 변경하지 않았다. 배포 환경에도 홈 전용 변수를 설정하고 Nuxt 실행 서버를 재시작한다. 잘못된 ID가 설정된 경우 자동으로 ID를 제거해 이미지 요청을 재시도하지 않는다.

현재 구현은 **서명 없는 브라우저 직접 URL**이다. Google은 디지털 서명을 권장한다. 프로젝트에서 서명 없는 요청을 금지하거나 서명 요청만 허용했다면 이번 구현은 대체 UI로 끝나며 우회하지 않는다. 기존 Nuxt handler에는 URL 서명 기능이 없고, 이번에는 signing secret이나 서명 로직을 추가하지 않았다. 서명이 필수인 경우 기존 JSON 조회 handler에서 URL을 서버 서명해 반환하는 변경을 별도 검토할 수 있다. 이미지 프록시가 필요한 것은 아니다. **서명 비밀키를 public runtimeConfig에 넣으면 안 된다.**

[설정 가이드](https://developers.google.com/maps/documentation/maps-static/get-api-key), [키 제한](https://developers.google.com/maps/api-security-best-practices), [디지털 서명](https://developers.google.com/maps/documentation/maps-static/digital-signature).

## 비용 관리

- 별도 SKU인 Static Maps 이미지 요청량에 따라 비용이 발생한다. 지연 로딩은 보지 않는 영역의 요청을 줄일 뿐 무료 이용을 보장하지 않는다. 실제 청구는 계정의 무료 한도·계약·사용량에 따른다([공식 요금표](https://developers.google.com/maps/billing-and-pricing/pricing)).
- Google Cloud Console → Google Maps Platform → Quotas 또는 Maps Static API → Quotas & System Limits에서 제공되는 일별/분당/서명 없는 요청 한도를 확인하고 필요한 수준으로 제한한다. 한도 초과 시 이미지가 실패할 수 있으므로 대체 UI를 유지한다. 실제 계정의 사용 가능한 한도와 수정 권한은 직접 확인해야 한다.
- Google Maps Platform → Metrics에서 Maps Static API 요청 수와 오류를 확인하고, Cloud Billing → Reports에서 해당 프로젝트/Static Maps 비용을 확인한다.
- Billing → Budgets & alerts에서 알림을 설정할 수 있다. **일반 예산 알림은 사용량이나 과금을 자동 차단하지 않는다.** 알림과 API 쿼터는 별개다([공식 예산 문서](https://docs.cloud.google.com/billing/docs/how-to/budgets)).
- 이번 작업에서 Cloud 설정·쿼터·결제 계정은 변경하지 않는다. Dynamic Maps 로드는 추가하지 않는다.

## 검증과 한계

지역 원형 오버레이 추가 후 `npm run typecheck`, `npm run build`가 통과했다. 실제 공개 API 스냅샷으로 20개/지역별 2·3·4·6·2·0개/기타 3개, 중복 ID·충돌 좌표·누락 좌표·종료일 제외·경계 및 중첩 영역 제외를 검증했다. 집계당 백엔드 요청은 기존 3회로 추가 요청이 없음을 확인했다.

280/335/728/826px 초기 화면에서는 5개 양수 지역의 원이 모두 지도 내부에 위치한다. 같은 이미지의 비율이 달라지는 크기 변경에서도 scale=2를 직접 적용한 독립 계산과 22개 표시 좌표를 비교해 오차 0.0000001px 미만을 확인했다. 좌표 재계산 중 URL은 바뀌지 않는다. 이는 수학적 위치 검증이며 실제 Google 이미지 위의 브라우저 시각 검증은 수행하지 않았다. 극단적인 축소에서 원이나 저작권 표시가 겹칠 위치는 숨긴다.

아래 20개/17개 및 URL 마커 제한 검증은 초기 구현의 조사 이력이다. 현재 Static Maps URL은 마커 없이 zoom 11을 사용하며 HTML 지역 원형 오버레이와 기존 전체 개수 집계를 사용한다.

- 2026-10-26 기존 공개 API의 실제 응답을 읽기 전용으로 확인했다. 진행 중 14개 + 오픈 예정 6개, 구현한 필터·publicId 중복 제거 결과 총 20개다. 좌표 등록 팝업도 20개이고 같은 좌표를 합친 URL 마커는 17개다. 시점별 조회 결과이며 코드에 수량을 고정하지 않는다. Google이 렌더링한 실제 이미지에서 17개를 육안 확인한 결과는 아니다.
- `npm run typecheck`, `npm run build` 통과. 별도 패키지 설치 없이 기존 Node 22.23.3 실행 파일을 사용했다. 빌드에는 Vite 플러그인 처리 시간 경고가 있었으며 완료를 막는 오류는 없었다.
- 메모리에서 실행한 집계/URL 검증에서 날짜 경계, 종료 제외, publicId 중복, 좌표 누락, 정상 빈 목록, 페이지 응답/지역 누락/잘못된 날짜/API 실패 시 오류 전달, 같은 위치 합치기, 100개 위치 제한, 인코딩 URL 길이 제한을 확인했다. 검증용 모의 응답은 제품에 넣지 않았다.
- 실제 공개 API 스냅샷을 집계 함수에 적용해 20개/17개를 확인했다. 브라우저 검증 준비 중 Node 로컬 서버 listen이 `EFAULT`로 실패해 브라우저 테스트는 실행 단계에 도달하지 못했다. 실제 SSR HTTP 응답·hydration·스크롤·리사이즈 중 요청 횟수는 미검증이며, 소스에서 SSR 초기 src 없음/IntersectionObserver/1회 실행 guard/contain/링크를 확인한 결과와 구분한다. 스크린샷은 촬영하지 않았다.
- 구현 시 로컬 `.env`에는 기존 JavaScript 지도 키가 설정되어 있었으나 Static Maps 전용 변수는 없었다. 실제 키 값은 출력하거나 복사하지 않았다. Google Cloud의 API 활성화·referrer 제한·서명 한도는 확인할 권한이 없어 미확인이다.
- 실제 Google 이미지 요청 성공, Google이 렌더링한 지도의 시각적 품질·저작권 표시, 운영 도메인 referrer 통과는 키 설정 후 브라우저에서 확인해야 한다. 로컬 타입 검사나 모의 응답 검증으로 이 부분이 통과했다고 간주하지 않는다.
