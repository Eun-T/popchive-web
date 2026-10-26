# POPCHIVE 공개 웹 SEO 및 동적 Sitemap

구현·검증일: 2026-10-26. 대표 도메인 `https://popchive.com`, 사이트명 `팝카이브 (POPCHIVE)`, HTML 언어 `ko`.

## 페이지 메타데이터

공통 설정은 `shared/utils/seo.ts`, `app/composables/usePopchiveSeo.ts`, `app/app.vue`에 있다. Nuxt의 `useSeoMeta`와 `useHead`를 사용하며 UI·스타일·레이아웃은 변경하지 않는다.

| 페이지 | title | description |
| --- | --- | --- |
| `/` | 팝카이브 - 글로벌 팝업스토어 정보 | 한국과 일본의 팝업스토어 정보를 한곳에서 만나보세요. 지금 인기 있는 팝업부터 새롭게 열리는 팝업까지 팝카이브에서 확인하세요. |
| `/places` | 팝업스토어 찾기 \| 팝카이브 | 성수, 홍대, 강남, 도쿄 등 한국과 일본의 다양한 팝업스토어를 지역과 관심 분야별로 탐색해 보세요. |
| `/map` | 팝업스토어 지도 \| 팝카이브 | 지도에서 주변 팝업스토어의 위치와 운영 정보를 확인하고 방문하고 싶은 팝업을 찾아보세요. |
| `/places/{publicId}` | 실제 팝업 이름 \| 팝카이브 | 같은 SSR 상세 응답의 소개 `summary` 기반. 이름·지역 또는 주소·운영 기간을 가능한 범위에서 보완하며 최대 160자. |

- OG title·description·url·site_name·locale·type과 Twitter Card를 설정한다. 기존 상세 title과 지도 title을 공통 도우미로 통일해 태그 중복을 막는다.
- canonical·og:url은 항상 대표 도메인의 절대 URL이며 쿼리와 마지막 슬래시를 정규화한다. www 접속도 같은 canonical을 사용한다. 실제 www HTTP 리디렉션은 Vercel/DNS 운영 설정이며 이번에 변경하지 않았다.
- 필터·검색 쿼리는 별도 Sitemap URL을 만들지 않고 기본 페이지로 canonical을 통일한다. canonical 통합을 위해 정상 운영 페이지에 일괄 noindex를 붙이지 않는다.
- 기본 OG 이미지는 만들지 않는다. 상세에 유효한 실제 대표 이미지가 있으면 OG·Twitter 이미지로 사용하고, 없으면 이미지 태그를 생략하며 Twitter는 `summary` 카드로 처리한다.
- 이미지 URL은 HTTP(S)·호스트·인증 정보 유무를 검증하며 상대 경로는 대표 도메인의 절대 URL로 변환한다. 이미지 검증을 위해 HEAD나 추가 API를 호출하지 않는다.
- 상세는 기존 `GET /api/popups/{id}` 응답을 await해 첫 SSR HTML에 메타데이터를 포함한다. 소개 HTML은 텍스트로 정리하고 알려진 HTML 엔티티·숫자 엔티티를 처리한다. 태그 속성 인코딩은 Unhead가 수행하며 `v-html`을 사용하지 않는다.
- 기존 API의 `languageCode=ko` 정책을 유지한다. 원문 일본어가 반환되는 경우 그대로 사용하며 존재하지 않는 일본어 경로나 hreflang을 만들지 않는다.

## 오류·개발·Preview 색인 정책

`server/middleware/seo.ts`는 실제 Host와 `VERCEL_ENV`를 확인한다. `popchive.com`과 `www.popchive.com`에서만 색인을 허용하며 `VERCEL_ENV=preview|development`는 production Host가 있어도 색인을 허용하지 않는다. 이 판정은 Nuxt payload의 상태로 공유해 Hydration에서 바뀌지 않는다.

- Vercel Preview·localhost·다른 호스트: HTML robots `noindex, nofollow`와 HTTP `X-Robots-Tag`.
- `/design`, 목업 상세 및 공개 페이지 목록 밖의 개발·테스트 경로: noindex. robots.txt 차단만으로 대체하지 않는다.
- 존재하지 않는 상세와 목업 ID: 기존 오류 UI를 유지하면서 HTTP 404, noindex.
- 상세 API 일시 장애·잘못된 응답: 기존 오류 UI를 유지하면서 HTTP 503, noindex, Retry-After 60초.
- 실제로 공개된 종료 팝업은 보관 페이지로 유지하며 종료 날짜만으로 noindex하거나 Sitemap에서 제외하지 않는다.

