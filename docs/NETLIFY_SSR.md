# Netlify SSR 배포 준비

## 구성

Nuxt 4.6.2·Nitro 2.13.5·Vue 3.5.44, 로컬 검증 Node 22.23.3. `compatibilityDate: 2025-07-15`는 Netlify Functions 2.0을 지원하는 Nitro 기준일 2024-05-07보다 최신이다.

`netlify.toml`은 Netlify에서만 다음 값을 적용한다.

| 설정 | 값 |
| --- | --- |
| Base directory | 프로젝트 루트 |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Build Node | `NODE_VERSION=22` |
| Nitro preset | `NITRO_PRESET=netlify` |
| Functions directory override | 지정하지 않음 |

Nitro가 `.netlify/functions-internal/server/`의 Node Functions 2.0 핸들러와 라우팅 메타데이터를 생성한다. 정적 리소스는 `dist/`에 복사된다. `dist`만 정적 업로드하는 방식은 SSR/API를 배포하는 방식이 아니다.

- `generate`, 정적 export, Edge preset은 사용하지 않는다.
- 수동 SPA catch-all이나 `index.html` fallback을 추가하지 않는다. 생성되는 Function의 `path: /*`, `preferStatic: true`는 정적 파일 외 요청을 SSR/API로 처리하기 위한 서버 라우팅이다.
- Netlify CLI·Nuxt 모듈·플러그인 설치는 필요하지 않아 추가하지 않았다.
- `nuxt.config.ts`를 Netlify 전용으로 고정하지 않았다. 일반 빌드는 node-server, Vercel 빌드는 기존 preset을 사용할 수 있다.
- `.netlify`와 `.vercel`을 Git 제외에 추가했다. 기존 `.output`, `dist`, `.env` 제외는 유지한다.

## 환경변수

Netlify UI의 프로젝트 환경변수에서 등록한다. 아래 값은 SSR과 Functions runtime에서 읽히므로 **Build와 Functions 모두 사용 가능**하도록 설정한다. Free에서 범위 선택을 제공하지 않는 UI라면 기본 전체 범위를 사용한다. 파일의 `[build.environment]`만으로는 Functions 런타임에 값이 전달되지 않는다.

| 이름 | 용도 | 등록 값 |
| --- | --- | --- |
| `NUXT_API_BASE` | 서버 전용 공개 백엔드 주소 | `https://api.popchive.com` |
| `NUXT_PUBLIC_GOOGLE_MAPS_API_KEY` | 공개 웹 JavaScript 지도 키 | 기존 값, 문서에 기록하지 않음 |
| `NUXT_PUBLIC_GOOGLE_STATIC_MAPS_API_KEY` | 공개 웹 Static 지도 키 | 기존 별도 값, 문서에 기록하지 않음 |
| `NUXT_PUBLIC_GOOGLE_STATIC_MAP_ID` | 홈 정적 지도 ID | `8874d01a85c7c50d6fe5cae7` |
| `NUXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | 기존 웹 지도 ID | `8874d01a85c7c50d28c8018f` |

기존 변수 이름과 `runtimeConfig.apiBase`/`runtimeConfig.public` 읽기 방식을 유지한다. `.env`가 자동으로 Netlify 환경변수에 등록된다고 가정하지 않는다. Production·Deploy Preview·Branch Deploy의 값을 각각 점검하고 변경 후 재배포해야 한다.

Netlify Functions는 유효한 Build Node 버전을 기본 runtime으로 사용한다. 별도로 고정할 필요가 있으면 UI에서 `AWS_LAMBDA_JS_RUNTIME=nodejs22.x`를 설정할 수 있다. 이 override는 netlify.toml에 쓰지 않는다.

`NUXT_PUBLIC_*` 지도 키는 웹에서 보이는 키다. 서버 전용 비밀키나 Static URL 서명 비밀을 넣지 않는다. Google Cloud에서는 기존 API별 제한과 승인된 Netlify 테스트 도메인 referrer 제한을 확인해야 한다. 이번에 Cloud 설정이나 실제 지도 요청은 변경하지 않았다.

## SEO·Preview

기존 canonical과 Sitemap URL은 `https://popchive.com`으로 유지한다. Netlify 테스트 주소를 대표 URL로 바꾸지 않는다.

- 기존 허용 호스트는 `popchive.com`, `www.popchive.com`뿐이므로 일반 `*.netlify.app`, `deploy-preview-*--*.netlify.app`, 브랜치 주소는 원래도 noindex다.
- `isProductionSeoHost`에 Netlify `CONTEXT`의 `deploy-preview`, `branch-deploy`, `dev` 거부를 추가했다. `production`은 대표 호스트에서만 허용한다.
- Netlify의 기본 `CONTEXT`는 Build 전용일 수 있어 Functions runtime에서는 없을 수 있다. 이 값만 믿지 않고 호스트 허용 목록을 항상 적용한다. CONTEXT를 별도 필수 환경변수로 추가하지 않았다.
- 기존 Vercel `VERCEL_ENV=preview|development` 거부도 유지한다.
- HTML robots, `X-Robots-Tag`, 동적 robots.txt, 404·503 정책, 상세 메타데이터는 기존 구현을 재사용한다.

## API·캐시

