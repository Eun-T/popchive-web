# Google Maps 지도 연동

홈의 Google Static Maps 미리보기와 전용 키·쿼터 설정은 [HOME_STATIC_MAP.md](./HOME_STATIC_MAP.md)를 참고한다. 아래 JavaScript SDK 설정은 기존 `/map`과 상세 위치 지도용이며 홈에서 자동 재사용하지 않는다.

## 현재 구현

- `/map`은 기존 공통 레이아웃을 사용한다. 데스크톱 본문 826px, 간격 24px, TODAY 230px을 유지한다.
- Google Maps JavaScript SDK는 클라이언트에서만 로드한다. SSR에서는 높이를 확보한 안내 영역을 표시한다.
- 기본 중심은 서울(37.5665, 126.9780), 확대 단계는 12이다. 지도 높이는 데스크톱 650px, 모바일 `clamp(360px, 65dvh, 650px)`이다.
- 실제 API 좌표만 검은 원형 Advanced Marker로 표시한다. 선택하면 이름을 텍스트로 표시한다.
- API 키 누락, SDK 로딩/인증 실패, 백엔드 실패, 정상적인 빈 목록을 구분한다.
- 홈, 플레이스, TODAY 디자인과 기존 인증 기능은 변경하지 않는다. 패키지를 추가하지 않았다.

## 환경변수 설정

### 기존 popku 스타일 적용

