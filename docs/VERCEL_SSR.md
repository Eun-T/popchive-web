# Vercel SSR 이전 준비

## 설정과 기존 배포 유지

- Nuxt 4.6.2·Nitro 2.13.5의 Node SSR preset `vercel`을 사용한다. 루트 [vercel.json](../vercel.json)이 Nuxt framework, 빌드 명령 `npm run build -- --preset=vercel`, Functions 리전 `icn1`을 지정한다.
- Vercel 프로젝트 Root Directory는 이 저장소 루트, Node.js Version은 기존 Netlify 및 검증 환경과 같은 **22.x**로 선택한다. Output Directory는 수동 지정하지 않고 Nuxt 기본값을 사용한다. `dist`만 업로드하는 정적 배포가 아니다.
- Nitro가 `.vercel/output/config.json`, `functions/__fallback.func/`, `static/`을 생성한다. SSR·Nitro API·동적 robots/Sitemap은 Node Function에서 실행한다. Edge preset, SPA fallback, 별도 rewrites, generate는 추가하지 않는다.
- [netlify.toml](../netlify.toml)의 빌드·`NITRO_PRESET=netlify`·`dist` 설정은 유지한다. Vercel의 빌드 명령은 vercel.json에서만 적용되며 package.json과 nuxt.config.ts의 공통 동작은 변경하지 않는다.
- Vercel에 기존 Netlify 환경변수를 일괄 복사하면서 `NITRO_PRESET=netlify`나 `CONTEXT`를 등록하지 않는다. 필요하면 Vercel의 `NITRO_PRESET`은 `vercel`로 한다.

## 서울 리전

Vercel 공식 리전 목록에 서울 `icn1`이 있으며 Hobby도 단일 리전을 선택할 수 있다. 우선 `regions: ["icn1"]`을 사용한다. 계정·프로젝트에서 서울 사용이 거부되는 경우에만 vercel.json의 한 값을 `hnd1`(도쿄)으로 바꾼다. 실제 프로젝트 권한·리전 배치는 배포 전에는 확인할 수 없다.

서울과 도쿄를 배열에 함께 넣는 것은 우선순위 fallback 설정이 아니다. Enterprise 전용 자동 failover는 추가하지 않았다. 정적 파일 CDN 위치와 서버 Function 리전은 구분한다.

## 환경변수

Vercel Project Settings → Environment Variables에서 **Production·Preview**에 다음 값을 각각 등록한다. 로컬 Vercel 개발을 사용할 때만 Development에도 등록한다. 기존 `.env`는 업로드하지 않으며 실제 키는 저장소·문서에 기록하지 않는다. 변수 변경은 이후 새 배포에 적용한다.

| 변수 | 기존 runtimeConfig 연결 | 등록할 값 |
| --- | --- | --- |
| `NUXT_API_BASE` | 서버 전용 `apiBase` | 기존 백엔드 주소, 기본 `https://api.popchive.com` |
| `NUXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `public.googleMapsApiKey` | 기존 Maps JavaScript API 웹 키 |
| `NUXT_PUBLIC_GOOGLE_STATIC_MAPS_API_KEY` | `public.googleStaticMapsApiKey` | 기존 별도 Maps Static API 웹 키 |
| `NUXT_PUBLIC_GOOGLE_STATIC_MAP_ID` | `public.googleStaticMapId` | 기존 홈 Static Maps map ID |
| `NUXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | `public.googleMapsMapId` | 기존 JavaScript 지도 map ID |

다섯 변수는 이미 [nuxt.config.ts](../nuxt.config.ts)와 [.env.example](../.env.example)에 선언되어 있어 이름을 변경하거나 별도 전달 코드를 추가하지 않는다. `NUXT_API_BASE`를 public으로 옮기지 않는다. `NUXT_PUBLIC_*`는 브라우저에 공개되는 값이며 서버 비밀키·URL 서명 비밀을 넣지 않는다.

지도 키의 기존 API별 제한을 유지하고, 실제 사용할 Vercel Preview/운영 호스트의 HTTP referrer 허용 여부를 Google Cloud에서 확인한다. 이번 작업에서는 Google Cloud 설정이나 키를 변경하지 않는다.

## 기능 유지와 SEO

- 브라우저 → 동일 사이트 `server/api/` → 기존 Spring 공개 API 흐름을 유지한다. API별 경로·파라미터 검증, 서버 전용 base URL, credential 미전달, 타임아웃과 메모리 캐시도 유지한다. 백엔드 CORS·DB 변경은 필요 없다. 메모리 캐시는 Function 인스턴스 간 공유되지 않는다.
- `/`, `/places`, `/map`, `/places/:publicId`는 기존 SSR과 SEO 처리를 사용한다. 동적 `/sitemap.xml`, `/sitemaps/:part`, `/robots.txt`를 정적 파일이나 SPA rewrite로 덮어쓰지 않는다.
- canonical과 Sitemap 기준은 계속 `https://popchive.com`이다. 현재 호스트 허용 목록과 `VERCEL_ENV=preview|development` 처리가 있어 `*.vercel.app`과 Preview는 noindex다. robots.txt의 운영 Sitemap 안내는 운영 호스트에서만 나온다. 기존 상세 404·장애 503 정책을 유지한다.
- Google Maps 클라이언트 컴포넌트와 홈 Static Maps URL 생성은 변경하지 않는다. 실제 Google SDK·이미지·키 제한은 로컬 빌드만으로 검증되지 않는다.

