# 웹 로그인·회원가입

Apple 웹 로그인의 설정·공유 저장소·흐름·확인 범위는 [APPLE_LOGIN.md](./APPLE_LOGIN.md)를 참고한다. 아래 초기 구현의 미지원 설명은 당시 기록이다.

Google 웹 로그인은 후속 구현되었으며 설정·흐름·제약은 [GOOGLE_LOGIN.md](./GOOGLE_LOGIN.md)를 참고한다. 아래 초기 구현의 소셜 로그인 미지원 설명은 당시 기록이다.

마이페이지의 후속 기능 구현 현황은 [MYPAGE.md](./MYPAGE.md)를 우선 참고한다. 아래의 초기 구현 범위 및 기능 미구현 표기는 당시의 기록이다.

## /mypage 보호 페이지 추가

`app/middleware/auth.ts`가 `/mypage` 접근을 제어한다. 직접 접근·새로고침은 `server/middleware/mypage-auth.ts`에서 기존 `restoreWeb`으로 먼저 인증한다. 쿠키 갱신은 SSR 하위 요청이 아닌 실제 문서 응답에 적용하며, 개인 문서 응답은 `private, no-store`와 `Vary: Cookie`를 설정한다. 아래의 일반 공개 페이지와 달리 마이페이지는 인증된 사용자 상태를 SSR payload에 전달하여 hydration 재이동을 피한다. 토큰은 전달하지 않는다.

클라이언트 이동은 진행 중인 인증 작업을 기다리거나 기존 session API로 확인한 뒤 진입한다. 인증 서버 오류는 503으로 처리하고 비로그인으로 단정하지 않는다. 비로그인은 `/login?redirect=/mypage`로 이동하며 로그인 성공 후 `/mypage`로 복귀한다. 복귀 목적지는 `/mypage`만 허용한다.

PC 프로필 드롭다운·모바일 메뉴의 닉네임을 마이페이지에 연결했다. 화면에는 기존 사용자 응답의 닉네임·이메일만 표시한다. 로그아웃으로 사용자 상태가 제거되면 개인정보를 숨기고 홈으로 이동한다. 브라우저 이력 캐시 복원 시에도 개인정보를 숨긴 상태에서 서버 확인 후 표시한다. API·토큰·쿠키 발급/갱신 규칙은 변경하지 않았다.

추가 수동 확인: 비로그인 직접 접근→로그인→마이페이지 복귀, 유효/만료 세션 새로고침, PC·모바일 닉네임 링크, 마이페이지/헤더 로그아웃과 뒤로가기, 다른 탭 로그아웃 후 복귀, 인증 서버 오류. 빌드·테스트·실제 브라우저 확인은 실행하지 않았다.

## 구현 범위와 근거

RN `src/lib/auth.ts`, `src/lib/signup.ts`, `src/lib/emailVerification.ts`, `src/app/(tabs)/profile/signup.tsx`와 Spring `AuthController`, `UserController`, `EmailVerificationController`, 사용자 입력 정책 및 `RefreshTokenService`를 읽기 전용으로 확인했다. RN·백엔드·DB는 수정하지 않았다.

기존 웹에는 인증 페이지와 토큰 클라이언트가 없고 헤더 버튼은 비활성이었다. `/login`, `/signup`과 공통 폼을 추가했다. 기존 공개 조회·검색·지도·찜·리뷰 코드는 변경하지 않았다. 인증했다고 해당 기능이 새로 활성화되는 것은 아니다.

## 기존 계약과 실제 연결

브라우저는 같은 Origin의 `POST /api/web-auth/{action}`을 호출한다. 이 경로는 Nuxt 웹 중계 경로이며 새로운 Spring API가 아니다. 목적지는 코드에 고정되어 있다.

| action | 기존 백엔드 API | 요청 내용 |
| --- | --- | --- |
| send-code | POST /api/auth/email-verifications | email |
| verify-code | POST /api/auth/email-verifications/verify | email, code(6자리) → signupProof |
| signup | POST /api/users | email, password, nickname, signupProof, ageConfirmed, consents |
| login | POST /api/auth/login | email, password, deviceId |
| session | GET /api/users/me | Bearer accessToken |
| session 갱신 | POST /api/auth/refresh | refreshToken, deviceId → 회전된 토큰 쌍, 이후 /me 재조회 |
| logout | POST /api/auth/logout | refreshToken, deviceId |

이메일은 trim·소문자화한다. 비밀번호는 영문·숫자를 포함하는 공백 없는 ASCII 8~72자, 닉네임은 NFC 정규화 후 문자·십진 숫자·결합 기호·밑줄 2~10자다. 이메일 인증·만 14세 이상 확인·이용약관/개인정보 동의를 요구한다. 마케팅 동의는 RN과 같이 false다. 가입 성공 시 로그인 페이지로 이동하며 자동 로그인하지 않는다. 중복 이메일/닉네임은 백엔드의 최종 검증 결과를 안내한다.

약관은 RN `src/content/policies.ts`의 한국어 terms/privacy를 `app/content/authPolicies.json`에 원문 보존한 스냅샷이다. 기존 원문 내 서비스명은 팝카이브이므로 더플레이브 명칭 및 실제 웹 적용 범위는 운영 전 확인이 필요하다. 정책을 임의로 재작성하지 않았다.

## 인증 상태와 저장

