# /places SSR 페이지네이션·커서 비용·필터 SEO 점검

## 후속 확정 정책 A — 적용됨

- 아래 본문은 적용 전 조사 기록이다. 필터 index·canonical 통합·정책 유보에 대한 당시 설명보다 이 절과 현재 코드가 우선한다.
- 정상 운영 `/places`, `page=1`, `page=2` 등의 일반 번호 페이지는 index,follow를 유지한다. page=1 canonical은 `/places`, 이후는 각 페이지의 self-canonical이다.
- `regionIds`, `tagIds`, `tagId`, `status`, 운영/오픈 날짜 필드가 있는 URL과 `sort=START_DATE_ASC|END_DATE_ASC`는 page 값과 무관하게 noindex,follow다. 기본 sort=LATEST·tab=all은 단독으로 필터가 아니다.
- tab=explore는 page 미지정 시 실제 탐색 탭을 표시하므로 noindex,follow다. 명시적 page가 있으면 기존 화면 코드가 All을 선택하므로 tab=explore만으로 필터 분류하지 않는다. tab=all은 tagId 단축 조건을 활성화하는 경우 canonical에 보존한다.
- `/places?q=...`는 현재 검색 조건이 아니므로 새 검색 기능이나 필터로 간주하지 않는다. 기존 `/search?q=...`의 noindex,nofollow는 유지했다. 국가 KR 고정과 알 수 없는 sort/tab의 기존 무시 동작도 변경하지 않았다.
- 필터 canonical은 해당 조건과 유효한 page(2 이상)를 보존한 자기 URL이다. 기본값·알 수 없는/추적 query는 제외하며 query 키 순서를 고정한다. 콘텐츠가 다른 일반 목록으로 대표를 지정하지 않는다. noindex가 색인 제외를 담당하고 canonical은 같은 필터 URL 표현의 정규화에만 사용한다. OG URL도 같은 헬퍼 결과를 사용한다.
- `shared/utils/placesSeo.ts`가 URL 분류와 필터 canonical query를 공통 처리한다. usePopchiveSeo에 선택적 nofollow를 추가했으며, 옵션 미지정 기존 noindex 호출은 noindex,nofollow를 유지한다. 운영 호스트 밖·Preview·목록 오류의 기존 제한이 필터 follow 설정보다 우선한다.
- canonical 태그를 페이지에 추가 선언하지 않고 기존 전역 key=canonical을 유지한다. robots.txt·사이트맵·API·커서 공유·SSR·카드·상세 페이지는 수정하지 않았다.
- 정적 검토와 git diff --check만 수행했다. 실제 head 중복·SSR 응답·클라이언트 이동 시 robots 전환·Preview·오류 상태는 미검증이다.

| URL 예시 | 정상 운영 robots | canonical 경로 |
| --- | --- | --- |
| `/places?page=2` | index,follow | `/places?page=2` |
| `/places?page=1&sort=LATEST&tab=all` | index,follow | `/places` |
| `/places?tagIds=1&page=2` | noindex,follow | `/places?tagIds=1&page=2` |
| `/places?sort=END_DATE_ASC&page=2` | noindex,follow | `/places?sort=END_DATE_ASC&page=2` |
| `/places?tab=explore` | noindex,follow | `/places?tab=explore` |
| `/places?tab=explore&page=2` | index,follow | `/places?page=2` |
| `/places?tab=all&tagId=1` | noindex,follow | `/places?tab=all&tagId=1` |

작성: 2026-11-05. 저장소 정적 분석과 Google/Vercel 공식 문서 확인만 수행했다. 운영 HTTP·API 호출·성능 측정·브라우저·빌드·테스트·서버 실행·배포는 하지 않았다. 이전 작업의 미커밋 변경은 보존했다.

## 1. SSR 페이지네이션 SEO 점검

### 정상인 구현 — 코드 기준

| URL | 시작 데이터 | canonical / OG URL |
| --- | --- | --- |
| `/places` | 첫 12개 | `https://theplave.co.kr/places` |
| `/places?page=1` | 첫 12개 | `https://theplave.co.kr/places` |
| `/places?page=2` | 첫 응답의 nextCursor로 조회한 두 번째 묶음 | `https://theplave.co.kr/places?page=2` |
| `/places?page=3` | 두 커서를 따라 조회한 세 번째 묶음 | `https://theplave.co.kr/places?page=3` |

