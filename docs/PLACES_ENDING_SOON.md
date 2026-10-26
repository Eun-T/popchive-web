# 플레이스 탐색 — 곧 끝나요

## 적용 범위

`app/pages/places.vue`의 탐색 탭 준비 중 문구를 `PlacesEndingSoon.vue`로 교체했다. 기본 탭 선택과 전체 탭의 카드·필터·정렬·페이지네이션은 유지한다. 다른 탐색 섹션은 만들지 않았다.

## 데이터 계약

- 앱의 `getEndingSoonPopups`와 같은 기존 공개 `GET /api/popups?endingSoon=true&languageCode=ko`를 사용한다. `popku-be`의 `PublicPopupController`와 `PublicPopupMapper.xml`을 읽기 전용으로 확인했다.
- 백엔드는 진행 중이며 종료일이 서울 날짜 기준 오늘~5일 후인 항목을 종료일 오름차순/동률 ID 순으로 최대 7개 반환한다. 국가 필터를 생략하고, 웹에서 KR/JP만 표시한다. 전체 팝업 수를 의미하는 배열이 아니다.
- Nuxt의 읽기 전용 중계 `GET /api/places/ending-soon`에서 기존 백엔드 API를 한 번 조회한다. 기존 백엔드 API 계약·코드·DB는 바꾸지 않는다. 임의 URL/query, Cookie, Authorization, Origin을 전달하지 않는다.
- 정상 공개 응답만 30초 캐시하고 SWR은 사용하지 않는다. 캐시 키는 API Base URL과 UTC+9 날짜다. 중계 응답은 `no-store`이며 오류를 빈 배열로 바꾸지 않는다.
- `normalizeEndingSoon`에서 날짜·이미지 URL을 확인하고 publicId 중복, 이미 종료/오픈 예정/5일 초과 항목을 제외한다. 이미지가 없거나 실패하면 실제 카드의 텍스트와 대체 안내를 표시한다. 목업이나 복제 카드로 채우지 않는다.
- 별도 공개 플래그를 추측하지 않고 기존 공개 API가 반환한 데이터를 사용한다. 사진은 기존 S3 서명 URL을 그대로 사용하며 저장·재배포하지 않는다.

## SSR와 날짜

- `useFetch`의 고정 key/`server:true`/`dedupe:'defer'`를 사용한다. 정상 빈 배열을 포함해 SSR payload를 재사용하며 마운트 때 무조건 다시 조회하지 않는다.
- 서버가 `asOf`와 `daysLeft`를 응답에 넣는다. 최초 HTML과 hydration은 같은 값으로 D-DAY 또는 D-N을 표시한다.
- 한국·일본은 UTC+9다. 서울 날짜로 기준일을 정하고, 날짜 전용 값의 UTC 자정 간 차이를 86,400,000으로 나눠 DST/브라우저 현지 시간대 영향을 피한다.
- 탐색 탭이 활성화되고 문서가 보일 때만 오래된 데이터(3분)나 날짜 변경을 확인해 갱신한다. 5분 유효한 포스터 URL이 전체 탭 대기 중 만료되는 경우도 고려한다. 오래된 이미지 실패의 복구 조회는 분당 최대 한 번이며 카드마다 반복하지 않는다.

## 캐러셀과 디자인

- 기존 Embla Carousel Vue 8.6.0을 사용한다. align start, slidesToScroll 1, loop false, containScroll trimSnaps이며 기존 패키지 외 의존성을 추가하지 않는다.
- 768px 이상은 2장과 16px 간격, 카드 비율 3:2다. 모바일은 1장과 앱의 대형 카드에 가까운 5:4 비율이다. 콘텐츠 폭은 기존 플레이스의 최대 826px을 따른다.
- 포스터 전체 배경, 어두운 하단 그라데이션, D-day → 제목 → 기간 순서의 흰색 텍스트, radius 16px을 사용한다.
- 기본 슬라이드는 부드럽게 이동하고 reduced-motion에서는 화살표 이동을 즉시 처리한다. 좌우 화살표/방향키/터치 스와이프를 지원하고 끝에서 반복하지 않는다.
- 부모가 v-show를 사용하므로 탐색 탭을 열고 nextTick 후 reInit하여 숨겨진 패널의 0px 폭을 재사용하지 않는다. 선택과 reInit 이벤트에서 화살표 상태를 갱신한다.
- 상세 링크는 기존 `/places/{publicId}`이며 상세 페이지를 수정하지 않는다.

## 확인 이력

- 2026-10-26 기존 공개 API 1회 조회로 포스터가 있는 실제 7개(한국 6, 일본 1)를 확인했다. 종료일은 10월 27일/28일/29일, 같은 날짜 기준 D-1/D-2/D-3이다.
- 순서, publicId 중복, 진행 전·종료·5일 초과 제외, D-DAY/D-1/D-3, UTC+9 자정, 연말과 윤년, 잘못된 날짜/페이지 응답 거부를 메모리에서 검증했다. 테스트용 데이터는 제품 UI에 넣지 않았다.
- `npm run typecheck`, `npm run build` 통과. 빌드 중 공유 유틸 상대 경로 해석 오류는 컴포넌트의 import를 Nuxt `#shared` 별칭으로 변경해 해결했다.
- 빌드 산출물의 Nitro 로컬 렌더러로 `/places` HTML을 생성해 실제 API 스냅샷의 7개 카드와 D-day, SSR payload를 확인했다. 조회는 기존 백엔드 API에 대응하는 모의 응답 1회였다.
- 비표시 Chrome에서 실제 API 스냅샷과 빌드 HTML/JS/CSS를 사용했다. 외부 포스터는 모의 이미지로 대체하고 외부 네트워크 요청과 스크린샷 촬영은 하지 않았다.
- PC 실측: viewport 826px, 카드 405×270px, 간격 16px, 동시에 2개 표시. 모바일 실측: viewport/card 335px, 높이 268px(5:4), 한 장 표시, 페이지 가로 넘침 없음.
- 숨겨진 탭 전환 후 reInit, 좌우 화살표와 첫/마지막 경계, 네이티브 터치 스와이프, 각 publicId 상세 href를 확인했다. hydration 불일치·브라우저 미처리 예외가 없었고 초기 브라우저 API 중복 요청은 0회였다. 실제 상세 화면 내용이나 실제 포스터 화질을 검증한 결과는 아니다.