## 로컬 검증과 배포 전 확인

```powershell
npm run typecheck
npm run build -- --preset=vercel
# 기존 Netlify 빌드 호환성 확인
$env:NITRO_PRESET = 'netlify'
npm run build
Remove-Item Env:NITRO_PRESET
```

검증 결과와 한계는 이 문서 하단에 기록한다. 생성된 `.vercel`, `.netlify`, `dist`는 기존 Git 제외 규칙을 유지한다. Vercel CLI 설치·로그인·프로젝트 연결·실제 배포는 이번 작업에 포함하지 않는다.

이후 승인된 최초 Preview에서 실제 Functions 리전, 다섯 환경변수 주입, 백엔드 연결, SSR 상세 메타, Sitemap/robots, Preview noindex, 지도 referrer, CDN 캐시·콜드 스타트를 확인한다. Preview 확인 전 도메인 DNS를 바꾸거나 Netlify 배포를 중단하지 않는다.

### 이번 검증 결과 (2026-10-27)

로컬 Node 22.23.3과 기존 설치 의존성을 사용했다. 설치·업데이트·Vercel CLI 호출은 수행하지 않았다.

| 항목 | 결과 |
| --- | --- |
| `npm run typecheck` | 통과 |
| `npm run build -- --preset=vercel` | 통과. Build Output API v3, `nodejs22.x`, `__fallback.func/index.mjs`, 정적 파일과 Nitro 라우트 생성 |
| Vercel 라우팅 | Node SSR fallback 생성, SPA index.html fallback 없음. 루트 설정의 서울 `icn1` 확인 |
| 생성된 Vercel Function 로컬 호출 | 모의 백엔드로 홈·팝업 상세 SSR, canonical/index 메타, 지도 페이지 SSR, 지도/메인 배너 API 프록시 정상 |
| 환경변수 | 빌드 후 다섯 변수를 테스트 값으로 주입해 runtime override 확인. 공개 지도 변수 4개는 SSR payload에 반영, 서버 API base는 프록시 호출에 사용되며 HTML에 노출되지 않음 |
| SEO 라우트 | 동적 Sitemap의 상세 URL과 XML 응답, 운영 robots Sitemap 안내, Preview 호스트 HTML/header noindex와 robots Sitemap 미노출, 없는 상세 404/noindex 확인 |
| API credential | 모의 백엔드에 방문자 Cookie·Authorization 미전달 확인 |
| Netlify 재빌드 | 기존 `NITRO_PRESET=netlify`로 통과. `dist`와 `.netlify/functions-internal/server/` 생성 |
| 변경 범위 | 기존 netlify.toml·nuxt.config.ts·package.json·lockfile·app/·server/·shared/ 변경 없음 |

Vercel Function 검증은 실제 생성된 handler를 로컬 Node HTTP 서버에서 호출한 결과이며 Vercel 플랫폼 에뮬레이션이나 실제 배포 결과가 아니다. 외부 API·Google 요청은 보내지 않고 모의 응답을 사용했다. 지도 SDK 실행·이미지 표시·실제 referrer 허용, Vercel 계정 리전 권한·Functions 주입·CDN 캐시·콜드 스타트는 미검증이다. Netlify도 로컬 재빌드만 했으며 운영 배포에 접근하지 않았다.

타입 검사와 Vercel 빌드에서 기존 devtools 모듈 초기화 지연 경고(`NUXT_B8014`)가 발생했으나 모두 종료 코드 0으로 완료됐다. 이 경고를 이유로 앱 설정을 변경하지 않았다. 로컬 점검 코드는 Git 제외된 임시 경로에서만 실행한 뒤 제거했다.

## 공식 참고

- [Nuxt on Vercel](https://vercel.com/docs/frameworks/full-stack/nuxt)
- [Nitro 2 Vercel preset](https://v2.nitro.build/deploy/providers/vercel)
- [Vercel regions](https://vercel.com/docs/regions)
- [vercel.json의 regions](https://vercel.com/docs/project-configuration/vercel-json#regions)
- 관련 기존 문서: [Netlify SSR](./NETLIFY_SSR.md), [SEO](./SEO_STRATEGY.md), [API 연동](./API_INTEGRATION.md), [Google Maps](./GOOGLE_MAPS.md), [홈 Static Maps](./HOME_STATIC_MAP.md)
