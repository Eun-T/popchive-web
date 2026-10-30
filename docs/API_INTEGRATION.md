# 홈 API 연동

## 팝업 상세 블로그 후기 — 1차 구현

- `app/components/places/PopupBlogReviews.vue`가 상세페이지 추천 영역 다음에 독립적으로 연결된다. 기존 방문 리뷰 탭과 추천은 유지하며 클라이언트에서만 조회하여 상세 SSR을 지연시키지 않는다.
- `GET /api/blog-reviews?publicId=...`는 ID만 받는다. 서버는 기존 Nuxt `/api/popups/:id`에서 확인한 `name` 원문만 검색어로 전달한다. 제목을 정리·축약하거나 지역·장소·후기 키워드를 추가하지 않는다. 지역·장소는 기존 관련성 필터에만 사용한다. 브라우저가 보낸 임의 검색어나 URL은 사용하지 않는다. Spring·DB·기존 공개 API 계약은 변경하지 않는다.
- `nuxt.config.ts`의 서버 전용 `naverClientId`, `naverClientSecret`에 대응하는 `NUXT_NAVER_CLIENT_ID`, `NUXT_NAVER_CLIENT_SECRET`을 로컬 `.env` 또는 배포 서버 환경에 설정한다. 환경변수 이름은 유지하며 NAVER API HUB에서 발급한 Client ID·Client Secret을 사용한다. `public` 설정·클라이언트 코드에 넣지 않는다. 실제 키는 커밋하지 않는다. 네이버 클라우드 콘솔의 NAVER API HUB 애플리케이션에서 Blog API 사용 권한이 필요하다. 로컬 설정 후 개발 서버를 재시작한다.
- 키가 하나라도 없으면 추가 상세 조회와 네이버 호출 없이 빈 목록을 반환한다. 빈 결과·오류·로딩 중에는 후기 섹션을 표시하지 않는다. 가짜 데이터는 없다.
- `GET https://naverapihub.apigw.ntruss.com/search/v1/blog`에 `display=30`, `start=1`, `sort=sim`, `format=json`으로 한 번 조회한다. Client ID는 `X-NCP-APIGW-API-KEY-ID`, Client Secret은 `X-NCP-APIGW-API-KEY` 헤더로만 전달한다. 구 개발자 센터의 `openapi.naver.com` 및 `X-Naver-Client-*` 방식은 사용하지 않는다. timeout 5초, 자동 재시도 없음. 사용자 Cookie·Authorization은 전달하지 않는다. 클라이언트 요청 timeout은 18초다.
- 제목에서 일반적인 팝업 관련 단어를 제외한 2자 이상 고유 단어가 **모두** 제목·요약에 있어야 하며, 지역·장소 단어도 하나 이상 일치해야 한다. 식별 가능한 이름이나 장소가 없으면 검색하지 않는다. 관련성이 낮은 결과를 채우기 위한 추가 검색은 하지 않는다. 보수적인 문자열 일치이므로 축약명·별칭·일부 외국어 표기는 누락될 수 있다. 같은 브랜드의 재개최나 광고성 글까지 정확히 구분하거나 실제 방문 여부를 보증하지는 않는다.
- 네이버 블로그 도메인의 개별 글 URL만 허용하고 모바일/PC URL과 추적 쿼리를 정규화하여 중복 제거한다. 올바른 작성일을 가진 최대 3개만 반환한다. 제목·요약의 태그를 제거하고 숫자 엔티티 및 일반적인 이름 엔티티를 디코딩한다. 미지원 이름 엔티티는 문자 그대로 남긴다. Vue 텍스트 보간만 사용하며 `v-html`은 사용하지 않는다.
- 반환 타입은 `shared/types/blogReviews.ts`의 `{ items: [{ title, description, publishedAt, url }] }`다. 제목 한 줄·요약 두 줄·작성일·원문 링크를 표시하고, 검색 결과이며 실제 방문 여부는 확인되지 않았다고 안내한다. 대표 이미지·전체보기·새 방문 리뷰 기능은 미구현이다.
- 정상/빈 검색 결과는 Nitro `defineCachedFunction`으로 1시간 캐싱한다. 키는 API Base URL·publicId·언어이며 비밀키는 포함하지 않는다. 만료된 응답 재사용은 없다. 오류는 성공 캐시에 저장하지 않고 인스턴스별 60초 대기 시간을 적용한다. 동시 중복 요청을 합치며 진행 중 요청·오류 대기 맵은 각각 최대 200개로 제한한다. 브라우저 응답은 `no-store`다. 서버리스 인스턴스 간 캐시 공유·일일 총량 보장은 별도 저장소/호스팅 구성에 따라 달라진다.
- 공식 문서: [API HUB 블로그 검색](https://api.ncloud-docs.com/docs/naver-api-hub-search-blog), [공통 인증](https://api.ncloud-docs.com/docs/naver-api-hub-overview). 공식 검색 명세의 하루 호출 한도는 25,000회이며 콘솔의 이용 한도도 확인한다. `title`·`description`에는 강조 태그가 포함될 수 있으며 `postdate`는 YYYYMMDD 예시를 기준으로 검증한다. 검색 결과는 검증된 방문 후기가 아니다.
- 실제 관련성·원문 이동·빈 결과/오류 숨김·모바일 표시는 별도 확인이 필요하다. 아래 1차 구현 검증은 API HUB 전환 이전의 기록이다.
- 1차 구현 검증: `git diff --check` 통과, `npm run build` 통과. `npm run typecheck`는 수정하지 않은 `server/api/popups/[id]/[recommendation].get.ts`의 TS7022/TS7024와 `server/utils/todayPopups.ts`의 TS2591(`node:crypto`)로 실패했다. 이번 추가 파일에 대한 타입 오류는 보고되지 않았다. 해당 범위 밖 파일은 수정하지 않았다. 네이버 실호출·브라우저 확인·배포는 하지 않았다.
- API HUB 전환 검증(2026-10-29): 캐시를 우회한 메모리 내 진단에서 현재 `blogReviews.ts`의 요청·필터 함수를 사용해 API HUB를 정확히 1회 호출했다. 실제 팝업 `fb792624-d2c4-11f1-8f12-1258b46d816b`(듄: 파트 3 팝업) 기준 HTTP 200, 필터 전 0개·필터 후 0개·최종 반환 0개였다. 인증 성공을 확인했으며, 이 검색은 원결과가 없어 필터 정확도나 실제 화면의 카드 표시는 검증하지 못했다. 인증정보는 출력하지 않았다. TypeScript 검사는 위와 동일한 범위 밖 파일의 오류로 실패했다.

- API HUB 전환 후 `npm run build`와 `git diff --check`는 통과했다. UI·환경변수 이름·검색어 생성·필터·중복 제거·최대 3개·1시간 캐시는 유지했다. commit/push·배포는 하지 않았다.
- 이후 제목 단독 검색으로 변경했다. 기존 조합 검색의 빈 결과가 재사용되지 않도록 캐시 이름을 `popup-blog-reviews-v2`로 변경했으며 1시간 TTL·오류 대기·관련성 필터·중복 제거·UI는 유지한다. 위 API HUB 전환 검증은 변경 전 조합 검색의 기록이다.
- 제목 단독 검색 실호출 검증: 같은 팝업의 상세 API `name`인 `듄: 파트 3 팝업`과 검색어의 완전 일치를 확인했다. 캐시를 우회한 메모리 내 진단에서 현재 요청·필터 함수를 사용해 API HUB를 1회 호출하여 HTTP 200, 총 검색 결과 400개, 조회 30개, 기존 필터 통과 18개, 중복 제거 및 상한 적용 후 최종 3개를 확인했다. 인증정보는 출력하지 않았으며 브라우저 화면은 확인하지 않았다.

## 블로그 본문 썸네일 — 로컬 구현, 운영 배포 보류

- 최종 필터·중복 제거를 통과한 최대 3개 글만 `server/utils/blogReviewThumbnails.ts`로 조회한다. 원검색·정렬·텍스트 결과는 유지하며, 각 글의 실패는 `thumbnailUrl: null`로 처리한다. 기존 1시간 캐시에 URL/null을 함께 저장한다. 캐시 이름은 `popup-blog-reviews-v3`이며, 일시적 추출 실패도 해당 결과의 1시간 만료 후 재시도한다.
- 정규화된 공개 글 URL만 받아 `https://m.blog.naver.com/{blogId}/{logNo}`로 요청한다. 공개 SmartEditor HTML의 `se-main-container` 안 첫 `se-image-resource` 이미지에서 lazy/src 속성을 읽는다. OG 이미지나 블로그 프로필·로고로 대체하지 않는다. 허용 이미지 호스트는 실제 검증한 `mblogthumb-phinf.pstatic.net` 하나이며 HTTPS만 허용한다. 외부 이미지 바이너리는 서버가 다운로드·저장·프록시하지 않는다.
- DNS 결과 전체가 공개 IPv4인지 검사하며 사설·루프백·링크 로컬·메타데이터·특수 용도 주소를 거부한다. IPv6는 매핑 주소를 포함해 보수적으로 모두 거부한다(IPv6-only 환경은 텍스트 fallback). 검증한 IPv4를 HTTPS lookup에 고정하고 SNI/인증서 검증은 원래 호스트로 유지하며 공유 연결 풀은 사용하지 않아 DNS 재바인딩을 방지한다. 이미지 주소는 서버에서 요청하지 않으므로 브라우저 DNS 연결은 이 고정 대상이 아니다.
- 리다이렉트는 따르지 않는다. DNS를 포함한 전체 제한 2초, HTML 최대 1MiB, 압축 응답 거부 및 실제 수신 바이트 수 검사, 프로세스당 동시 요청 최대 3개를 적용한다. 포화 시 큐에 쌓지 않고 null을 반환한다. API 키·쿠키·사용자 인증정보는 게시글 요청에 보내지 않으며 HTML을 실행하지 않는다. 추가 패키지는 설치하지 않았다.
- 모바일/PC 모두 텍스트 오른쪽에 선택적으로 표시한다. PC 112×112px, 모바일 64~112px, cover/radius8, lazy, 빈 alt를 사용한다. 제목·미리보기는 각 최대 2줄, 날짜·원문 이동은 유지한다. `img` 로딩 실패 시 이미지를 제거하고 텍스트가 전체 폭을 사용한다. 이미지가 없다고 후기나 섹션을 삭제하지 않는다.
- 캐시 미스당 HTML 요청 최대 3회(병렬), 사용자 브라우저 이미지 요청 최대 3회가 추가된다. HTML 추출 단계는 최대 약 2초 지연될 수 있다. SmartEditor 클래스/마크업·이미지 CDN·공개 설정이 바뀌면 추출하지 못할 수 있으며 텍스트 fallback으로 처리한다. 본문 첫 이미지가 작성자가 지정한 대표 이미지와 같다는 보장은 없다.
- 기술적 접근/표시 성공은 이용 허락을 뜻하지 않는다. [네이버 이용약관](https://policy.naver.com/rules/service.html), [API HUB 약관 개정 안내](https://www.ncloud.com/support/notice/all/2243), [글별 CCL 설정](https://help.naver.com/service/5593/contents/15420?lang=ko)을 참고한다. 자동 수집·검색결과 가공·캐시 목적·외부 이미지 이용 권한을 확인해야 한다. 핫링크 정책·만료·삭제에 따라 언제든 표시 실패가 가능하다. Referer 위장·차단 우회·이미지 프록시는 사용하지 않는다.
- **외부 이미지 사용 권한 및 정책 적합성은 미확정이며 운영 배포는 보류한다.** 이번 구현과 검증은 로컬 개발 범위다. Spring·DB·기존 방문 리뷰·추천·상세페이지 구조는 변경하지 않는다.
- 로컬 검증(2026-10-29): 듄·아일릿 모두 실제 Nuxt API HTTP 200, 후기 3개·썸네일 URL 3개 추출. 브라우저에서 각각 이미지 3개 디코딩·표시 확인(PC 112×112, 모바일375px에서75×75, 가로 넘침 없음, cover/radius8/lazy/제목2줄). 진단 브라우저에서 이미지 CDN 요청을 차단해 이미지 0개·텍스트 카드 3개 유지도 확인했다.
- 메모리 내 보안 분기 검사에서 허용 호스트/경로, 사설·특수 IPv4 및 IPv6 거부, 비실행 본문 파싱, 이미지 허용 목록, 검증 IP 고정, 리다이렉트 거부, 선언/실수신 크기 제한, DNS 포함 시간 제한, 동시 요청 포화 fallback을 확인했다. 별도 테스트 파일은 추가하지 않았다. 빌드는 통과했고 TypeScript 검사는 기존 추천 API TS7022/TS7024 및 `todayPopups.ts`의 TS2591로 실패했다. 이번 5개 변경 파일에 대한 타입 오류는 보고되지 않았다. API 키 출력·commit/push·배포는 하지 않았다.

## 목차

1. [현재 연결](#현재-연결)
2. [요청과 응답 처리](#요청과-응답-처리)
3. [설정과 공개 캐시](#설정과-공개-캐시)
4. [S3 이미지 만료](#s3-이미지-만료)
5. [확인 결과와 한계](#확인-결과와-한계)

## 현재 연결

사전 계약은 [API_INTEGRATION_AUDIT.md](./API_INTEGRATION_AUDIT.md), 디자인 이력은 [DECISIONS.md](./DECISIONS.md)를 참고한다. 조사 보고서의 API 미연동 표기는 조사 당시의 상태다. 이번 작업은 공개 홈 세 섹션만 연결했으며 다른 기능은 구현하지 않았다.

| 홈 섹션 | Nuxt GET 경로 | 백엔드 GET 경로 |
| --- | --- | --- |
| 메인 캐러셀 | `/api/home/main-banners` | `/api/main-banners?languageCode=ko` |
| 새로 올라온 팝업 | `/api/home/new-popups` | `/api/popups?limit=10&countryCode=KR&languageCode=ko` |
| 지금 핫한 팝업 TOP 10 | `/api/home/now-hot` | `/api/home-curations/NOW_HOT?countryCode=KR&languageCode=ko` |

국가 기본값은KR, 표시 언어 기본값은ko다. 국가와 언어는 별도로 검증하며 Nuxt 경로에서는 국가KR/JP, 언어ko/ja만 허용한다. 홈 화면에는 국가·언어 전환 기능을 추가하지 않았다. 메인 배너 백엔드는 국가 필터를 지원하지 않아 전체 지정 배너를 반환한다.

신규는 최근 등록순 목록이며 주간 오픈 목록인 `homeNew=true`를 사용하지 않는다. NOW_HOT은 관리자가 지정한 배열 순서대로 표시하고 `index + 1`로 순위를 붙인다. 목록을 정렬하거나 부족한 카드를 복제하지 않는다.

## 요청과 응답 처리

### 일본 신상 팝업 — 2026-10-27 연결

- 목업 8개를 실제 데이터로 교체했다. Nuxt `/api/home/japan-new-popups?countryCode=JP&languageCode=ko` → 기존 백엔드 `GET /api/popups?countryCode=JP&languageCode=ko`를 사용한다.
- 백엔드 `PublicPopupController.browse`의 limit/cursor 없는 목록 분기 → `PublicPopupService.list` → `PublicPopupMapper.xml`의 `list`/`popupListQuery`를 읽기 전용으로 확인했다. JP 전체 목록을 `p.created_at DESC, p.id DESC`로 정렬하며 LIMIT이 없다. 종료 팝업도 포함한다. 서버 순서를 유지해 Nuxt에서 앞 10개를 표시하며 시작일 정렬·부분 페이지 재정렬은 하지 않는다.
- 공개 `PopupResponse`에는 등록 시각이 없다. 클라이언트에서 등록일을 추측하지 않으며 기존 SQL 정렬 계약에 의존한다. JP 이외의 행이나 페이지네이션 필드가 반환되면 오류로 처리한다.
- 홈의 기존 세 요청과 병렬로 한 요청을 추가한다. 기존 30초 Nitro 캐시, 국가·섹션별 key, SSR payload 재사용 및 서명 이미지 갱신 정책을 그대로 사용한다. Hydration 시 추가 조회는 하지 않는다.
- 카드 스타일·캐러셀·상세 링크와 기존 비활성 찜 버튼은 유지한다. 빈 목록·조회 오류를 별도로 표시한다. 백엔드·DB는 수정하지 않았다.
- 코드와 diff만 정적으로 확인했다. 실제 API 호출·브라우저 확인·테스트·타입 검사·빌드는 수행하지 않았다. 운영 백엔드가 조사한 코드와 같은 계약인지 배포 후 확인이 필요하며, JP 목록이 커지면 전체 응답 비용을 고려해야 한다.

### 기존 공통 처리

- `app/pages/index.vue`: 일본 신상을 포함한 네 `useFetch`를 시작한 뒤 `Promise.all`로 대기하고 기존 `posters`/`items` props로 전달한다.
- `app/composables/useHomePopups.ts`: 국가·언어를 포함한 고정 key, `server:true`, `dedupe:'defer'`를 사용한다. SSR payload를 그대로 재사용하고 마운트 시 재조회하지 않는다.
- `server/api/home/[section].get.ts`: 허용된 세 섹션과 국가·언어만 받는다. 사용자 URL·임의 경로·임의 query를 백엔드에 전달하지 않는다.
- `server/utils/homePopups.ts`: 백엔드의 `{popups}` 응답을 검증하고 `shared/types/home.ts`의 카드 모델로 변환한다.
- `publicId`를 카드 `id`로 사용한다. `name`→`title`, `coverImageUrl`→`src`, `regionName`→`region`, 날짜는 시간대 변환 없이 `YYYY.MM.DD ~ YYYY.MM.DD`로 표시한다. 누락된 날짜는 미정으로 표시한다.
- HTTP 오류는 오류 상태로 전달한다. 네트워크 오류와 잘못된 DTO는502이며, 정상 빈 배열만 빈 상태로 표시한다. 오류를 무조건 빈 목록으로 변환하거나 임시 이미지·이름·기간으로 채우지 않는다.
- 섹션별 오류를 독립 표시한다. 이미지가 없거나 로드에 실패하면 기존 포스터 영역 안에 안내를 표시한다. 찜·상세 페이지 이동은 이번 범위에 포함하지 않는다.

## 설정과 공개 캐시

`nuxt.config.ts`의 서버 전용 `runtimeConfig.apiBase` 기본값은 `https://api.popchive.com`이다. 운영 환경에서 `NUXT_API_BASE`로 변경할 수 있다. `runtimeConfig.public`에 넣지 않는다.

백엔드 호출에는 명시적인 GET과 `Accept: application/json`만 사용한다. 방문자의 Cookie·Authorization·Origin을 전달하지 않으며 timeout10초, 자동 재시도0회다. 브라우저는 같은 origin의 Nuxt API를 사용하므로 백엔드 브라우저 CORS 변경은 필요하지 않다.

허용된 공개 응답만 Nitro `defineCachedFunction`으로30초 캐싱한다. 키에는 Base URL·섹션·국가·언어가 포함되고 `swr:false`로 만료된 값을 재사용하지 않는다. 예외는 캐싱하지 않는다. HTML과 Nuxt API HTTP 응답에는 `Cache-Control: no-store`를 적용한다. 서명 URL을 담은 홈을 장기 정적 생성·CDN HTML 캐싱하지 않는다.

사용자별 API·찜·인증은 이 캐시 함수와 경로를 재사용하지 않는다. 향후 개인화 연동은 별도의 인증·비공유 캐시 정책이 필요하다. 백엔드·DB·RN·관리자 웹은 수정하지 않았다.

## S3 이미지 만료

서명 URL의 query를 제거하거나 객체 키로 URL을 재구성하지 않는다. URL 유효기간은300초다.

- 서버 응답 캐시는30초로 제한한다.
- 보이는 탭에서30초마다 응답 나이를 확인하고3분 이상이면 해당 섹션을 갱신한다. 초기 마운트에는 API를 다시 호출하지 않는다.
- 숨겨진 탭에서는 주기 재조회를 하지 않고 복귀·페이지 복원 시 오래된 데이터를 갱신한다.
- 오래된 응답(1분 이상)의 이미지 실패는 섹션별1분에 최대1회 재조회한다. 갱신 후에도 실제 이미지가 없거나 접근할 수 없다면 안내를 유지한다.
- 타이머와 이벤트는 페이지 해제 시 정리한다. 실제 네트워크 장애 중에는 서명 갱신도 실패할 수 있으며 그 경우 섹션 오류 상태를 표시한다.

## 확인 결과와 한계

2026-10-25, 읽기 전용 운영 GET과 기존 로컬 개발 서버의 HTTP 응답으로 확인했다.

| 항목 | 결과 |
| --- | --- |
| 운영 메인 배너 | HTTP200, 4개 |
| 운영 신규 팝업 | HTTP200, 10개 |
| 운영 NOW_HOT | HTTP200, 10개 |
| Nuxt 서버 경유 | 세 경로 HTTP200, 같은 개수, 날짜 표시 변환 확인 |
| 이미지 | 섹션별 첫 이미지 GET200·image/webp·서명300초 |
| SSR HTML | HTTP200, 신규10장·TOP 10 10장, 배너 원본4개/루프용 표시8장 |
| SSR payload | 세 key별4/10/10개 포함. 임시 로컬 포스터 경로·서버 API Base URL 노출 없음 |
| 공개 캐시 | 연속 요청의 fetchedAt 동일, HTTP Cache-Control은no-store |
| 입력 검증 | 잘못된 국가400, 미허용 섹션404 |

설치된 Nuxt `asyncData` 코드의 hydration payload 재사용 분기와 초기 요청 코드에 중복 마운트 호출이 없는 점을 확인했다. **브라우저 실행을 통한 hydration 중복 요청·콘솔 경고·캐러셀 동작·장시간 이미지 갱신은 확인하지 않았다.** 프로덕션 빌드·타입 검사·자동 테스트·브라우저 자동화·스크린샷·Git commit/push도 실행하지 않았다. 위 결과는 운영 배포 완료를 의미하지 않는다.