- `usePlacesBrowse`는 필터·정렬·페이지 번호를 포함한 key로 `useAsyncData(server: true)`를 호출하고, `places.vue`가 ready를 await한다. 카드 제목과 `/places/{publicId}` NuxtLink가 서버 템플릿에 있다. page=2를 첫 페이지 응답으로 대체하지 않는다.
- 초기 SSR 결과는 Nuxt payload에서 재사용하는 구성이다. 목록에 별도의 onMounted 최초 재조회가 없다. 다만 IntersectionObserver가 화면 하단을 감지해 다음 묶음을 불러오는 것은 정상 추가 요청이다.
- 이전·다음은 감추지 않은 NuxtLink이며 prefetch는 끈다. 첫 페이지에 이전 링크가 없고, SSR 시작 묶음에 nextCursor가 없으면 다음 링크가 없다. 링크는 무한 스크롤의 누적 카드 수가 아닌 현재 URL을 기준으로 한다.
- 추가 카드는 ID로 중복 제거하고, 요청 세대·key·AbortController로 늦은 응답 혼입을 막는다. URL query 변경 시 페이지를 다시 구성하며 필터·정렬을 URL에서 복원한다. UI 필터 변경 시 page를 제거한다.
- 정상 공개 운영 페이지는 index, 오류는 noindex다. 잘못된 page는 400, 범위를 벗어난 실제 묶음은 404, 일시 장애는 HTML 503/noindex다. page=1은 canonical 정규화이며 HTTP 리다이렉트는 아니다.
- title은 1페이지 `팝업스토어 모아보기 | THE PLAVE`, 이후 `팝업스토어 모아보기 - N페이지 | THE PLAVE`다. description은 공통 설명을 재사용한다. Google은 페이지네이션에서 같은 title/description 사용도 허용하므로 설명 중복만으로 오류라고 보지 않는다.
- canonical 선언은 app.vue의 key=canonical 한 곳이다. 기본 app 메타와 페이지 useSeoMeta는 동일 메타 key로 덮어쓰는 구성이다. 중복 태그의 실제 출력 개수는 HTTP를 조회하지 않아 미확인이다.
- `/places` 전용 JSON-LD는 없다. 홈 WebSite·장소 BreadcrumbList를 목록에 중복 추가하지 않았다. 기존 사이트맵은 `/places`, 공개 팝업 상세, 장소 URL을 포함하며 번호·필터 URL을 추가하지 않는다.
- canonical의 page 처리 분기는 `/places`에 한정되어 다른 페이지 URL 정책과 충돌하는 코드는 발견하지 못했다.

### 발견한 문제와 남은 위험

- 기존 20초 순회 예산은 첫 getPlacesPage 호출 이후부터 측정했고 마지막 응답 이후 검사가 없었다. 이번에 첫 호출 전부터 측정하고 각 응답 이후도 검사한다. 진행 중인 10초 upstream 요청을 강제로 중단하는 전체 hard timeout은 아니다.
- query 전체를 페이지 key로 사용하고 필터 변경을 router.replace로 반영하므로, 필터 변경 직후의 반응형 요청과 remount 요청이 겹칠 가능성이 있다. 서버 캐시는 비용을 완화하지만 프런트 요청 0회 중복을 정적으로 보장하지 않는다. history·focus·scroll 복원 역시 실브라우저 미검증이다.
- 번호 링크는 100페이지까지다. 실제 데이터가 1,200개를 넘으면 무한 스크롤은 이어질 수 있어도 번호 링크 체인은 그 이후를 안내하지 않는다. 상세 사이트맵은 독립적으로 유지된다.
- 목록 변경은 번호별 묶음을 바꿀 수 있다. 커서 및 캐시는 DB 스냅샷을 제공하지 않는다.
- 필터 페이지는 현재 index이며 canonical은 필터를 제외한 같은 번호로 향한다. 콘텐츠가 다른 일반 페이지와의 대표 URL 불일치, 대응 일반 페이지의 부재(404) 가능성이 있다. 이번에 정책을 변경하지 않았다.
- 알 수 없는 query도 링크에 남거나 페이지 remount를 유발할 수 있다. parameter 정규화·크롤링 범위는 후속 정책 대상으로 남긴다.

## 2. 커서 순회 비용과 구현

### 기존 캐시를 먼저 확인한 결과

- 백엔드는 `limit=12`와 nextCursor를 사용한다. page/size 기반 임의 접근은 없다.
- `getPlacesPage`는 API Base URL·전체 query·한국 날짜를 인자로 30초, swr=false 캐시를 사용한다. 설치된 Nitro 2.13.5의 defineCachedFunction은 pending[key]로 동일 소스 조회를 이미 합친다.
- Vercel 설정은 Nuxt Node SSR preset·icn1이다. Nuxt 설정에 공개 목록 캐시용 공유 storage 설정은 없다. 문서도 함수 인스턴스별 메모리 캐시를 설명한다. 실제 Vercel 대시보드·Fluid 활성 상태·warm hit율·Functions 생명주기는 미확인이다.

### 이번 수정

