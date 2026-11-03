# Apple 웹 로그인

## 목차

1. [상태와 계약](#상태와-계약)
2. [필수 설정](#필수-설정)
3. [인증 흐름](#인증-흐름)
4. [보안과 오류 처리](#보안과-오류-처리)
5. [수동 확인](#수동-확인)
6. [변경 파일](#변경-파일)

## 상태와 계약

Nuxt만 구현했다. Spring `docs/apple-web-auth-api.md`, `AppleAuthController`, `AppleAuthService`, `AppleChallengeService`, `AppleClientConfiguration`, `AppleSignupTokenService`와 RN `src/lib/appleAuth.ts`를 읽기 전용으로 확인했다. 요청 필드·응답·웹 authorizationCode 필수·challenge/가입 만료·마케팅 false 계약의 문서/소스 불일치는 발견하지 않았다. 배포된 백엔드와 Apple Developer 설정은 미확인이다. RN·Spring·DB는 수정하지 않았다.

[Google 로그인](./GOOGLE_LOGIN.md) 및 [웹 인증](./WEB_AUTH.md)의 동일 Origin JSON POST, deviceId, 공통 세션 함수, 사용자 조회, useAuth/Web Locks를 재사용한다. Google·이메일 입력 필드와 라우팅은 유지한다. 공통 `establishWebSession`은 토큰 응답 검증 및 `/api/users/me` 성공 후에만 쿠키를 저장하도록 보완했다. 기존 refresh 복원은 변경하지 않았다.

**정적 코드 검토만 수행했다. 실제 Apple 인증 성공은 확인하지 않았다.** API·Redis 연결·브라우저·SDK 실행·테스트·타입 검사·빌드·개발 서버 실행·배포·commit/push는 수행하지 않았다.

## 필수 설정

| Nuxt 환경변수 | 공개 여부 | 값 |
| --- | --- | --- |
| `NUXT_PUBLIC_APPLE_CLIENT_ID` | 공개 | Apple Services ID. Spring `APPLE_WEB_CLIENT_ID`와 동일; iOS Bundle ID와 별도 |
| `NUXT_APPLE_WEB_REDIRECT_URI` | 서버 설정, 시작 응답에서 공개 SDK 값으로 전달 | 아래 Return URL. Spring `APPLE_WEB_REDIRECT_URI`와 정확히 동일 |
| `NUXT_APPLE_AUTH_REDIS_URL` | 서버 전용 | Upstash 호환 Redis REST HTTPS 루트 엔드포인트 |
| `NUXT_APPLE_AUTH_REDIS_TOKEN` | 서버 전용 비밀 | 저장소 읽기/쓰기 자격증명 |

Nuxt runtimeConfig 환경변수 규칙을 사용한다. 웹에서 `APPLE_WEB_REDIRECT_URI` 이름만 설정하면 적용되지 않는다. `.env.example`을 참고한다. 실제 자격증명은 이번 작업에서 설정하지 않았다.

운영 도메인 `https://theplave.co.kr` 기준 **Apple Developer에 등록할 정확한 Return URL**:

```text
https://theplave.co.kr/api/web-auth/apple-return
```

웹 `NUXT_APPLE_WEB_REDIRECT_URI`와 백엔드 `APPLE_WEB_REDIRECT_URI`에 위 문자열을 동일하게 설정한다. 서버는 HTTPS·현재 요청과 같은 Origin·고정 경로·query/fragment/userinfo 없음까지 검사한다. www/다른 도메인은 해당 Origin으로 별도 등록·설정해야 한다. HTTP localhost는 지원하지 않으며 개발 인증에도 등록된 HTTPS 도메인이 필요하다.

실제 인증 전 운영자가 설정할 사항:

- Services ID의 Sign in with Apple 활성화, 웹 도메인 `theplave.co.kr` 및 Return URL 등록.
- 웹 Services ID를 기존 iOS primary App ID에 연결. 기존 Bundle ID/RN 설정 유지.
- 기존 Team ID/Key ID/개인키의 primary App ID 연결, 백엔드 code 교환·암호화·환경변수 설정 확인. Private Key/Client Secret은 Nuxt 공개 설정에 넣지 않는다.
- 백엔드 문서의 배포 순서 및 기존 migration 적용 상태를 담당자가 확인한다. 웹 작업에서 DB를 조회하거나 변경하지 않았다.
- 공유 저장소가 `SET ... EX ... NX`, `GETDEL`, `DEL`을 지원하고 모든 Nuxt 인스턴스가 같은 저장소를 사용하도록 구성한다. 환경별로 저장소를 분리한다. 저장소 미설정·장애 시 Apple만 실패하며 인메모리 fallback은 없다. 추가 패키지 없이 서버 `$fetch`를 사용한다.
- 저장소에는 nonce와 일회성 가입 토큰이 잠시 저장된다. 접근 권한·HTTPS·보관 정책을 확인하고 명령/요청 본문 로그에 민감값을 남기지 않는다. 로그인 최대 5분, 가입 최대 10분 TTL이다.
- 운영 CSP가 `appleid.cdn-apple.com`의 SDK/공식 버튼 이미지를 허용하고 팝업·COOP 정책이 SDK 메시지를 막지 않는지 확인한다. 보안 헤더를 일괄 완화하지 않았다.

## 인증 흐름

1. 클라이언트 마운트 후 공식 SDK와 동일 출처 `POST /api/web-auth/apple-start`를 준비한다. 공개 Services ID가 없으면 SDK를 로드하지 않는다. 설정·로딩 실패 시 이메일 로그인은 계속 이용할 수 있다.
2. Nuxt가 Spring `POST /api/auth/apple/challenge`를 **body 없이** 호출한다. 32바이트 난수 state를 별도로 생성하고 stateHash/challengeId/nonce/deviceId/returnTo/expiresAt을 공유 저장소에 보관한다. nonce는 변환하지 않는다.
3. SDK `init`에 Services ID, 고정 redirectURI, `scope: email`, state, 원본 nonce, `usePopup: true`를 전달한다. 버튼 클릭에서 추가 await 없이 `signIn()`을 호출해 팝업을 연다. Google 아래 버튼은 Apple 공식 생성 이미지의 검은 배경·흰 로고/문자를 사용한다.
4. SDK의 **`authorization.id_token`, `authorization.code`, `authorization.state`**를 읽는다. 클라이언트가 state/만료/필수 필드를 확인한 후 동일 출처 JSON `POST /api/web-auth/apple`로 보낸다. Apple `user`/name/email 객체는 인증 입력으로 사용하지 않는다.
5. Nuxt가 시도 검증 후 Spring `POST /api/auth/apple`에 identityToken, 필수 authorizationCode, **서버 저장값** challengeId/deviceId를 전달한다. Spring이 JWT와 code 교환을 검증하고 검증된 audience로 iOS/웹을 구분한다. 임의 client/audience/redirect_uri 필드를 추가하지 않는다.
6. 기존 사용자: 공통 `establishWebSession` → `/api/users/me` 확인 → 기존 HttpOnly 서비스 쿠키 저장 → useAuth 갱신. 시작할 때 서버에 저장한 `/` 또는 정확한 `/mypage`로만 이동한다.
7. 신규 사용자: `SIGNUP_REQUIRED`의 signupToken은 **서버에만** 저장한다. 브라우저에는 status/만료 시간과 가입 시도 식별 HttpOnly 쿠키만 전달한다. Google과 같은 nickname 정규화/검증 유틸리티, 약관 원문 JSON, BaseButton, useAuth를 재사용한다.
8. 닉네임·만 14세 이상·이용약관·개인정보 필수 동의 후 `apple-complete`를 요청한다. Spring `/api/auth/apple/complete`에는 서버 저장 signupToken/deviceId, nickname, `ageConfirmed: true`, `consents: {termsOfService:true, privacyPolicy:true, marketing:false}`를 보낸다. 201 토큰 응답 이후 동일한 공통 세션 처리를 한다.

## 보안과 오류 처리

- `__Host-plave_apple_attempt` 난수 쿠키가 현재 브라우저를 서버 시도와 연결한다. Secure/HttpOnly/SameSite=Lax/Path=/, Domain 없음이다. 저장소 키에는 세션 식별자/state의 해시를 사용하며 stateHash는 상수시간 비교한다. 서버 만료와 저장 deviceId도 검사한다.
- `GETDEL`로 시도를 원자적으로 한 번 소비한다. 다른 브라우저/state 불일치/만료/재전송은 Spring 호출 전에 거부한다. 로그인 후 목적지는 시작 시 `/mypage`만 추가 허용하며 그 외 입력은 `/`로 처리한다.
- 디코딩한 JWT nonce 비교는 시도 연결 확인일 뿐이다. **동일 원문 JWT**는 Spring의 서명/issuer/시간/audience/nonce 검증을 반드시 통과해야 한다.
- 기존 Origin/JSON 검증 유지. Apple 완료 요청만 최대 16,384자 토큰/code를 수용하는 40,000바이트 제한을 사용한다. 다른 action 제한은 유지한다. 기존 서비스 쿠키의 HttpOnly/Lax/HTTPS Secure 정책을 유지한다.
- 팝업 결과는 원래 페이지에서 JSON POST하므로 cross-site POST에 Lax 쿠키가 전송된다고 가정하지 않는다. 고정 `apple-return`은 SDK 팝업용 등록 주소다. **redirect/form_post 로그인 fallback은 구현하지 않았다.** 직접 요청은 400으로 거부하며 토큰을 읽거나 세션을 만들지 않는다. Origin 검사를 완화하지 않는다.
- 취소·팝업 차단·SDK 실패·2분 대기 초과·state 만료·code 누락은 안내하고 새 challenge/state로 시작한다. 명시적 취소 후 늦은 SDK 응답은 generation으로 무시한다. 열린 Apple 창을 강제로 닫지는 않는다.
- 이메일/Google/Apple 입력 잠금과 기존 useAuth pending/Web Locks로 중복을 방지한다. 서버에서도 로그인/가입 시도를 원자적으로 소비한다. 인증 요청을 자동 재전송하지 않는다.
- 이메일 충돌은 기존 로그인 방법을 안내하며 자동 연결하지 않는다. nonce/challenge/token 검증 실패와 가입 토큰 만료는 안전한 안내로 치환한다. 토큰·code·state·백엔드 오류 원문을 로그/URL/분석 이벤트에 넣지 않는다. 가입 토큰은 브라우저 메모리에도 전달하지 않는다.
- 가입 완료의 400/409는 Spring 트랜잭션 롤백 계약에 따라 원래 남은 만료 범위에서만 시도를 복원해 닉네임 등을 수정할 수 있다. 네트워크/5xx처럼 성공 여부가 불명확하면 복원·자동 재전송하지 않고 새 Apple 인증을 요구한다.
- 페이지 이탈/여러 탭의 가입 쿠키 교체 등으로 진행 정보를 잃으면 다시 인증한다. 실제 연령 인증이나 계정 자동 연결은 추가하지 않았다. 사용자 조회 실패 시 새 서비스 로그인 쿠키를 저장하지 않는다.

## 수동 확인

아래 항목은 **아직 실행하지 않았다.** 설정 완료 후 승인된 범위에서 확인한다.

- 기존 Google·이메일 로그인/가입, 세션 복원/로그아웃, mypage 복귀 회귀 확인.
- PC/모바일 버튼과 카드 너비, 공식 이미지/SDK 차단, 설정 누락, HTTP/Origin 불일치.
- 기존 Apple 사용자 홈 이동 및 `redirect=/mypage`, 새로고침, HttpOnly/Secure/Lax와 서비스 토큰 비노출.
- 신규 닉네임 형식/중복, 세 필수 동의, 약관 원문, 마케팅 false, 가입 만료·취소·재시작.
- 팝업 취소/차단/시간 초과/늦은 응답, 네트워크 오류, 연속 클릭/동시 탭.
- state 누락/변조/다른 브라우저/기기 변경/만료/재전송, nonce 변조, code 누락, JWT 실패 시 서비스 쿠키 미발급.
- 외부 Origin/비 JSON/과대 본문 거부, 임의 returnTo 홈 fallback, 외부 form_post/직접 Return URL의 세션 미생성.
- 서로 다른 Nuxt 인스턴스에서 시작/완료, 같은 state 동시 완료 중 한 요청만 소비, Redis 장애 시 실패.
- 이메일 충돌 안내와 실제 iOS/웹 동일 계정 subject 일치·혼합 로그인 호환성은 담당자와 확인.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `app/components/auth/AuthForm.vue` | Google 아래 Apple 및 제공자 간 입력 잠금 |
| `app/components/auth/AppleLogin.vue` | 공식 버튼·SDK 팝업·취소·오류·가입 UI |
| `app/utils/appleIdentity.ts` | 클라이언트 전용 공식 SDK 로더 |
| `app/composables/useAuth.ts`, `shared/types/auth.ts` | 기존 인증 실행기 확장과 Apple 가입 타입 |
| `server/api/web-auth/[action].post.ts` | 보안 검사 후 Apple 분기/전용 본문 상한 |
| `server/api/web-auth/apple-return.ts` | 비팝업 Return URL 요청 거부 |
| `server/utils/appleWebAuth.ts` | challenge/state/nonce·가입·세션 연계 |
| `server/utils/appleAuthStore.ts` | 공유 Redis REST/원자적 소비 |
| `server/utils/webAuth.ts` | Apple 오류 안내 및 공통 세션 저장 순서 보완 |
| `nuxt.config.ts`, `.env.example` | 공개 ID/서버 설정 분리 |
| `docs/APPLE_LOGIN.md`, `docs/WEB_AUTH.md` | 설정·계약·검증 한계 |

공식 근거: [Apple SDK 설정](https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple), [응답 필드](https://developer.apple.com/documentation/signinwithapplejs/authorizationi), [공식 버튼](https://developer.apple.com/documentation/signinwithapplerestapi/get-a-sign-in-with-apple-button-that-is-center-aligned.), [Apple 웹 지침](https://developer.apple.com/sign-in-with-apple/usage-guidelines-for-websites-and-other-platforms/), [Redis GETDEL](https://redis.io/docs/latest/commands/getdel/), [Redis REST](https://upstash.com/docs/redis/features/restapi).