- 브라우저 → 같은 사이트의 Nitro API → 기존 Spring 공개 API 구조를 유지한다. 브라우저에서 백엔드를 직접 호출하지 않으므로 백엔드 CORS 변경은 필요 없다.
- 일반 데이터의 30초, 옵션 300초, 지도 통계 60초 캐시를 유지한다. Nitro 기본 메모리 캐시는 함수 인스턴스별이며 콜드 스타트·다중 인스턴스 사이에서 공유되지 않는다.
- Sitemap 300초 캐시 및 남은 수명에 맞춘 s-maxage, 10,000개 단위 분할, API 장애 시 불완전한 목록 대신 503 반환을 유지한다. Netlify CDN의 실제 cache-hit는 배포 후 확인해야 한다.
- 파일 시스템에 영구 쓰기를 요구하는 앱 코드는 없다. 검색·목록·상세·Sitemap API 계약을 변경하지 않았다.
- 외부 API의 개별 타임아웃은 대체로 10초, Sitemap은 15초다. Netlify의 동기 Functions 제한과 실제 콜드 스타트·해외 리전↔한국 API 지연을 배포 후 확인한다.

## 무료 플랜과 공개 전 확인

신규 credit-based Free 문서 기준 월 300 credits와 hard limit이 있다. 무제한 무료 SSR을 뜻하지 않으며 배포·요청·대역폭·Functions compute가 사용량에 영향을 준다. 기존 계정의 legacy 플랜은 다를 수 있으므로 실제 대시보드에서 확인한다. 유료 서비스나 업그레이드를 도입하지 않았다.

GitHub 업로드 전 `.env`, `.netlify`, `.vercel`, `.output`, `dist`, `node_modules`가 포함되지 않는지 확인한다. `netlify.toml`, `.env.example`, 소스와 lockfile은 포함한다. 이번 작업에서 commit/push를 실행하지 않았다.

실제 Preview에서는 환경변수·Google referrer·API 접근·SSR 응답 시간·CDN 캐시·noindex를 다시 확인해야 한다. 기본 `*.netlify.app` 주소는 의도적으로 noindex다. 운영 대표 도메인을 붙이기 전에는 그 주소에서 index가 나오지 않는다. DNS·도메인 연결은 이번 작업에 포함하지 않는다.

## 공식 참고

- [Netlify Nuxt 안내](https://docs.netlify.com/build/frameworks/framework-setup-guides/nuxt/)
- [현재 Nitro 2 Netlify preset](https://v2.nitro.build/deploy/providers/netlify)
- [Functions 환경변수](https://docs.netlify.com/build/functions/environment-variables/)
- [Node runtime 설정](https://docs.netlify.com/build/functions/configuration/)
- [Free credit 정책](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)

## 검증 기록

2026-10-26, Node 22.23.3에서 확인했다. 실제 Netlify 배포나 계정 연결은 수행하지 않았다.

| 항목 | 결과 |
| --- | --- |
| `npm run typecheck` | 통과 |
| `npm run build` | 기본 node-server 빌드 통과 |
| `NITRO_PRESET=netlify npm run build` | 통과. `.netlify/functions-internal/server/server.mjs`와 `main.mjs`, `dist/_nuxt` 생성 |
| SSR 산출물 | Node Functions 2.0 핸들러 확인. `dist/index.html` 및 Edge Functions 산출물 없음 |
| 실제 데이터 SSR | 생성된 Functions 핸들러를 로컬 HTTP 어댑터에서 호출. 홈·플레이스·지도·실제 팝업 상세 모두 200, 최초 HTML의 title/description/canonical/OG 확인 |
| 기존 API 프록시 | 홈 3종, 플레이스 옵션·곧 끝나요·장소·주간, 서울 통계·지도 범위 조회, 한국어·일본어 빠른 검색 모두 200 |
| Sitemap | XML 파싱 통과. 실제 팝업 38개 + 고정 페이지 3개 = 41개, 중복 없음. `/sitemaps/1.xml` 정상 응답 |
| Sitemap 캐시·분할 | 300초 원본 캐시와 남은 수명의 s-maxage 확인. 별도 모의 응답에서 중복 제거, 10,000/5 URL 분할, 동일 캐시 원본 조회 1회 확인 |
| 오류 상태 | 없는 상세 404/noindex. 모의 API 장애에서 Sitemap 및 상세 503/noindex/Retry-After 60, 불완전한 정상 Sitemap 반환 없음 |
| Preview SEO | 일반 Netlify·Deploy Preview·Branch 호스트는 CONTEXT 없이도 HTML/header noindex. CONTEXT의 production/deploy-preview/branch-deploy/dev 조합도 확인 |
| robots.txt | 운영 호스트에서 Sitemap 명시, Preview 호스트에서 Sitemap 미노출. `/design` noindex 유지 |
| 브라우저 | 위 4개 페이지 Hydration 완료, mismatch 0건, 초기 브라우저 API 요청 0회. 홈 빠른 검색은 요청 1회/결과 5개 |
| 변경 범위 | package.json·package-lock.json 해시 동일. 의존성 설치, UI·백엔드·DB·API 계약 변경 없음 |

브라우저 점검에서는 외부 이미지를 대체하고 Google SDK 요청을 차단했다. 지도 실제 표시·키 제한·외부 이미지 품질을 통과했다고 판단하지 않는다. 로컬 어댑터는 생성된 실제 Function을 호출하지만 Netlify 플랫폼 에뮬레이터는 아니다. 실제 Functions 환경변수 주입, 콜드 스타트, CDN 캐시 적중, 응답 제한, Google referrer는 최초 Preview 배포 후 별도 확인해야 한다. 점검용 스크립트는 최종 소스에 포함하지 않는다.
