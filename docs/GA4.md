# GA4 구현 및 운영 활성화

## 변경 방식

- 측정 ID: `G-6BQP2JS6MK`. `runtimeConfig.public.ga4MeasurementId`와 `NUXT_PUBLIC_GA4_MEASUREMENT_ID`로 관리한다. 추가 패키지·GTM은 설치하지 않았다.
- `app/plugins/ga4.client.ts`는 브라우저에서만 실행한다. 개발 빌드, 비운영 SEO 상태(Preview 포함), 운영 호스트 외 주소에서는 태그를 로드하지 않는다. 운영 호스트는 기존과 같은 `popchive.com`, `www.popchive.com`이다.
- **`NUXT_PUBLIC_GA4_ENABLED=false`가 기본값이다. ID만 설정해도 수집되지 않는다.** 아래 관리자 설정·정책 고지·적법 처리 근거 확인 후에만 Production에서 true로 설정한다. 이 플래그는 사용자 동의를 대신하지 않는다.
- 최초 `app:mounted`와 성공한 Vue Router `afterEach`에서 페이지뷰를 보낸다. 마운트 전 라우팅·중복/실패 이동은 전송하지 않는다. 동일 경로의 query/hash 변경도 별도 페이지뷰로 세지 않는다. 다른 페이지를 거쳐 재방문하면 다시 센다. 상세 A→B 이동도 각각 센다.
- Google 태그는 한 번만 로드하고 `send_page_view:false`로 초기 자동 페이지뷰를 막는다. 수동 `page_view`만 발행한다. 기존 gtag/GTM이 발견되면 이 구현은 초기화를 중단한다. 배포 플랫폼의 태그 삽입도 중복 설치하지 않는다.

## 활성화 전 GA 관리자에서 반드시 확인

1. 해당 웹 데이터 스트림이 `G-6BQP2JS6MK`인지 확인한다.
2. **웹 스트림의 향상된 측정(Enhanced Measurement)을 OFF**로 한다. 이력 기반 페이지뷰가 켜져 있으면 `send_page_view:false`여도 중복될 수 있다. 사이트 검색·폼·클릭·다운로드 등 자동 이벤트의 원본 URL/입력 관련 수집을 막기 위해 이번 구현에서는 향상된 측정 전체를 끈다.
3. Google Signals, 사용자 제공 데이터 수집, 광고 개인 최적화·리마케팅을 끄고 Google Ads 연계·광고 대상 내보내기·데이터 공유 설정을 확인한다. 코드도 `allow_google_signals:false`, `allow_ad_personalization_signals:false`, 광고 consent 3종 denied, `user_id:null`을 지정한다. 코드가 GA 계정 설정을 수정하는 것은 아니다.
4. 개인정보처리방침 고지·해당되는 국외 처리 근거·거부 수단을 확정한다. 확인 전에는 enabled=false를 유지한다. 사전 동의가 필요한 방식은 이번 무배너 구현으로 활성화하지 않는다. 기존 공개 정책을 수정하지 않았다. [이전 검토 기록](./GA4_PRIVACY_REVIEW.md)

## Vercel 환경변수

Project Settings → Environment Variables → **Production**에 등록한다.

```dotenv
NUXT_PUBLIC_GA4_MEASUREMENT_ID=G-6BQP2JS6MK
NUXT_PUBLIC_GA4_ENABLED=false
```

관리자 설정과 법적 근거·고지·거부 수단을 확인한 뒤에만 두 번째 값을 `true`로 바꾸고 새로 배포한다. Preview/Development는 false를 유지한다. Netlify를 계속 운영하는 경우 같은 변수를 운영 환경에 적용할 수 있으나 동시 운영에서 이중 태그를 설치하지 않는다. 이번 작업에서는 외부 환경변수 등록·배포·GA 관리자 설정 변경을 수행하지 않았다.

## 데이터 최소화와 거부

- 앱이 보내는 페이지뷰에는 고정된 페이지 제목, query/hash 없는 대표 URL, 정제한 직전 내부 페이지 URL과 측정 ID만 포함한다. 상세 페이지는 실제 ID 대신 `/places/:publicId`로 묶는다. 실제 상세 제목·document.title·외부 referrer·검색어·폼·회원정보·User-ID·이메일은 전달하지 않는다. `/design` 등 미허용 페이지는 추적하지 않는다.
- GA4 자체가 사용하는 쿠키 식별자, 기기/브라우저 및 접속 관련 기술 데이터까지 완전한 익명정보나 무개인정보 처리라고 주장하지 않는다. 이 점이 법적 근거 확인과 기본 수집 차단을 유지하는 이유다.
- DNT=1, Global Privacy Control 또는 로컬 `popchive:ga4:disabled=true`이면 로드/페이지뷰를 차단한다. 브라우저 저장소를 읽지 못하는 경우도 차단한다. 이후 페이지 이동에서도 거부 상태를 확인한다. 별도 동의 배너·푸터 UI는 추가하지 않았다.
- 개발자 콘솔에서 아래처럼 거부를 저장하고 새로고침하면 이 구현의 태그가 로드되지 않는다. 이것은 사용자용 정책 고지·접근 가능한 거부 UI를 완성한 것으로 보지 않는다. 이미 저장된 쿠키·이미 전송된 데이터를 삭제하는 기능은 아니다.