- `server/utils/numberedPlaces.ts`가 동일 번호 페이지의 진행 중인 전체 순회를 공유한다. 키는 apiBase·asOf·ko·페이지·정규화된 모든 query(필터·정렬·limit)를 포함하고 키 순서를 정렬한다. API 검증 후 전달하므로 ID 목록도 기존 정규화를 거친다.
- Promise만 최대 64개 저장한다. 성공·실패 모두 finally에서 제거한다. 64개를 넘는 다른 키는 기존 순회로 처리하며, 이 제한 때문에 정상 요청을 거부하지 않는다. 무한 스크롤의 cursor 요청은 기존 경로를 그대로 사용한다.
- 결과·시작 커서·오류를 별도로 장기 보관하지 않는다. 추가 TTL이나 SWR, stale fallback, 영구 타이머는 없다. 날짜/필터/정렬이 바뀌면 다른 키다. 실패 응답을 정상 빈 목록으로 바꾸지 않는다.
- 새 팝업·삭제·정렬 변경으로 오래된 체크포인트가 남는 위험을 추가하지 않았다. 기존 30초 소스 캐시의 일시적 지연과 서로 다른 시점의 페이지 혼합 위험은 남는다.
- 로컬 백엔드 커서는 생성일/날짜·ID·정렬 버전을 담고 있고 명시적인 시간 만료 필드는 확인되지 않는다. 데이터 변경과 커서 계약 변경은 별개이며, 후자 오류는 전파한다. TTL 만료 후 기존 소스 경로로 다시 조회한다.

### 호출 횟수 — 측정치가 아닌 코드상 조건부 분석

대상은 목록 API만이며 옵션·사이드바 요청은 제외한다. 모든 페이지가 존재하고 오류/예산 초과가 없다는 조건이다.

| 요청 조건 | 기존 백엔드 호출 | 이번 변경 후 백엔드 호출 | 차이 |
| --- | --- | --- | --- |
| 동일 조건 page=10, 전부 cold | 최대 10 | 최대 10 | cold 임의 접근 비용은 해결하지 못함 |
| 동일 인스턴스에서 1~10 소스 캐시 전부 유효 | 0 | 0 | 기존 캐시가 이미 해결 |
| 1~9 캐시 유효, 첫 page=10 | 보통 1 | 보통 1 | 동일 nextCursor가 이어지는 조건 |
| page=10 동일 키 동시 M개, 소스 cold | 기존 소스 single-flight로 보통 총 10 | 전체 순회 하나로 총 최대 10 | 백엔드 수 감소를 주장하지 않음. 중복 Nitro 캐시 순회·배열 검사를 줄임 |
| 일부 캐시 만료/목록 변경 | 실제 접근 중 미스 난 수, 최대 10 | 동일 | 인스턴스·캐시·데이터 변화에 좌우 |
| 서로 다른 cold 인스턴스 K개 | 최대 10×K | 최대 10×K | 인스턴스 간 공유하지 않음 |

동일 TTL 안의 체크포인트는 이미 유효한 소스 캐시의 순회를 단축할 뿐 백엔드 호출 감소가 보장되지 않는다. TTL을 늘리면 페이지 번호와 데이터의 대응이 더 오래 틀어질 수 있다. 따라서 별도 결과/체크포인트 캐시는 도입하지 않았다. 추후 실제 trace로 소스 hit/miss·인스턴스·요청 수를 측정한 뒤 판단한다. 인증용 Redis를 공개 목록 캐시에 임의로 재사용하지 않는다.

## 3. 실제 필터와 SEO A/B

| 항목 | 실제 사용 | 현재 정책/비고 |
| --- | --- | --- |
| 국가 | 웹 목록 KR 고정. 중계 API countryCode=KR/JP 지원 | 브라우저 countryCode query로 JP 목록이 되지 않음 |
| 지역 | regionIds: 쉼표로 구분한 ID | 필터 state·링크·SSR 복원 |
| 카테고리 | tagIds: ID 목록 | 동일. tagId는 tab=all일 때 알려진 카테고리의 단일 단축키 |
| 상태 | status=ONGOING/UPCOMING/ENDED | 기본 종료 제외, 명시 상태는 기존 계약 |
| 정렬 | sort=LATEST/START_DATE_ASC/END_DATE_ASC | 기본 LATEST. 기본값과 다른 정렬은 링크에 포함 |
| 운영 기간 | operatingFrom / operatingTo | 유효한 날짜 쌍. UI 프리셋도 날짜로 URL 반영 |
| 오픈 기간 | openingFrom / openingTo | URL 전용 조건. 잘못된 쌍은 API 요청 전 오류 |
| 탭 | tab=all/explore | 보기 상태이며 독립 SEO 랜딩이 아님 |
| 페이지 | page=1~100 | 일반 페이지네이션. 필터와 구분해야 함 |
| 검색 | `/search?q=...` | 기존 noindex. `/places?q=...`에는 검색 동작 없음 |
| API 전용 | cursor / limit=12 | 브라우저 목록의 공개 번호 URL과 별도. 임의 page+cursor 병용 금지 |
| 언어 | 서버 중계 languageCode=ko 고정 | 일본 장소와 일본어 페이지를 동일시하지 않음 |