- Spring은 BCrypt 비밀번호 검증, access JWT(코드상 30분), 기기 ID에 묶인 refresh token(7일) 및 회전을 제공한다. 웹은 별도 인증 시스템이나 JWT 발급 기능을 만들지 않는다.
- 토큰은 웹 Origin의 HttpOnly·SameSite=Lax·Path=/ 쿠키에만 저장한다. HTTPS 요청에서는 Secure를 적용한다. localStorage·SSR payload·브라우저 JavaScript에 토큰을 넣지 않는다. 쿠키는 Domain을 설정하지 않는다.
- access JWT도 refresh 유효기간까지 쿠키에 유지하지만, 인증 유효성은 항상 백엔드가 판단한다. /me의 401 후 기존 refresh API로 한 번 갱신하고 재조회한다. 무효한 refresh는 쿠키를 제거한다. 일시적 네트워크/서버 오류에서는 쿠키를 보존하고 재시도를 안내한다.
- SSR과 최초 hydration은 비로그인 화면으로 통일한다. 마운트 후 /me로 복원하므로 새로고침 직후 잠시 로그인 버튼이 보일 수 있다. 서버에서 로그인 사용자 전용 콘텐츠를 렌더링하는 기능은 이번 범위에 없다.
- 클라이언트 전역 useState로 사용자·요청 상태를 공유한다. 창 포커스와 로그인 상태의 보이는 탭에서 60초마다 복원한다. 요청 중 재제출을 막고 자동 HTTP 재시도는 하지 않는다.
- Web Locks 지원 브라우저에서는 탭 간 인증 요청을 직렬화한다. Nitro 인스턴스 내 중복 갱신은 하나로 합쳐 5초간 결과를 공유한다. Web Locks 미지원 브라우저가 여러 서버 인스턴스에 동시에 요청하는 상황까지 보장하는 분산 잠금은 없다. 해당 동시성은 배포 환경에서 확인해야 한다.
- 로그아웃은 기존 refresh 폐기 API와 쿠키 삭제를 수행한다. 백엔드 오류가 나도 Nuxt에 요청이 도달하면 쿠키를 삭제한다. 브라우저와 Nuxt 사이의 완전한 네트워크 단절에서는 HttpOnly 쿠키 삭제를 보장할 수 없으므로 연결 복구 후 다시 로그아웃해야 한다. 이미 발급된 access JWT의 즉시 폐기는 기존 백엔드 정책에 따른다.

## 요청 보호 및 운영 설정

중계 경로는 JSON·동일 Origin POST만 허용하고 개인 응답을 `private, no-store`로 반환한다. 원본 오류·비밀번호·토큰을 로그나 응답에 넣지 않는다. 한국어 오류 안내는 JSON data.message로 전달한다. 입력 필드를 제한하고 임의 URL 중계를 제공하지 않는다.

기존 서버 전용 `NUXT_API_BASE`를 사용하며 기본값은 `https://api.theplave.co.kr`다. 새로운 환경변수나 패키지는 추가하지 않았다. 배포 시 다음을 확인한다.

- Nuxt/Nitro 서버가 실제 실행되는 배포여야 한다. 정적 파일만 호스팅하는 방식은 지원하지 않는다.
- HTTPS, 외부 Origin/Host와 전달된 프로토콜이 일치하는 리버스 프록시 설정, Set-Cookie 전달 및 인증 POST 캐시 제외를 확인한다. 프록시 뒤의 Origin 비교는 배포 환경에서 확인해야 한다.
- Spring 코드상 CORS 허용 목록은 RN 개발 Origin(8081)들이다. 브라우저가 Spring을 직접 호출하지 않아 웹 Origin 추가를 전제로 하지 않는다. Nuxt에서 백엔드로의 네트워크 접근은 필요하다.
- 이메일 발송 환경과 운영 API의 현재 배포 버전은 확인하지 않았다.
- RN에는 Google·Apple 네이티브 로그인이 있다. 웹용 OAuth 클라이언트·Origin·SDK 설정이 확인되지 않아 웹 소셜 로그인은 추가하지 않았다.

## 정적 검토와 수동 확인

파일·API 계약·분기 코드를 읽어 검토했다. API 실호출, 빌드, 타입 검사, 테스트, 개발 서버, 브라우저 자동화 및 배포는 실행하지 않았다. 실행 동작 검증 완료를 의미하지 않는다.

수동 확인 항목:

1. 회원가입: 이메일 발송/재전송 제한, 틀린/만료된 인증번호, 인증 후 이메일 변경 시 초기화, 비밀번호 확인, 닉네임 중복, 필수 동의, 가입 후 로그인 이동.
2. 로그인: 정상/오입력, 서버·네트워크 오류, 빠른 연속 제출, 모바일/데스크톱 헤더 전환.
3. 상태: 새로고침·직접 URL 접근·창 복귀, access 만료 후 갱신, 무효 refresh의 로그아웃 상태 복원.
4. 로그아웃: 다른 탭, 갱신 동시 실행, 서버 오류와 완전한 네트워크 단절을 구분해 확인.
5. 배포: Secure/HttpOnly/SameSite 쿠키, Origin 검사, 개인 응답 캐시 제외, 운영 약관 및 이메일 발송 확인.

관련 문서: [API 연결](./API_INTEGRATION.md), [디자인 시스템](./WEB_DESIGN_SYSTEM.md).