```js
localStorage.setItem('popchive:ga4:disabled', 'true')
location.reload()
// 재허용은 위 키를 삭제한 뒤 새로고침한다.
```

## 실제 수집 확인

적법한 활성화 전제와 관리자 설정을 충족한 승인된 운영 배포에서 확인한다. 개발 빌드·Preview가 비활성인 것은 정상이다.

1. 광고 차단 기능이 없는 테스트 브라우저에서 Google Tag Assistant로 운영 URL을 연결한다. Analytics 관리자 접근 권한은 별도로 필요하다.
2. Network에서 gtag.js가 한 번 로드되는지 확인한다. `g/collect` 요청의 `tid=G-6BQP2JS6MK`, `en=page_view`와 URL·제목 파라미터를 확인한다. 한 요청에 이벤트가 배치될 수 있어 단순 HTTP 요청 수 대신 page_view 이벤트 수를 확인한다.
3. 최초 1회 → 내부 링크로 다른 페이지 1회 → 뒤로가기 1회 이동하면 각각 page_view 1개씩이어야 한다. 동일 URL 중복 이동·해시/쿼리만 변경은 추가되지 않아야 한다. Google 자동 session_start·first_visit·user_engagement를 page_view 중복으로 혼동하지 않는다.
4. GA4 실시간 보고서에서 페이지뷰를 확인한다. Tag Assistant로 디버그 모드를 활성화한 경우 DebugView에서도 확인한다. 배너·정책을 테스트하기 위해 미동의 실제 방문자를 수집하지 않는다.
5. Preview·개발·enabled=false·DNT/GPC·저장된 거부 상태에서는 Google 태그와 분석 요청이 없어야 한다.

## 검증 결과

2026-10-27, 기존 Node 22.23.3과 설치 의존성으로 검증했다.

| 항목 | 결과 |
| --- | --- |
| `npm run typecheck` | 통과 |
| `npm run build -- --preset=vercel` | 통과. Vercel Node SSR 산출물 생성 |
| 개발·Preview·OFF·거부·DNT/GPC·잘못된 ID·기존 태그 등 15개 차단 조건 | 플러그인과 유틸리티 실제 소스를 모의 브라우저 환경에서 실행해 script 0개·page_view 0개 확인 |
| 초기 접속·SPA·뒤로가기·상세 간 이동 | 최초 1회, 성공한 다른 경로 이동당 1회. 태그/config 각각 1회 |
| 중복·실패·query/hash 이동 및 미허용 페이지 | 추가 page_view 없음. 플러그인 중복 초기화에도 중복 태그/페이지뷰 없음 |
| 데이터 최소화 | 전송 큐에 검색어·query/hash·외부 referrer·document.title·상세 ID 미포함, Signals/광고 비활성 및 user_id:null 확인 |
| SSR·UI·서버 변경 여부 | SSR Function에 gtag 로더 미포함. 기존 app.vue·페이지·레이아웃·컴포넌트·SEO·서버·shared·의존성 파일 변경 없음 |

검증은 Google SDK를 실행하거나 실제 수집 요청을 보내지 않은 코드 수준의 모의 실행이다. 따라서 GA 관리자 설정에 의한 자동 이벤트 중복이나 실시간 보고서 반영까지 통과했다고 판단하지 않는다. 임시 점검 코드는 Git 제외 경로에서 실행한 뒤 제거했다. 실제 수집 확인은 위 절차에 따라 적법한 운영 활성화 후 별도 수행한다.

미해결 사항은 실제 개인정보처리방침 고지, 수집·국외 처리 근거, 사용자 접근 가능한 거부 수단, GA 관리자 향상된 측정/광고/공유 설정 확인이다. 이번에는 정책·배너·기존 UI를 수정하지 않았으며 활성화 기본값 false를 유지한다.

## 공식 근거

- [Google page_view 및 향상된 측정 중복 주의](https://developers.google.com/analytics/devguides/collection/ga4/views)
- [Google Signals·광고 개인 최적화 비활성화](https://developers.google.com/tag-platform/security/guides/privacy)