## 전체 공개 데이터 계약

기존 `PublicPopupController.browse/list`, `PublicPopupService.list`, `PublicPopupMapper.popupListQuery`를 읽기 전용으로 조사했다.

- `GET /api/popups?languageCode=ko`에 limit·cursor·상태·국가·기간을 지정하지 않으면 **페이지 제한 없는 전체 공개 POPUP 목록**을 반환한다. 조건 없는 목록 SQL에는 LIMIT이 없다.
- 기본 전체 탭의 `limit=10` 커서 API는 기본적으로 종료 팝업을 제외하므로 Sitemap 전체 소스로 사용하지 않는다.
- 무필터 공개 API는 한국·일본 및 진행·예정·종료 팝업을 모두 포함한다. 현재 백엔드에는 이 응답에 별도 공개 상태 플래그가 없으므로 기존 공개 읽기 계약을 기준으로 삼는다. 관리자 삭제는 실제 places 행 삭제이며 삭제 행은 목록에 나오지 않는다.
- 목록의 `publicId`가 상세 URL ID와 일치한다. 목록과 상세에 실제 수정일 필드가 없으므로 lastmod를 생성하지 않는다.
- 2026-10-26 실제 전체 조회 결과: 38개·고유 publicId 38개. 모든 상세 URL의 HTTP 200을 확인했다.

## 동적 Sitemap

`server/utils/publicSitemap.ts`와 Nitro 서버 라우트를 사용한다. 새 모듈·유료 서비스·백엔드 엔드포인트는 추가하지 않았다.

- 주소: `https://popchive.com/sitemap.xml`.
- 고정 `/`, `/places`, `/map` 3개와 실제 공개 상세 38개, 검증 시 총 **41개 URL**.
- API 순서와 무관하게 ID를 정렬하고 중복 제거한다. 쿼리·목업·개발 URL은 포함하지 않는다.
- 전체 목록 응답에 새 페이지네이션 필드가 생기거나 필수 ID가 잘못되면 503을 반환한다. 일부 목록을 전체인 것처럼 사용하지 않는다.
- Nitro 성공 결과를 300초 캐시한다. CDN s-maxage는 데이터의 남은 유효 시간만 설정해 서버 캐시와 CDN 캐시가 연달아 갱신 지연을 늘리지 않게 한다.
- 새 공개 팝업·삭제 내용은 다음 정상 갱신에 반영되며, 일반적으로 최대 약 5분의 캐시 지연이 있다. 별도의 코드 수정·배포·스케줄러가 필요 없다.
- 캐시 미적중 시 기존 전체 목록 API를 1회 호출한다. 개별 상세를 매번 조회하는 N+1 요청은 없다. Nitro 메모리 캐시는 함수 인스턴스별이며 CDN 캐시는 배포 환경의 정책에 따른다.
- API 장애나 계약 불일치 시 캐시가 만료된 뒤에는 `503`, `Cache-Control: no-store`, `Retry-After: 60`을 반환한다. 고정 3개만 남긴 불완전한 Sitemap을 성공 응답으로 반환하지 않는다. 유효 시간 안의 정상 스냅샷은 사용한다.
- 10,000개 URL을 넘으면 root가 sitemapindex로 바뀌고 `/sitemaps/1.xml` 등의 부분 Sitemap을 제공한다. 각 조각은 최대 10,000개로 프로토콜의 50,000개·50MB 제한 이내이며, 인덱스 한도를 초과하면 오류 처리한다.
- 초대형 데이터에서는 기존 무필터 API의 전체 응답 비용이 병목이 될 수 있다. 현재 38개에는 문제가 없으며 백엔드 변경은 하지 않았다.

## robots.txt

기존 정적 `public/robots.txt`를 같은 URL의 `server/routes/robots.txt.get.ts`로 교체했다. Vercel의 정적 파일이 동적 정책을 가리지 않도록 정적 파일을 제거했다.

- 운영: `User-agent: *`, `Allow: /`, `Sitemap: https://popchive.com/sitemap.xml`.
- Preview: 크롤러가 HTML noindex를 읽을 수 있도록 Allow를 유지하고 운영 Sitemap 안내를 생략한다. 응답과 HTML 모두 별도의 noindex 정책을 갖는다.
- 정책이 Host에 따라 달라지므로 robots.txt 응답은 no-store다.