| 정책 | 장점 | 비용/위험 |
| --- | --- | --- |
| A: 일반 목록/번호 페이지 index, 의미 있는 필터·대체 정렬 noindex | 조합별 얇은 검색 결과·중복 노출 관리, 운영 부담이 작음 | 필터 롱테일 유입을 포기. noindex를 읽기 위한 크롤링 비용은 계속 발생 |
| B: 필터도 개별 index | 지역·카테고리·기간별 검색 수요를 받을 가능성 | 조합 폭증·짧은 수명·빈 목록·중복·추가 커서 조회. 고유 title/설명·대표 URL·품질 관리가 필요 |

권장 후보는 A다. `page`만 있는 URL과 기본값 LATEST·KR·tab 같은 동등 URL을 무조건 필터로 분류하면 안 된다. 검색 q는 실제 검색 경로에서만 판정한다. 장기적으로 가치가 확인된 지역/장소는 검증된 고유 콘텐츠를 가진 제한된 SEO 랜딩으로 별도 운영할 수 있다. 모든 조합을 랜딩으로 생성하지 않는다.

### 세 신호의 차이와 적용 유보

- noindex: 검색 결과 제외 지시. 접근 가능해야 읽힌다. 크롤링 차단 수단이 아니다.
- robots.txt Disallow: 수집 제한. noindex를 읽지 못하게 하며 URL 자체의 검색 노출 제외를 보장하지 않는다.
- canonical: 중복·유사 페이지의 대표 URL 선호 신호. 강제 색인 제외도 수집 금지도 아니다.
- Google은 필터가 필요 없으면 크롤링 제한도 권장하지만, 일반 페이지네이션·상세 발견과 기존 색인 정리를 고려해야 한다. A를 선택해 noindex부터 적용한다면 같은 URL을 Disallow로 동시에 막지 않는 것이 적절하다.
- 현재 usePopchiveSeo의 noindex=true는 noindex,nofollow다. 향후 필터용 noindex,follow를 원하면 기존 오류/Preview 정책을 깨지 않는 별도 옵션 또는 정책 구분이 필요하다. 단순히 모든 필터에 현재 옵션을 붙이는 변경을 권하지 않는다.
- 향후 적용 후보 파일: `shared/utils/seo.ts` 또는 별도 필터 분류 유틸, `app/pages/places.vue`, `app/composables/usePopchiveSeo.ts`. canonical 변경 여부도 별도로 확정해야 한다. header 정책을 통일할 때만 `server/middleware/seo.ts`를 검토한다. robots/sitemap은 자동 변경 대상이 아니다.
- 일반 SSR 번호 링크·홈/장소 링크·전체 공개 팝업 상세 사이트맵을 유지하면 필터 페이지에만 의존하지 않는 발견 경로가 남는다. noindex 페이지를 장기적인 유일한 링크 발견 경로로 사용하지 않는다.
- 이번에는 필터 robots/meta/canonical/사이트맵을 변경하지 않았다.

## 4. 배포 전 확인 및 근거

운영/승인된 검증 환경에서 확인할 항목: 네 URL의 실제 카드 묶음·중복 meta 개수·canonical·OG·상태 코드, 마지막/없는 페이지, hydration 최초 중복 조회와 observer 추가 조회 구분, 필터 변경/뒤로/앞으로, 같은/다른 인스턴스의 cold/warm 호출 수, TTL 경계·등록/삭제/정렬 변경·장애·동시 요청이다. 이번에는 실행하지 않았다.

공식 근거:

- [Google 페이지네이션](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading): 실제 href, 페이지별 URL/canonical, 공유 description 허용.
- [Google 필터 탐색](https://developers.google.com/crawling/docs/faceted-navigation): 조합 URL의 크롤링 비용, 수집 허용/차단 선택.
- [Google noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing): robots 차단 시 noindex를 읽지 못함.
- [Google canonical](https://developers.google.com/search/docs/crawling-indexing/canonicalization): 대표 URL은 선호 신호이며 최종 선택은 검색엔진이 수행.
- [Vercel Functions](https://vercel.com/docs/functions), [Fluid compute](https://vercel.com/docs/fluid-compute): 인스턴스 재사용/동시 처리 가능성과 수명 제한. 현재 프로젝트에서의 실제 동작은 별도 확인 필요.

Nitro 동작은 최신 문서의 다른 버전 API를 적용하지 않고 설치된 `node_modules/nitropack/dist/runtime/internal/cache.mjs`를 읽어 확인했다.