- `/map`의 `app/components/map/PopupMap.client.vue`는 이미 초기화 옵션의 `mapId`에 `runtimeConfig.public.googleMapsMapId`를 전달한다.
- 로컬 `.env`와 확인한 프로세스/사용자/시스템 환경변수에 `NUXT_PUBLIC_GOOGLE_MAPS_MAP_ID`가 없어 `DEMO_MAP_ID`가 사용되고 있었다. 실제 브라우저의 런타임 값을 직접 검사한 결과와는 구분한다.
- 사용자가 제공한 기존 **POPKU Web** ID `8874d01a85c7c50d28c8018f`를 로컬 `.env`에 설정했다. 기존 초기화 코드가 이 값을 사용하므로 지도 기능 코드를 수정할 필요는 없다. 배포 환경에도 같은 변수를 설정하고 Nuxt 서버를 재시작한다.
- 홈 Static Maps ID `8874d01a85c7c50d6fe5cae7`는 별도 설정이며 이번 변경에서 수정하지 않는다. 새 Map ID나 스타일을 만들거나 기존 Cloud 스타일을 변경하지 않았다.
- Google Cloud에서 기존 POPKU Web ID가 JavaScript 유형이며 게시된 popku 스타일과 연결되어 있어야 한다. 이 연결 상태는 사용자가 제공한 정보이며 Cloud 콘솔에 접속해 직접 검증하지 않았다.
- [공식 스타일 요구사항](https://developers.google.com/maps/documentation/javascript/cloud-customization/setup)은 JavaScript의 Raster와 Vector 모두를 지원한다. 현재 SDK는 weekly 채널이다. `renderingType`을 코드에서 강제하지 않고 기존 Web Map ID의 렌더링 설정을 따른다([공식 렌더링 문서](https://developers.google.com/maps/documentation/javascript/map-rendering-type#use_a_map_id_to_set_rendering_type)). 별도 JSON `styles` 옵션을 추가하지 않는다.
- 팝업 마커/이름 창/상세 링크, 드래그·줌, 기존 중심 `(37.5665, 126.9780)`/zoom 12, 레이아웃과 반응형은 유지한다. 현재 `/map` 소스에는 별도의 현재 위치 버튼·검색·필터 구현이 없으며 이번 작업에서 추가하지 않는다.

루트 `.env.example`을 참고해 로컬 `.env` 또는 Nuxt 서버 배포 환경에 다음 값을 설정한다. 실제 키는 소스코드나 문서에 저장하지 않는다.

```dotenv
NUXT_PUBLIC_GOOGLE_MAPS_API_KEY=웹용_브라우저_키
NUXT_PUBLIC_GOOGLE_MAPS_MAP_ID=8874d01a85c7c50d28c8018f
NUXT_API_BASE=https://api.popchive.com
```

- `NUXT_PUBLIC_GOOGLE_MAPS_API_KEY`: 필수. `runtimeConfig.public.googleMapsApiKey`에 연결된다. 브라우저 SDK에 전달되므로 브라우저에서 확인할 수 있는 공개 설정이다.
- `NUXT_PUBLIC_GOOGLE_MAPS_MAP_ID`: 개발 중에는 선택 사항이며 비어 있으면 공식 `DEMO_MAP_ID`를 사용한다. 운영에서는 본인 프로젝트의 JavaScript 유형 Map ID를 설정한다. API 키와 Map ID는 서로 다른 값이다.
- `NUXT_API_BASE`: 기존 서버 전용 설정. 기본값이 운영 API이므로 변경할 필요가 없다.
- 환경변수를 설정한 뒤 Nuxt 개발 서버를 재시작한다. 운영에서는 실행 환경에 변수를 설정하고 서비스를 재시작한다. 정적 파일 전용 배포는 이 서버 API 경유 구조에 맞지 않는다.
- Google Cloud 프로젝트에서 Maps JavaScript API와 결제를 활성화해야 한다.

## 브라우저 키 제한

Google Cloud Console → API 및 서비스 → 사용자 인증 정보 → 해당 API 키에서 설정한다.

1. 애플리케이션 제한을 **웹사이트(HTTP referrer)**로 설정한다.
2. 로컬에서 실제 사용하는 주소와 포트를 등록한다. 예: `http://localhost:3000/*`. `127.0.0.1`을 사용하면 해당 주소도 별도로 등록한다.
3. 운영에서는 실제 웹사이트의 HTTPS 도메인만 등록한다. 현재 코드에서 웹 운영 도메인은 확인되지 않았으며, API 도메인 `api.popchive.com`을 웹 도메인으로 간주하지 않는다.
4. API 제한을 **Maps JavaScript API**로 제한한다.
5. 로컬과 운영 키를 분리하면 각 환경의 허용 referrer를 관리하기 쉽다.

백엔드 서버용 키나 모바일용 키를 브라우저 키로 재사용하지 않는다. 키 제한과 결제 설정은 이번 코드 작업에서 변경하지 않았다.

## API 계약 및 요청 흐름

```text
브라우저 지도 idle (250ms debounce)
→ 같은 출처 GET /api/popups/map
→ Nuxt 서버 GET https://api.popchive.com/api/popups/map
```

- 매 요청에 `minLat`, `maxLat`, `minLng`, `maxLng`와 `languageCode=ko`를 보낸다.
- 동일 영역의 완료/진행 중 요청은 반복하지 않는다. 새 이동이 시작되면 이전 브라우저 요청을 취소하며, 늦게 도착한 결과는 적용하지 않는다.
- 날짜 변경선을 가로지르면 백엔드의 `minLng <= maxLng` 조건에 맞춰 두 영역으로 나누고 ID 중복을 제거한다. 일반적인 서울 영역은 요청 한 번이다.
- 서버 프록시는 고정된 공개 지도 Endpoint만 호출한다. 요청한 임의 URL, Cookie, Authorization, Origin을 전달하지 않는다.
- 서버에서 네 좌표와 응답 형태를 검증한다. 사용하지 않는 이미지 URL·태그·기간은 브라우저로 전달하지 않는다. 응답은 `{ popups: [{ id, name, latitude, longitude }] }`이다.
- 지도 API는 현재 진행 중이며 좌표가 있는 팝업만 반환한다. 모든 미래/종료 팝업을 표시하는 목록이 아니다.
- 캐시는 적용하지 않았다. 브라우저 응답도 `no-store`이며, 불필요한 요청은 클라이언트에서 줄인다.
- Nuxt 서버에서 백엔드를 호출하므로 브라우저와 백엔드 사이의 CORS에 의존하지 않는다.

## 실제 백엔드 코드 근거

아래 경로는 `popku-be` 루트 기준이며 읽기 전용으로 확인했다.

- `src/main/java/org/popku/popup/controller/PublicPopupController.java:55`: GET `/api/popups/map`, 선택적 네 bounds의 동시 입력 및 최소/최대 순서 검증, 언어 검증.
- `src/main/java/org/popku/popup/dto/PublicPopupRows.java:14`: `MapPopup`의 id, name, latitude, longitude, primaryTag, startDate, endDate, coverImageUrl, tags. `MapResponse`는 popups 배열이다.
- `src/main/java/org/popku/popup/service/PublicPopupService.java`: 지도 좌표 조회와 번역된 이름 반영. 실제 처리 위치는 해당 파일의 `map` 메서드이다.
- `src/main/resources/org/popku/popup/mapper/PublicPopupMapper.xml:59`: `p.public_id AS id`를 확인했다. 지도 ID는 상세 조회의 publicId와 같다.
- 같은 Mapper의 `map` SELECT는 오늘을 운영 기간 안에 포함하며 위경도가 있는 팝업만 조회한다.
- 웹에는 아직 팝업 상세 라우트가 없어 마커에서 상세 이동은 연결하지 않았다.

## 확인한 결과와 남은 확인

- 2026-10-25, 운영 API에 서울 범위(minLat=37.4, maxLat=37.7, minLng=126.7, maxLng=127.3, languageCode=ko)의 읽기 전용 GET을 실행해 HTTP 200과 팝업 15개의 좌표를 확인했다.
- 위 결과는 운영 백엔드 직접 GET 결과다. 새 Nuxt 프록시를 실행해서 확인한 결과나 브라우저의 마커 렌더링 결과는 아니다.
- 작업 환경에는 웹용 키가 아직 설정되지 않았다. 사용자가 웹용 키를 보유하고 추후 환경변수에 설정할 예정이라고 확인했다.
- Google 지도 표시, 키 referrer 제한 통과, 지도 이동 후 Nuxt 프록시와 마커 표시의 전체 흐름은 키 설정 후 브라우저에서 확인해야 한다. 현재 이를 정상 연결 확인 완료로 보고하지 않는다.
- 테스트, 타입 검사, 빌드, Playwright 및 브라우저 자동화는 실행하지 않았다. 백엔드와 DB를 수정하지 않았다.

## 공식 참고

- [SDK 로딩](https://developers.google.com/maps/documentation/javascript/load-maps-js-api)
- [Advanced Markers 및 Map ID](https://developers.google.com/maps/documentation/javascript/advanced-markers/start)
- [HTML 마커](https://developers.google.com/maps/documentation/javascript/advanced-markers/html-markers)
- [브라우저 키 제한](https://developers.google.com/maps/api-security-best-practices)
- [SDK 오류 및 결제 확인](https://developers.google.com/maps/documentation/javascript/error-messages)