## API 요청 영향

- 홈·플레이스·지도·상세의 SEO 메타데이터 자체는 추가 API 0회. 기존 SSR 데이터를 재사용한다.
- 상세는 소개·대표 이미지와 메타데이터를 위해 기존 상세 조회 1회만 수행한다. 별도 이미지 조회도 없다.
- Sitemap 요청만 전체 목록 API를 캐시 미적중 시 1회 추가한다. 루트와 부분 Sitemap은 같은 서버 캐시를 재사용한다.
- 기존 API·캐시·카드 디자인·필터 동작은 변경하지 않았다.

## 검증

- `npm run typecheck`, 기본 `npm run build`, `NITRO_PRESET=vercel` 빌드 통과. Vercel Build Output v3·nodejs22.x와 동적 robots/Sitemap 라우트 생성도 확인했다.
- 실제 로컬 프로덕션 HTTP에서 운영 Host를 명시해 홈·플레이스·지도 title/description/canonical/OG/Twitter 및 index를 확인했다. www·필터 쿼리는 같은 대표 canonical이었다.
- 실제 상세 3개는 SSR title·소개 기반 description·실제 OG 대표 이미지가 각각 달랐고 중복 메타 태그가 없었다. 이미지 URL은 응답마다 서명이 바뀔 수 있으므로 같은 실제 이미지 호스트·경로인지 비교했다.
- Sitemap HTTP 200, .NET XML 파서의 문법·네임스페이스 확인, 41개 URL 중복 없음, 전체 공개 ID 포함 및 상세 38개 접근을 확인했다.
- 404 상세·목업 상세, `/design`, Preview Host noindex를 확인했다. 별도 프로세스에서 `VERCEL_ENV=preview`도 확인했다.
- 계약 응답으로 10,002개 팝업+고정 3개를 10,000/5로 분할하고 ID 중복 제거·루트/부분 간 API 1회 재사용을 확인했다. 장애·페이지 응답의 503 및 상세 장애의 503, 특수문자·이미지 없는 상세도 검증했다.
- 실제 SSR 응답을 재사용하는 비표시 브라우저에서 홈·플레이스·상세 Hydration, 초기 중복 API 0회, 클라이언트 이동 시 메타 갱신과 상세 OG 이미지 제거를 확인했다. Hydration mismatch·미처리 예외는 없었다. 지도·이미지 외부 요청과 스크린샷 촬영은 하지 않았다.
- 실제 배포·Search Console 등록·DNS 변경은 수행하지 않았다.

## 남은 한계와 배포 후 확인

- 대표 이미지는 기존 API가 발급하는 만료 가능한 서명 URL이다. SSR 응답 시 실제 유효한 이미지 URL을 사용하지만 소셜 서비스가 오래 캐시한 이미지 URL의 재사용은 보장할 수 없다. 안정적인 영구 공개 이미지 URL이 향후 제공되면 동일 필드로 교체할 수 있다. 이번에 저장·재배포·새 이미지 프록시는 도입하지 않았다.
- 기본 OG 이미지가 없으므로 일반 페이지와 이미지 없는 상세는 이미지 메타를 생략한다.
- canonical은 중복 URL의 대표를 알리는 정책이다. www 리디렉션·실제 색인 여부·Google의 대표 URL 채택은 배포 후 확인해야 한다.
- Sitemap의 신규/삭제 반영은 캐시 유효 시간 동안 지연될 수 있다. API 공개 정책이 바뀌면 이 계약도 재검증해야 한다.

## Google Search Console 등록

배포 후 Search Console에서 `popchive.com` 도메인 속성을 추가하고 제공된 TXT 레코드로 소유권을 확인한다. 기존 API DNS 레코드는 유지한다. Sitemaps 메뉴에 `https://popchive.com/sitemap.xml`을 제출하고 홈·서로 다른 상세 URL을 URL 검사로 확인한다. 제출 자체가 즉시 색인을 보장하지는 않는다.

공식 참고: [Nuxt useSeoMeta](https://nuxt.com/docs/4.x/api/composables/use-seo-meta), [canonical](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [Sitemap 프로토콜](https://www.sitemaps.org/protocol.html), [소유권 확인](https://support.google.com/webmasters/answer/9008080), [Sitemaps 보고서](https://support.google.com/webmasters/answer/7451001).
