# Google 웹 로그인

## 설정

`NUXT_PUBLIC_GOOGLE_CLIENT_ID`를 Nuxt runtimeConfig.public.googleClientId로 사용한다. 기본값은 빈 문자열이며 예시 ID를 임의로 넣지 않는다. 설정이 없으면 SDK를 로드하지 않고 이메일 로그인을 안내한다. Client ID는 공개 식별자이며 Client Secret은 사용하거나 브라우저에 전달하지 않는다.

Google Cloud Console에서 **Web application** 유형의 기존 client를 선택한다. RN이 사용하는 Web Client ID와 Spring `google.web-client-id`의 실제 값에 맞춰야 한다. 현재 백엔드는 audience를 하나만 허용하므로 새 ID를 임의로 만들면 인증되지 않는다. Android/iOS 유형 ID를 대신 사용할 수 없다.

- Authorized JavaScript origins: 실제 개발 Origin(예: `http://localhost:3000`, 실제 사용하는 포트)과 운영 HTTPS Origin을 등록한다. localhost 기본 Origin도 공식 안내에 맞춰 확인한다. www/비-www를 모두 사용하면 각각 등록한다.
- 이번 구현은 GIS 팝업 callback이므로 신규 redirect callback URL은 요구하지 않는다.
- Google Auth Platform의 Branding/Audience, 테스트 사용자·공개 상태, 승인 도메인과 개인정보처리방침 URL을 확인한다.
- CSP·COOP 등 운영 보안 헤더가 GIS SDK/iframe/팝업을 차단하지 않는지 확인한다. 이번 작업에서 외부 콘솔·배포 헤더는 변경하지 않았다.
- 기존 서버 전용 `NUXT_API_BASE`의 Spring 배포가 Google API를 제공해야 한다. 콘솔 설정값·운영 배포와의 실제 일치는 미확인이다.

## 구현 흐름

로그인 카드의 이메일 폼 아래에 공식 GIS `renderButton`으로 버튼을 렌더링한다. SDK는 클라이언트에서만 로드하고 창 크기 변화 시 버튼 폭만 갱신한다. One Tap·자동 로그인·Apple·Kakao는 추가하지 않았다.

기존 동일 Origin JSON POST 중계 `/api/web-auth/[action]`에 다음 action을 추가했다. 이는 Nuxt 중계 확장이며 새로운 Spring API가 아니다.

| action | 처리 |
| --- | --- |
| google-start | 서버 난수 nonce, 5분짜리 HttpOnly·SameSite=Lax·HTTPS Secure 임시 쿠키 발급 |
| google | ID Token의 nonce를 임시 쿠키와 비교 → 기존 POST /api/auth/google {idToken,deviceId} |
| google-complete | 가입 토큰의 브라우저/기기 연결과 입력 검증 → 기존 POST /api/auth/google/complete |

nonce payload 파싱은 로그인 시도 연결 확인용이며 인증 판정이 아니다. 동일한 원본 ID Token은 Spring의 기존 서명·issuer·만료·audience 및 사용자 검증을 통과해야 한다. Nuxt의 Origin·JSON 검사는 유지하고, Google ID Token 요청의 본문 상한만 20,000바이트로 제한한다. ID Token 자체는 백엔드와 같이 16,384자 이하로 제한한다.

기존 사용자는 공통 `establishWebSession`으로 기존 쿠키 저장 함수와 `/api/users/me` 조회를 거쳐 useAuth를 갱신한다. 서비스 access/refresh token은 응답 JSON에 넣지 않는다. 기본 목적지는 `/`, 정확히 `redirect=/mypage`일 때만 해당 페이지로 복귀한다.

신규 사용자는 SIGNUP_REQUIRED 응답의 signupToken을 컴포넌트 메모리에만 보관한다. URL·localStorage·SSR payload·로그에는 넣지 않는다. 서버 임시 쿠키에는 기기 ID와 토큰의 SHA-256 해시만 보관해 다른 가입 시도의 토큰을 임의로 제출하지 못하게 연결한다. 유효기간은 백엔드 값과 10분 중 짧은 값이다.

닉네임, 만 14세 이상 확인, 기존 약관 원문·개인정보 동의를 입력받는다. 마케팅은 false다. 가입 완료 API는 이메일 인증/비밀번호를 요구하지 않는다. 완료 후 기존 사용자와 같은 웹 세션을 발급한다. 이메일 중복은 기존 로그인 방법을 안내하고 자동 계정 연결은 하지 않는다. 닉네임 충돌은 수정 후 가입을 다시 시도할 수 있다.

## 실패·취소 및 제한

- SDK 로딩은 15초 제한·재준비 버튼을 제공한다. 설정 누락이나 SDK 차단이 이메일 입력을 계속 막지 않도록 한다.
- 팝업 중 이메일/중복 Google 입력을 잠그고, credential 수신 후에는 기존 useAuth pending과 Web Locks를 재사용한다. 인증 HTTP 요청은 자동 재시도하지 않는다.
- GIS ID 로그인 버튼은 OAuth code client의 error_callback과 동일한 취소/차단 오류 API를 제공하지 않는다. 팝업 미완료 시 명시적 취소, 창 복귀 후 확인 대기, 2분 대기 제한으로 시도를 정리하고 취소/차단 가능성을 안내한다. 정확한 원인을 임의로 단정하지 않는다. 늦게 도착한 이전 시도의 callback은 generation으로 무시한다.
- 가입 만료는 자동으로 메모리 토큰을 제거하고 Google 재인증을 준비한다. 재인증·로그인 카드 이탈 시 가입 진행 정보는 유지하지 않는다.
- 임시 쿠키는 동일 브라우저에서 여러 로그인 탭을 동시에 열면 마지막 시도로 교체된다. 이전 탭은 nonce 불일치 안내 후 다시 인증해야 한다. 토큰·개인정보를 오류에 그대로 출력하지 않는다.
- Google 취소는 이 페이지의 인증 시도를 취소하는 동작이다. GIS의 외부 팝업 자체를 강제로 닫거나 Google 계정의 동의를 철회하는 기능은 아니다.

## 변경 파일

- `nuxt.config.ts`, `shared/types/auth.ts`
- `app/components/auth/AuthForm.vue`, `app/components/auth/GoogleLogin.vue`
- `app/utils/googleIdentity.ts`, `app/composables/useAuth.ts`
- `server/utils/webAuth.ts`, `server/utils/googleWebAuth.ts`
- `server/api/web-auth/[action].post.ts`
- 이 문서와 `docs/WEB_AUTH.md` 연결 안내

## 확인 범위

코드 정적 검토만 수행했다. 실제 OAuth·API 호출·빌드·타입 검사·테스트·개발 서버 실행·배포는 하지 않았다. RN·Spring·DB·기존 마이페이지 보호 규칙을 변경하지 않았다.

수동 확인: Client ID 누락, 공식 버튼의 PC/모바일 폭, SDK 차단/실패, 팝업 취소/차단/장시간 대기, 기존 Google 사용자, 이메일 계정 충돌, 신규 필수 동의·닉네임 중복, 가입 토큰 만료, 연속 클릭·네트워크 오류, 여러 로그인 탭, 일반 홈 이동·mypage 복귀, 새로고침 복원·로그아웃 후 보호 페이지 차단.

공식 문서: [GIS 버튼](https://developers.google.com/identity/gsi/web/guides/display-button), [JavaScript API](https://developers.google.com/identity/gsi/web/reference/js-reference), [OAuth 설정](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).
