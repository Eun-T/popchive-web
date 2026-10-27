# 홈 API 연동

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
