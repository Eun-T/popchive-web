# POPCHIVE 웹 API 연동 사전 조사 보고서

기존 Spring 백엔드를 재사용해 웹을 구현할 수 있습니다. 목록·상세·검색·지도·회원·찜·리뷰·커뮤니티·댓글 API가 이미 있습니다.

가장 중요한 제약은 다음 세 가지입니다.

- **팝업의 자동 인기 TOP 10 산정 로직은 없습니다.** `NOW_HOT`은 운영자가 선택하고 순서를 지정하는 큐레이션입니다.
- **현재 CORS 설정으로는 Nuxt 기본 개발 주소에서 브라우저 직접 호출이 어렵습니다.**
- **이미지는 유효기간 5분인 S3 서명 URL입니다.** 장시간 캐시와 지연 로딩을 함께 고려해야 합니다.

아래 판단은 **두 프로젝트의 조사 당시 작업 디렉터리 코드 기준**입니다. 운영 서버의 배포 버전·DB 스키마·실제 데이터·접속 가능 여부는 확인하지 않았습니다. 조사에서는 파일 생성·수정, 서비스 API 호출, 테스트·빌드, Git commit/push를 하지 않았습니다. 이 파일은 해당 조사 결과를 사용자의 후속 요청에 따라 저장한 것입니다.

---

## 1. 전체 결론과 현재 구조

### 연결 가능성

| 구분 | 판단 |
|---|---|
| 공개 팝업 데이터 | 기존 API 재사용 가능 |
| 홈 메인 캐러셀 | 기존 메인 배너 API 재사용 가능 |
| 최근 등록 팝업 | 기존 목록 API의 등록일 정렬 사용 가능 |
| 운영자 선정 TOP 10 | `NOW_HOT` 재사용 가능 |
| 조회수·기간별 인기도 기반 TOP 10 | 기존 구현 없음 |
| 한국어·일본어 팝업 콘텐츠 | 기존 번역 조회·fallback 재사용 가능 |
| 이메일 로그인·회원가입 | 기존 인증 계약 재사용 가능 |
| 찜·리뷰·게시글·댓글 | 기존 API 재사용 가능 |
| 웹의 현재 구현 상태 | 홈 UI와 임시 데이터 중심. 실제 API 연동 없음 |

**권장 구조는 Nuxt SSR + Nuxt 서버 API 경유입니다.** 백엔드의 기존 계약을 유지하면서 CORS와 인증 전달을 웹 서버에서 처리할 수 있습니다.

### 실제 디렉터리 구조

**웹**

```text
app/
  app.vue
  pages/
    index.vue
    design.vue
  layouts/
    default.vue
    preview.vue
  components/
    home/
    layout/
    ui/
  assets/css/
server/                 # 현재 비어 있음
public/
docs/
  DECISIONS.md
  WEB_DESIGN_SYSTEM.md
  RN_DESIGN_SYSTEM_AUDIT.md
```

- 현재 페이지는 `/`, `/design`입니다.
- 탐색·지도·상세·커뮤니티·로그인·회원가입 페이지는 없습니다.
- `app/composables`, `app/plugins`, `app/middleware`, `server/api`도 없습니다.
- API Base URL, `runtimeConfig`, API 호출 코드, 루트 `.env*` 파일을 확인하지 못했습니다.
- 실제 설치 버전은 Nuxt **4.6.2**, Vue **3.5.44**, Tailwind CSS **4.3.3**, Embla **8.6.0**입니다.

근거: [nuxt.config.ts](C:/dev/popchive-web/nuxt.config.ts:3), [package.json](C:/dev/popchive-web/package.json:13), [AppHeader.vue](C:/dev/popchive-web/app/components/layout/AppHeader.vue:5)

**백엔드**

```text
src/main/java/org/popku/
  popup/        # 공개 팝업 조회·검색·지도·찜
  home/         # 메인 배너·NOW_HOT
  users/        # 회원가입·내 정보
  security/     # JWT·refresh·Google·Apple 인증
  email/        # 이메일 인증
  community/    # 게시글·리뷰·댓글·좋아요
  admin/        # 팝업·번역·태그·지역·배너 관리
  config/
src/main/resources/
  application.properties
  org/popku/**/mapper/*.xml
  sql/
docs/
```

Spring Boot 프로젝트가 아니라 **Spring MVC 5.3.37 + Spring Security 5.8.13 + MyBatis** 기반 WAR 프로젝트입니다. Java 17, Tomcat 9 배포 구성이 있습니다.

근거: [build.gradle](C:/dev/popku-be/build.gradle:1), [RootConfig.java](C:/dev/popku-be/src/main/java/org/popku/config/RootConfig.java:22), [Dockerfile](C:/dev/popku-be/Dockerfile:1)

백엔드 루트 `README`와 `AGENTS.md`는 없습니다. API 문서는 `docs/`에 분산되어 있습니다. 과거 감사 문서에는 현재 코드보다 오래된 내용이 있어 Controller·Service·SQL을 우선했습니다.

Git 상태는 조사 전후 동일했습니다. 웹에는 기존 untracked 파일들이 있고, 백엔드에는 기존 `application.properties` 수정과 여러 untracked 파일이 있습니다. 이 보고서는 그 상태를 포함합니다.

---

## 2. API 목록과 실제 계약

분류는 다음과 같습니다.

- **A:** 기존 응답을 별도 계약 보완 없이 사용할 수 있음
- **B:** 기존 API를 사용하되 웹의 변환·화면·상태·인증 처리가 필요함
- **C:** 요구한 기능을 그대로 제공하려면 백엔드 기능 추가가 필요함

A도 현재 웹에 연결되어 있다는 뜻은 아닙니다.

### 2-1. 팝업·홈·필터 API

아래 표의 Controller 표기는 다음 파일과 줄 번호입니다.

- **P:** [PublicPopupController.java](C:/dev/popku-be/src/main/java/org/popku/popup/controller/PublicPopupController.java:30)
- **F:** [PublicFilterOptionsController.java](C:/dev/popku-be/src/main/java/org/popku/popup/controller/PublicFilterOptionsController.java:24)
- **H:** [HomeCurationController.java](C:/dev/popku-be/src/main/java/org/popku/home/controller/HomeCurationController.java:17)
- **M:** [PublicMainBannerController.java](C:/dev/popku-be/src/main/java/org/popku/home/controller/PublicMainBannerController.java:15)

| Method / 실제 Endpoint | 용도·요청 | 응답 | 인증 | 페이지네이션·정렬 | 판단 / 위치 |
|---|---|---|---|---|---|
| GET `/api/popups` | 일반 목록. 아래 필터 참고 | `ListResponse` | 불필요 | 기본 전체 반환, 등록일 내림차순 | B / P:99 |
| GET `/api/popups?limit=10` | 탐색 목록. `cursor` 지원 | `PageResponse` | 불필요 | 10개, 등록일 내림차순 cursor | B / P:99 |
| GET `/api/popups?homeNew=true` | 지정 주에 시작하는 팝업 | `ListResponse` | 불필요 | 최대 8개, 시작일 오름차순 | B / P:120 |
| GET `/api/main-banners` | `languageCode` 선택 | 배너용 `ListResponse` | 불필요 | 운영자 지정 순서, 페이지 없음 | B / M:15 |
| GET `/api/home-curations/NOW_HOT` | `countryCode` 필수, `languageCode` 선택 | `ListResponse` | 불필요 | 운영자 지정 순서, 페이지 없음 | B / H:17 |
| GET `/api/popups/{publicId}` | 상세, `languageCode` 선택 | `DetailResponse` | 불필요. 로그인 시 개인 찜 반영 | 해당 없음 | B / P:71 |
| GET `/api/popups/search` | `q`, `limit`, `languageCode` | `SearchResponse` | 불필요 | 최대 10개, 관련도·시작일 정렬, cursor 없음 | B / P:43 |
| GET `/api/popups/map` | 지도 bounds, `languageCode` | `MapResponse` | 불필요 | 페이지 없음, 진행 중 팝업 | B / P:55 |
| GET `/api/regions` | `countryCode=KR\|JP` 필수 | `[{id,name}]` | 불필요 | `sort_order`, ID 순 | A / F:24 |
| GET `/api/tags` | 파라미터 없음 | `[{id,name}]` | 불필요 | ID 순, 페이지 없음 | A / F:33 |
| GET `/api/popups/venues` | `languageCode` 선택 | `VenuesResponse` | 불필요 | 장소별 팝업 수, 페이지 없음 | B / P:30 |
| GET `/api/popups/venues?venueId=…` | 장소 ID 또는 key, 언어 선택 | `VenuePopupsResponse` | 불필요 | 등록일 내림차순, 페이지 없음 | B / P:36 |
| GET `/api/users/me/favorites` | `languageCode` 선택 | `ListResponse` | 필요 | 찜 등록일 내림차순, 페이지 없음 | B / P:80 |
| POST `/api/popups/{publicId}/favorite` | 찜 추가. body 없음 | `FavoriteResponse` | 필요 | 해당 없음 | B / P:87 |
| DELETE `/api/popups/{publicId}/favorite` | 찜 해제. body 없음 | `FavoriteResponse` | 필요 | 해당 없음 | B / P:93 |

공개·인증 구분은 [SecurityConfig.java](C:/dev/popku-be/src/main/java/org/popku/security/config/SecurityConfig.java:78)에서 확인했습니다.

### 목록 필터와 모드별 주의사항

일반 목록·페이지 목록에는 다음 파라미터가 있습니다.

| 파라미터 | 실제 의미 |
|---|---|
| `countryCode` | 국가 필터. 일반 목록 Controller는 대문자 2자리 검증 |
| `regionIds` | 쉼표로 구분한 양의 정수 ID |
| `tagIds` | 쉼표로 구분한 양의 정수 ID. 지정 태그 중 하나에 해당하면 포함 |
| `status` | `ONGOING`, `UPCOMING`, `ENDED` |
| `visitPeriod` | `all`, `today`, `week`, `weekend` |
| `openingFrom`, `openingTo` | **시작일** 범위 |
| `operatingFrom`, `operatingTo` | 해당 기간과 운영 기간이 겹치는 팝업 |
| `endingSoon=true` | 현재 진행 중이며 5일 이내 종료. 최대 7개, 종료일순 |
| `hasReservation=true` | 현재 예약 접수 기간에 해당하는 데이터 |
| `hasBenefits=true` | 혜택 텍스트가 있는 데이터 |
| `languageCode` | `ko`, `ja` |
| `limit=10`, `cursor` | 등록일 기준 페이지 목록 |
| `weekStart`, `weekEnd` | 월요일~일요일의 주간 모드. 최대 9개, cursor 없음 |

**같은 `/api/popups`라도 모드에 따라 응답과 기본 조건이 다릅니다.**

- 일반 목록은 `{popups}`이며 기본적으로 종료 팝업을 일괄 제외하지 않습니다.
- `limit=10` 모드는 `{popups,nextCursor}`이며 기본적으로 종료 팝업을 제외합니다.
- `sort=popular` 같은 임의 정렬 선택 계약은 없습니다.
- 기간·주간·홈 신규 모드는 조합 제약이 있으므로 하나의 자유로운 필터 API로 취급하면 안 됩니다.

근거: [Controller 모드 분기](C:/dev/popku-be/src/main/java/org/popku/popup/controller/PublicPopupController.java:99), [페이지·cursor 처리](C:/dev/popku-be/src/main/java/org/popku/popup/service/PublicPopupService.java:240), [실제 필터·정렬 SQL](C:/dev/popku-be/src/main/resources/org/popku/popup/mapper/PublicPopupMapper.xml:141)

**`homeNew=true`의 필수 조건**

- `countryCode=KR|JP`
- `openingFrom`은 월요일
- `openingTo`는 그 주 일요일
- `limit=8`
- 지역·태그·status·cursor 등과 혼합 불가

이는 **최근 등록 8개가 아니라, 지정 주에 시작하며 아직 종료되지 않은 팝업 최대 8개**입니다. 시작일 오름차순입니다.

근거: [검증 조건](C:/dev/popku-be/src/main/java/org/popku/popup/controller/PublicPopupController.java:120), [서비스 호출](C:/dev/popku-be/src/main/java/org/popku/popup/service/PublicPopupService.java:289), [SQL 정렬 분기](C:/dev/popku-be/src/main/resources/org/popku/popup/mapper/PublicPopupMapper.xml:241)

### 주요 응답 DTO

**일반 목록의 팝업 한 개**

```text
publicId, name, countryCode,
regionId, regionName,
latitude, longitude,
startDate, endDate,
coverImageUrl, coverImageCacheKey,
tags: [{id, name}]
```

`createdAt`은 정렬에 사용하지만 공개 목록 응답 필드에는 없습니다. 목록에는 `favoriteCount`, `isFavorited`, 조회수도 없습니다.

**메인 배너**

```text
placeId, publicId, name, countryCode,
regionId, regionName, startDate, endDate,
coverImageUrl, coverImageCacheKey,
backgroundColors: [색상 3개]
```

국가·상태 필터 파라미터가 없고, 선택된 전체 배너를 운영자 순서로 반환합니다.

**상세**

```text
publicId, name, countryCode, regionId, regionName,
address, locationDetail, latitude, longitude,
startDate, endDate, operatingHours,
reservationStartAt, reservationEndAt, reservationUrl,
notice, benefits, tags,
coverImageUrl, contentImageUrls,
socialLinks,
favoriteCount, isFavorited,
summary, highlights: [{type, text}],
averageRating, reviewCount,
coverImageCacheKey
```

**검색**

```text
{ popups: [{id, name, latitude, longitude, address, regionName}] }
```

여기서 `id`는 공개 상세의 `publicId`입니다. 검색 결과에는 이미지·운영 기간·태그가 없습니다.

**지도**

```text
{ popups: [{
  id, name, latitude, longitude, primaryTag,
  startDate, endDate, coverImageUrl, tags
}] }
```

지도 응답에는 `countryCode`, 주소, 지역명, `coverImageCacheKey`가 없습니다.

**찜 변경**

```text
{ publicId, isFavorited, favoriteCount }
```

근거: [PublicPopupRows.java](C:/dev/popku-be/src/main/java/org/popku/popup/dto/PublicPopupRows.java:14), [PublicMainBannerRows.java](C:/dev/popku-be/src/main/java/org/popku/home/dto/PublicMainBannerRows.java:18)

### 검색·지도 API의 범위

검색은 다음 조건입니다.

- `q`: 공백 제거 후 2~100 Unicode 문자
- `limit`: 기본 10, 허용 1~10
- 이름 완전 일치 → 접두 일치 → 부분 일치 순
- 같은 관련도 안에서는 시작일 내림차순
- 좌표가 없는 팝업은 검색 대상에서 제외
- 국가·지역·태그 필터와 페이지네이션 없음

지도는 다음 조건입니다.

- `minLat`, `maxLat`, `minLng`, `maxLng`를 생략하거나 **4개 모두** 전달
- 좌표가 있고 **오늘 진행 중인 팝업만** 반환
- 국가·지역·태그·예정 상태 필터 없음

따라서 탐색 화면의 종합 검색과 지도 검색을 이 두 API가 전부 해결한다고 보기는 어렵습니다. 초기에는 목록 API의 데이터와 조합하거나 작은 데이터셋을 프론트에서 필터링할 수 있습니다.

근거: [검색·지도 Controller](C:/dev/popku-be/src/main/java/org/popku/popup/controller/PublicPopupController.java:43), [검색·지도 SQL](C:/dev/popku-be/src/main/resources/org/popku/popup/mapper/PublicPopupMapper.xml:44)

### 2-2. 로그인·회원가입 API

위치는 다음 파일 기준입니다.

- **Auth:** [AuthController.java](C:/dev/popku-be/src/main/java/org/popku/security/controller/AuthController.java:67)
- **User:** [UserController.java](C:/dev/popku-be/src/main/java/org/popku/users/controller/UserController.java:39)
- **Email:** [EmailVerificationController.java](C:/dev/popku-be/src/main/java/org/popku/email/controller/EmailVerificationController.java:18)

아래 API는 페이지네이션·정렬 대상이 아니며, 웹 연결 판단은 모두 **B**입니다.

| Method / Endpoint | 요청 | 응답 | 기존 로그인 필요 | 위치 |
|---|---|---|---|---|
| POST `/api/auth/login` | `email,password,deviceId` | 토큰 응답 | 아니요 | Auth:67 |
| POST `/api/auth/refresh` | `refreshToken,deviceId` | 새 토큰 응답 | access token 불필요 | Auth:81 |
| POST `/api/auth/logout` | `refreshToken,deviceId` | 204 | access token 불필요 | Auth:88 |
| POST `/api/auth/logout-all` | body 없음 | 204 | 필요 | Auth:94 |
| POST `/api/auth/email-verifications` | `email` | 202 | 아니요 | Email:18 |
| POST `/api/auth/email-verifications/verify` | `email,code` | `{signupProof}` | 아니요 | Email:24 |
| GET `/api/users/check-email` | query `email` | `{available}` | 아니요 | User:39 |
| GET `/api/users/check-nickname` | query `nickname` | `{available}` | 아니요 | User:44 |
| POST `/api/users` | 아래 가입 body | 회원 응답, 201 | 아니요 | User:49 |
| GET `/api/users/me` | body 없음 | 회원 응답 | 필요 | User:58 |

**토큰 응답**

```text
tokenType, accessToken, refreshToken,
accessExpiresInSeconds, refreshExpiresInSeconds,
deviceId
```

**회원가입 요청**

```text
email, password, nickname,
consents: {termsOfService, privacyPolicy, marketing},
signupProof, ageConfirmed
```

**회원 응답**

```text
id, email, nickname, profileImageKey,
provider, role, createdAt, updatedAt
```

이메일 인증 후 `signupProof`를 받아 가입해야 합니다. 필수 약관 동의와 만 14세 이상 확인도 검사합니다. **회원가입 응답은 토큰 응답이 아니므로 자동 로그인은 웹에서 별도 흐름을 정해야 합니다.**

근거: [가입 검증](C:/dev/popku-be/src/main/java/org/popku/users/service/UserService.java:67)

소셜 로그인도 존재합니다.

| Method / Endpoint | 요청·응답 | 웹 적용 판단 |
|---|---|---|
| POST `/api/auth/google` | `idToken,deviceId` → 토큰 또는 `SIGNUP_REQUIRED,signupToken,expiresInSeconds` | B. 웹 Google 로그인과 client ID 설정 확인 필요 |
| POST `/api/auth/google/complete` | `signupToken,nickname,consents,deviceId,ageConfirmed` → 토큰 | B |
| POST `/api/auth/apple/challenge` | challenge 발급 | 기존 계약은 RN 중심 |
| POST `/api/auth/apple` | `identityToken,authorizationCode,challengeId,deviceId` → 토큰 또는 가입 필요 | 브라우저용 설정 호환성 별도 확인 필요 |
| POST `/api/auth/apple/complete` | 가입 토큰·닉네임·동의·기기 ID·연령 확인 → 토큰 | 위 조건에 따름 |

Google은 `google.web-client-id`를 audience로 검사합니다. Apple은 단일 `apple.bundle-id` audience를 검사하므로 **현재 코드만으로 브라우저 Apple 로그인이 그대로 호환된다고 확정할 수 없습니다.**

근거: [Google 검증](C:/dev/popku-be/src/main/java/org/popku/security/service/GoogleIdTokenVerifierService.java:22), [Apple Controller](C:/dev/popku-be//src/main/java/org/popku/security/controller/AppleAuthController.java:19), [Apple audience 검증](C:/dev/popku-be/src/main/java/org/popku/security/service/AppleIdTokenVerifierService.java:19)

### 2-3. 커뮤니티·리뷰·댓글 API

위치는 다음 파일 기준입니다.

- **Feed:** [CommunityFeedController.java](C:/dev/popku-be/src/main/java/org/popku/community/controller/CommunityFeedController.java:21)
- **Post:** [CommunityPostController.java](C:/dev/popku-be/src/main/java/org/popku/community/controller/CommunityPostController.java:21)
- **Edit:** [CommunityPostEditController.java](C:/dev/popku-be/src/main/java/org/popku/community/controller/CommunityPostEditController.java:14)
- **Review:** [ReviewController.java](C:/dev/popku-be/src/main/java/org/popku/community/controller/ReviewController.java:16)
- **Comment:** [CommunityCommentController.java](C:/dev/popku-be/src/main/java/org/popku/community/controller/CommunityCommentController.java:14)
- **Like:** [CommunityLikeController.java](C:/dev/popku-be/src/main/java/org/popku/community/controller/CommunityLikeController.java:12)

모두 기존 API를 재사용할 수 있지만, 웹 화면이 미구현이므로 판단은 **B**입니다.

| Method / Endpoint | 요청·응답 | 인증 | 페이지·정렬 | 위치 |
|---|---|---|---|---|
| GET `/api/community/feed` | `category,sort,cursor,limit` → 피드 | 선택 | cursor, 기본 20·최대 50 | Feed:32 |
| GET `/api/community/posts/{id}` | 게시글 상세 | 선택 | 없음 | Feed:27 |
| POST `/api/community/posts` | `category,content,uploadToken` → `{id}` | 필요 | 없음 | Post:21 |
| GET `/api/community/posts/{id}/edit` | 수정용 상세 | 작성자 | 없음 | Edit:14 |
| PATCH `/api/community/posts/{id}` | `content,retainedImageIds,uploadToken` → 상세 | 작성자 | 없음 | Edit:18 |
| DELETE `/api/community/posts/{id}` | 204 | 작성자 | 없음 | Edit:23 |
| POST `/api/community/posts/{id}/like` | `{liked,likeCount}` | 필요 | 토글 | Like:12 |
| GET `/api/popups/{publicId}/reviews` | `cursor` → 피드 형식 | 선택 | 20개, ID 내림차순 | Review:45 |
| POST `/api/popups/{publicId}/reviews` | `rating,content,uploadToken` → `{id}` | 필요 | 없음 | Review:50 |
| GET `/api/community/reviews/{reviewId}` | 리뷰 상세 | 선택 | 없음 | Review:35 |
| GET `/api/community/reviews/{reviewId}/edit` | 수정용 상세 | 작성자 | 없음 | Review:16 |
| PATCH `/api/community/reviews/{reviewId}` | `rating,content,retainedImageIds,uploadToken` → 상세 | 작성자 | 없음 | Review:20 |
| DELETE `/api/community/reviews/{reviewId}` | 204 | 작성자 | 없음 | Review:25 |
| POST `/api/community/reviews/{reviewId}/like` | `{liked,likeCount}` | 필요 | 토글 | Review:30 |
| GET `/api/users/me/posts` | `cursor` → 피드 | 필요 | 20개, ID 내림차순 | Feed:21 |
| GET `/api/users/me/reviews` | `cursor` → 피드 | 필요 | 20개, ID 내림차순 | Review:40 |

피드 필터는 다음과 같습니다.

- `category`: `ALL`, `REVIEW`, `QUESTION`, `FREE`
- `sort`: `LATEST`, `POPULAR`
- `POPULAR`: **좋아요 수 내림차순**, 이후 작성일·타입·ID 순
- 게시글 작성 category는 `QUESTION`, `FREE`

이 `POPULAR`는 **게시글·리뷰의 인기순**입니다. 팝업 인기순이 아닙니다.

근거: [피드 조건 검증](C:/dev/popku-be/src/main/java/org/popku/community/controller/CommunityFeedController.java:32), [피드 정렬 SQL](C:/dev/popku-be/src/main/resources/org/popku/community/mapper/CommunityFeedMapper.xml:87)

댓글은 게시글·리뷰에 각각 존재합니다.

| Method / Endpoint | 요청·응답 | 인증·페이지 | 위치 |
|---|---|---|---|
| GET `/api/community/posts/{id}/comments` | `{items,commentCount}` | 선택, 전체 반환 | Comment:28 |
| POST `/api/community/posts/{id}/comments` | 댓글 body → `{item,commentCount}` | 필요 | Comment:37 |
| DELETE `/api/community/posts/{id}/comments/{commentId}` | `{commentCount}` | 작성자 | Comment:32 |
| GET `/api/community/reviews/{id}/comments` | `{items,commentCount}` | 선택, 전체 반환 | Comment:19 |
| POST `/api/community/reviews/{id}/comments` | 댓글 body → `{item,commentCount}` | 필요 | Comment:23 |
| DELETE `/api/community/reviews/{id}/comments/{commentId}` | `{commentCount}` | 작성자 | Comment:14 |

댓글 body는 `content,parentCommentId,replyToUserId`입니다. 답글 대상은 특정 댓글 ID 대신 **스레드 안의 사용자 ID**를 받습니다.

**커뮤니티 DTO의 차이**

| DTO | 주요 구조 |
|---|---|
| 피드 | `{items,nextCursor}` |
| 피드 item | `type,id,category,author,content,createdAt,regionName,popup,rating,images,likeCount,commentCount,viewCount,liked` |
| 게시글 상세 | `id,category,author,content,createdAt,updatedAt,images,likeCount,commentCount,viewCount,liked,isOwner,imageIds` |
| 리뷰 상세 | `id,type,rating,content,createdAt,updatedAt,author,popup,images,likeCount,commentCount,liked,isOwner` |
| 댓글 item | `id,content,createdAt,updatedAt,author,parentCommentId,replyToUser,isOwner,isBlocked,isHidden` |

피드·게시글의 `images`는 URL 문자열 배열이지만, 리뷰 상세는 `{id,url}` 배열입니다. 웹 공통 이미지 컴포넌트 앞에서 정규화가 필요합니다.

근거: [CommunityFeedRows.java](C:/dev/popku-be/src/main/java/org/popku/community/dto/CommunityFeedRows.java:36), [ReviewRows.java](C:/dev/popku-be/src/main/java/org/popku/community/dto/ReviewRows.java:7), [CommunityCommentRows.java](C:/dev/popku-be/src/main/java/org/popku/community/dto/CommunityCommentRows.java:8)

리뷰는 별점 정수 1~5, 사용자당 팝업 하나에 리뷰 하나로 제한됩니다. API는 있으나 **실제 방문을 증명하는 기능이 있다는 근거는 없습니다.**

근거: [ReviewService.java](C:/dev/popku-be/src/main/java/org/popku/community/service/ReviewService.java:25)

사진 첨부용 API도 있습니다.

- POST·DELETE `/api/community/post-image-uploads`
- POST·DELETE `/api/popups/{publicId}/review-image-uploads`

발급 요청은 `count,contentType,version,sizeBytes`, 응답은 `uploadToken,images[{imageKey,uploadUrl,contentType,sortOrder}]`입니다. 로그인과 별도 업로드 상태 처리가 필요합니다.

근거: [CommunityImageController.java](C:/dev/popku-be/src/main/java/org/popku/community/controller/CommunityImageController.java:19), [CommunityImageRows.java](C:/dev/popku-be/src/main/java/org/popku/community/dto/CommunityImageRows.java:7)

### 명시적으로 없는 기능

| 기능 | 조사 결과 | 백엔드 변경 없이 가능한 대안 |
|---|---|---|
| 팝업 자동 인기 랭킹 API | **없음** | 운영자 선정 `NOW_HOT` |
| 팝업 조회수 조회·증가 API | **없음** | 조회수 기반 표시 보류 |
| 별도 신규 팝업 Endpoint | **없음** | 기존 `/api/popups` 모드 사용 |
| 국가 목록 API | **없음** | 현재 지원 국가 KR·JP를 웹에서 관리 |
| 별도 공개 카테고리 API | **없음** | `/api/tags` 재사용 |
| 팝업의 별도 좋아요 API | **없음** | 제공된 찜 기능 사용 |
| 댓글 수정 API | **없음** | 작성·삭제만 제공 |
| 댓글 좋아요 API | **없음** | 해당 UI 보류 |

---

## 3. 현재 웹 화면과 API 매칭

| 화면·섹션 | 현재 임시 데이터 | 기존 API·필요 필드 | DTO 차이·추가 프론트 작업 | 판단 |
|---|---|---|---|---|
| 메인 캐러셀 | 로컬 포스터 3장, 임시 제목·기간·지역 | `/api/main-banners`: `publicId,name,coverImageUrl,startDate,endDate,regionName` | 카드 props로 변환, null·빈 목록·상세 이동 처리 | B |
| 새로 올라온 팝업 | 포스터 3종을 반복한 6개 | 최근 등록 의미라면 `/api/popups?limit=10` | 제목·기간·이미지 변환, 표시 개수 결정 | B |
| 지금 핫한 TOP 10 | 포스터 3종을 반복한 10개 | `/api/home-curations/NOW_HOT` | 배열 순서로 번호 표시. 운영자 선정임을 명확히 해야 함 | B |
| 카테고리 바로가기 | 고정 6개. 현재 홈에서 주석 처리 | `/api/tags`, 국가 필터 | 국가와 카테고리 구분, 실제 태그 ID 연결, 라우팅 | B |
| 팝업 탐색 | 페이지 없음 | `/api/popups`, `/api/regions`, `/api/tags`, 검색 API | 필터·cursor·URL 상태·검색 결과 카드 구성 | B |
| 지도 | 페이지 없음 | `/api/popups/map`의 좌표·이름·태그·이미지 | 지도 SDK, bounds 요청, 마커·선택 상태 | B |
| 팝업 상세 | 페이지 없음 | `/api/popups/{publicId}` | 상세 라우트·SEO·이미지·리뷰·찜 UI | B |
| 커뮤니티 | 페이지 없음 | 피드·게시글·리뷰·댓글 API | 화면·페이지네이션·작성·수정·인증 상태 | B |
| 로그인·회원가입 | 헤더 비활성 버튼 | 인증·이메일 인증·회원 API | 폼·가입 단계·세션·refresh 처리 | B |
| 오늘의 팝업 | 문구만 있는 회색 박스 | 목록의 `visitPeriod=today` 활용 가능 | 어떤 팝업을 몇 개 표시할지 결정 필요 | B |

임시 데이터 근거: [index.vue](C:/dev/popchive-web/app/pages/index.vue:7), [TodayPopupSidebar.vue](C:/dev/popchive-web/app/components/layout/TodayPopupSidebar.vue:1)

### 기존 UI를 유지하는 변환 경계

| 현재 카드 props | 백엔드 필드 |
|---|---|
| `id` | `publicId` |
| `src` | `coverImageUrl` |
| `alt` | `name` 등을 바탕으로 웹에서 작성 |
| `title` | `name` |
| `period` | `startDate`, `endDate`를 웹에서 포맷 |
| `region` | `regionName` |
| `width`, `height` | 응답에 없음. 현재 캐러셀에서는 선택 필드 |

현재 컴포넌트의 props 경계를 유지할 수 있으므로 UI 전체를 다시 만들 필요는 없습니다.

근거: [HomePopupCarousel.vue](C:/dev/popchive-web/app/components/home/HomePopupCarousel.vue:7), [HomeNewPopups.vue](C:/dev/popchive-web/app/components/home/HomeNewPopups.vue:5), [HomeHotRanking.vue](C:/dev/popchive-web/app/components/home/HomeHotRanking.vue:6)

### 문서와 현재 코드의 불일치

연동 작업에서 특히 주의할 부분입니다.

- `DECISIONS.md`의 신규 섹션에는 지역 필터·카테고리 태그·더보기 설명이 있지만, **현재 `HomeNewPopups.vue`에는 없습니다.**
- 문서의 신규 카드 radius 12px·제목 최대 2줄과 달리 현재 코드는 radius 8px·한 줄입니다.
- `WEB_DESIGN_SYSTEM.md`의 초기 캐러셀 기록은 자동 재생·정보 오버레이가 없는 상태를 설명하지만, 현재 코드에는 자동 재생과 정보 오버레이가 있습니다.
- 카테고리는 컴포넌트가 있으나 현재 홈에서 렌더링하지 않습니다.

근거: [DECISIONS.md](C:/dev/popchive-web/docs/DECISIONS.md:19), [현재 신규 섹션](C:/dev/popchive-web/app/components/home/HomeNewPopups.vue:39), [캐러셀 최신 결정](C:/dev/popchive-web/docs/DECISIONS.md:60), [홈 카테고리 주석](C:/dev/popchive-web/app/pages/index.vue:63)

따라서 연동 과정에서 오래된 문서 설명을 따라 UI를 복원하거나 변경하면 안 됩니다.

---

## 4. TOP 10 랭킹 구현 가능 여부

**운영자 선정 TOP 10은 가능합니다. 자동 인기 TOP 10은 현재 구현되어 있지 않습니다.**

### `NOW_HOT`의 실제 로직

1. 관리자가 팝업을 선택합니다.
2. 국가별 최대 10개 등록을 검사합니다.
3. 관리자가 순서를 변경합니다.
4. 공개 API는 저장된 순서로 반환합니다.

SQL은 다음 기준입니다.

```sql
WHERE hc.section_key = 'NOW_HOT'
  AND p.country_code = #{countryCode}
ORDER BY hc.sort_order, hc.id
```

조회수·찜 수·최근 증가량·기간별 점수 계산은 없습니다.

근거: [선택·10개 제한](C:/dev/popku-be/src/main/java/org/popku/home/service/HomeCurationService.java:73), [순서 변경](C:/dev/popku-be/src/main/java/org/popku/home/service/HomeCurationService.java:100), [공개 조회 SQL](C:/dev/popku-be/src/main/resources/org/popku/home/mapper/HomeCurationMapper.xml:5)

추가 제약도 있습니다.

- KR·JP 각각의 목록입니다. 두 국가를 합친 글로벌 인기순은 아닙니다.
- 응답에 점수·집계 기간·rank 필드는 없습니다.
- 진행 중인 팝업만 남기는 날짜 조건도 없습니다.
- 실제 운영 데이터가 10개인지 확인하지 않았습니다.
- 10개보다 적으면 임의 복제해 채우면 안 됩니다.

현재 웹의 순위 숫자는 `index + 1`이므로 운영자 순서 표시에는 재사용할 수 있습니다.

근거: [HomeHotRanking.vue](C:/dev/popchive-web/app/components/home/HomeHotRanking.vue:61)

### C에 해당하는 요구와 최소 변경

| 요구 | 기존 API로 불가능한 이유 | 필요한 최소 변경 | 무변경 대안·제약 |
|---|---|---|---|
| 조회수 기반 자동 TOP 10 | 팝업 조회 이벤트·집계·순위 조회가 없음 | 조회 기록·집계와 정렬 조회 추가 | `NOW_HOT` 사용. 조회수 기반이라고 표시 불가 |
| 최근 일주일 인기도 TOP 10 | 기간별 이벤트·점수 계약 없음 | 집계 기간·지표·동률 기준 확정 후 집계 추가 | 운영자 선정 유지. 자동·주간 순위 보장 불가 |

참고로 모든 팝업의 상세를 호출해 `favoriteCount`를 모으면 웹 서버에서 누적 찜 수를 정렬하는 우회는 가능합니다. 하지만 목록에 찜 수가 없어 **전체 목록 + 팝업 수만큼 상세 요청**이 필요하고, 시점도 일관되지 않습니다. 홈 권장 방식으로 보기 어렵습니다.

**우선 `NOW_HOT`을 운영자 선정으로 사용하고, 자동 랭킹은 별도 기능으로 결정하는 것이 적절합니다.**

---

## 5. 다국어 호환성

### 언어 선택 방식

목록·상세·검색·지도·찜·NOW_HOT·메인 배너는 선택적 query인 `languageCode=ko|ja`를 사용합니다.

- 국가: `countryCode=KR|JP`
- 언어: `languageCode=ko|ja`
- 두 값은 독립적입니다.
- `Accept-Language` 자동 선택 방식은 구현되어 있지 않습니다.

예를 들어 일본 팝업을 한국어로 보는 요청은 국가 JP와 언어 ko를 함께 지정하는 방식입니다.

근거: [언어 검증](C:/dev/popku-be/src/main/java/org/popku/popup/dto/PopupLanguage.java:9), [목록 번역 적용](C:/dev/popku-be/src/main/java/org/popku/popup/service/PublicPopupService.java:119)

### 번역 응답과 fallback

API는 `{ko:{…},ja:{…}}` 형태가 아니라 **선택된 언어를 적용한 기존 DTO**를 반환합니다.

일반 텍스트의 fallback은 다음과 같습니다.

```text
요청 언어의 값
→ 팝업 source_language의 값
→ 기존 원본 컬럼 값
```

번역이 없어도 팝업을 제외하지 않습니다. 목록은 이름을, 상세는 이름·혜택·공지·운영시간을 바꿉니다.

근거: [번역 SQL](C:/dev/popku-be/src/main/resources/org/popku/admin/popup/mapper/PopupTranslationMapper.xml:26), [상세 적용](C:/dev/popku-be/src/main/java/org/popku/popup/service/PublicPopupService.java:328)

`summary/highlights`는 필드별로 섞지 않고 **콘텐츠 묶음 단위**로 fallback합니다. 미작성 상태와 명시적인 빈 배열도 구분합니다. `highlights`는 경우에 따라 null일 수 있으므로 웹에서는 배열 여부를 처리해야 합니다.

근거: [구조화 콘텐츠 SQL](C:/dev/popku-be/src/main/resources/org/popku/admin/popup/mapper/PopupTranslationMapper.xml:17), [현재 계약 문서](C:/dev/popku-be/docs/MULTILINGUAL.md:501)

### 아직 번역되지 않는 범위

- 일반 팝업의 `regionName`, 주소, 상세 위치
- 태그 표시명
- 사용자 게시글·리뷰·댓글
- 커뮤니티 응답에 포함된 팝업명·지역명

백화점 venue 이름에는 별도 `nameKo/nameJa` 선택 로직이 있습니다.

근거: [커뮤니티 SQL](C:/dev/popku-be/src/main/resources/org/popku/community/mapper/CommunityFeedMapper.xml:47), [venue 언어 선택](C:/dev/popku-be/src/main/java/org/popku/popup/dto/PopupVenueRows.java:20)

### 웹에서 필요한 처리

- 국가 선택과 표시 언어 선택을 별도 상태로 관리
- 언어 변경 시 관련 API를 같은 `languageCode`로 다시 요청
- 캐시 키에 국가와 언어 모두 포함
- 목록 필터·cursor·기존 언어 데이터를 일관되게 초기화
- 웹 메뉴·날짜·오류·빈 상태 문구는 별도로 번역
- 현재 고정 `lang="ko"`도 표시 언어와 맞추기

검색은 선택 언어에서 fallback된 표시 제목을 검색합니다. **한국어·일본어 제목을 동시에 모두 검색하는 기능은 없습니다.**

또한 공개 응답에 실제 fallback 언어 메타데이터가 없어, 응답만 보고 어떤 필드가 원문으로 대체되었는지 정확히 판단하기는 어렵습니다.

---

## 6. CORS·인증·SSR 위험 요소

### API Base URL과 환경 구분

**현재 웹**

- API Base URL 설정 없음
- `runtimeConfig` 없음
- 개발·운영 API 분리 없음
- 실제 웹 운영 도메인 미확정

`https://api.popchive.com`은 백엔드 배포 문서에도 나오지만, 이번에는 접속하지 않았습니다.

근거: [nuxt.config.ts](C:/dev/popchive-web/nuxt.config.ts:3), [백엔드 배포 문서](C:/dev/popku-be/docs/cd-deployment.md:133)

**백엔드**

`application.properties`에서 `DB_URL`, `JWT_SECRET`, `AWS_S3_BUCKET` 등 환경변수를 참조합니다. 별도 Spring profile 파일은 확인하지 못했습니다. 비밀 값은 보고서에 포함하지 않았습니다.

웹에는 향후 서버 전용 `runtimeConfig.apiBase`와 `NUXT_API_BASE` 같은 설정을 두는 방향을 권합니다. 백엔드 JWT 서명 키나 AWS 자격증명을 웹에 복사할 필요는 없습니다.

### 현재 CORS 허용 목록

```text
http://localhost:8081
http://127.0.0.1:8081
http://192.168.50.181:8081
http://192.168.50.239:8081
```

- 허용 메서드: GET·POST·PUT·PATCH·DELETE·OPTIONS
- 허용 헤더: Authorization·Content-Type·Accept
- `allowCredentials=true` 설정 없음
- `localhost:3000` 허용 없음
- 공개 웹 운영 Origin 허용 여부는 미확인

근거: [ServletConfig.java](C:/dev/popku-be/src/main/java/org/popku/config/ServletConfig.java:19)

따라서 **현재 소스 설정대로라면 Nuxt 기본 주소에서 브라우저 직접 호출은 CORS에 막힐 가능성이 높습니다.** 실제 운영 reverse proxy의 헤더 설정은 확인하지 않았습니다.

Nuxt 서버가 백엔드를 호출하는 요청은 브라우저 CORS 제한을 받지 않습니다. 이때 브라우저의 `Origin`을 백엔드로 무조건 전달하지 않는 명시적 처리도 필요합니다.

### 인증 전달 계약

백엔드는 쿠키 세션이 아닌 다음 방식입니다.

```text
Authorization: Bearer <accessToken>
```

- access token: 30분
- refresh token: 7일
- refresh 요청에 `refreshToken,deviceId` 필요
- refresh 성공 시 기존 refresh token을 폐기하고 새 토큰 발급
- 로그인 결과는 JSON이며 인증 쿠키를 설정하지 않음

근거: [JWT 필터](C:/dev/popku-be/src/main/java/org/popku/security/filter/JwtAuthenticationFilter.java:47), [토큰 발급](C:/dev/popku-be/src/main/java/org/popku/security/controller/AuthController.java:100), [refresh 회전](C:/dev/popku-be/src/main/java/org/popku/security/service/RefreshTokenService.java:68)

웹에서 특히 필요한 처리는 다음입니다.

- 동일 세션의 refresh 요청을 동시에 여러 번 보내지 않기
- 인증 데이터를 SSR 공유 전역 변수에 저장하지 않기
- 토큰을 Nuxt payload에 넣지 않기
- 로그인 후 찜·피드 등 개인화 캐시 초기화
- 쿠키를 쓰는 Nuxt 인증 계층에는 CSRF 방어 적용

공개 API도 잘못되거나 만료된 Authorization 헤더를 보내면 JWT 필터가 **401로 종료**합니다. 공개 데이터 요청에 오래된 토큰을 무조건 붙이면 안 됩니다.

### 현재 SSR 상태

`ssr:false`가 없고 설치된 Nuxt 기본값은 SSR 활성화입니다. 다만 현재는 API 데이터 SSR이 구현된 상태가 아니라 임시 UI를 렌더링하는 단계입니다.

근거: [Nuxt 설정](C:/dev/popchive-web/nuxt.config.ts:3), [설치된 Nuxt SSR 기본값](C:/dev/popchive-web/node_modules/@nuxt/schema/dist/index.mjs:463)

### 호출 방식 비교

| 기준 | A. 브라우저 직접 호출 | B. Nuxt SSR에서 직접 호출 | C. Nuxt 서버 API 경유 |
|---|---|---|---|
| SEO | 데이터가 늦게 렌더링되어 불리 | 초기 HTML에 반영 가능 | SSR과 함께 사용하면 초기 HTML에 반영 |
| 초기 로딩 | 화면 후 API 대기 | API 응답만큼 HTML 응답 지연 | SSR에서 병렬 처리·캐시 가능 |
| CORS | 현재 설정 제약 있음 | 서버 호출은 영향 없음 | 브라우저는 동일 Origin 호출 |
| 서버 부하 | Nuxt 부담 적음 | SSR 요청마다 백엔드 호출 | Nuxt 처리·중계 부하 추가 |
| API 횟수 | 구현에 따라 중복 가능 | payload 재사용 시 초기 중복 방지 | 경유 자체가 upstream 횟수를 줄이지는 않음 |
| 캐싱 | 브라우저·상태 관리 중심 | SSR 호출 계층에서 별도 설계 | 공개 API별 캐시 관리 용이 |
| 인증 | 브라우저 토큰 관리 필요 | 요청별 토큰 전달 필요 | 웹 쿠키·세션을 Bearer로 변환 가능 |
| 배포 | 정적 배포 가능 | Nuxt 서버 필요 | Nuxt 서버 필요, handler 구현 추가 |

**C를 기본 호출 경로로 두고 공개 페이지를 SSR하는 조합을 추천합니다.**

B만 적용한 뒤 클라이언트 페이지 이동에서는 외부 API를 직접 호출하면 CORS 문제가 다시 생깁니다. SSR과 이후 페이지 이동이 같은 Nuxt API 경로를 사용하도록 하는 편이 일관됩니다.

### hydration 중복 요청 방지

- 초기 조회는 `useFetch` 또는 `useAsyncData`로 수행
- 같은 요청을 `onMounted`에서 다시 실행하지 않기
- key에 국가·언어·필터·cursor 포함
- 같은 key의 handler·변환 옵션을 일관되게 사용
- 필요한 경우 `dedupe:'defer'`로 진행 중 요청 공유
- 빈 목록도 `{popups:[]}` 같은 정상 객체로 반환
- SSR 결과를 payload로 전달하는 기본 동작 유지

설치된 Nuxt 코드에서도 payload 저장과 hydration 재사용을 확인했습니다. 이 기능은 **서로 다른 HTTP 요청까지 영구 캐시하는 기능은 아닙니다.**

근거: [설치된 asyncData.js](C:/dev/popchive-web/node_modules/nuxt/dist/app/composables/asyncData.js:135), [Nuxt 공식 useAsyncData 문서](https://github.com/nuxt/nuxt/blob/main/docs/4.api/2.composables/use-async-data.md)

---

## 7. 중복 API 호출·이미지·성능 개선 방안

### 홈의 세 요청은 서로 다른 데이터입니다

| 섹션 | 데이터 출처 | 다른 목록으로 대체할 때의 문제 |
|---|---|---|
| 메인 캐러셀 | `main_banner_items` | 운영자 배너 선택·순서가 사라짐 |
| 최근 등록 목록 | `places.created_at` 정렬 | 실제 신규 정렬 의미가 달라짐 |
| 지금 핫한 팝업 | `home_curations.sort_order` | 운영자 큐레이션이 사라짐 |

**목록 한 번으로 세 섹션을 모두 대체하는 것은 권하지 않습니다.** 정상적으로는 서로 다른 세 요청이며 병렬 실행할 수 있습니다.

추가 백엔드 API 없이 다음을 우선 적용할 수 있습니다.

- 페이지에서 섹션별 데이터를 한 번씩 가져와 자식에게 props로 전달
- 같은 목록을 여러 컴포넌트가 쓰면 같은 key·상태 공유
- 국가·언어·필터를 정규화해 캐시 키 생성
- 한 섹션 실패가 홈 전체 실패로 번지지 않게 처리
- 탐색 페이지는 cursor 방식 사용
- 지도는 이동 중 매 프레임 대신 이동 완료 시 bounds 요청
- 변경 요청 성공 후 해당 개인 상태만 갱신
- 뒤로 가기에서는 저장된 목록·필터·스크롤 상태 재사용

조회한 공개 서비스에서 응답 캐시·ETag·Cache-Control을 설정하는 구현은 확인하지 못했습니다. **Nuxt 서버 캐시는 향후 추가할 웹 기능**입니다.

### 이미지 응답과 현재 웹 비교

| 항목 | 확인 결과 |
|---|---|
| 대표 이미지 | `coverImageUrl` |
| 상세 이미지 | `contentImageUrls: string[]` |
| URL 형식 | S3 presigner가 생성한 서명 포함 절대 URL |
| URL 유효기간 | **5분** |
| 대표 이미지 없음 | `coverImageUrl=null` 가능 |
| 상세 이미지 없음 | 빈 배열 가능 |
| 대표 이미지 대체 | CONTENT 이미지를 자동 COVER로 쓰지 않음 |
| 이미지 크기 | 공개 DTO에 원본 width·height 없음 |
| 리사이즈 URL | 공개 API에 크기별 변환 계약 없음 |

근거: [S3 URL 유효기간](C:/dev/popku-be/src/main/java/org/popku/admin/popup/service/S3PopupImageStore.java:29), [서명 GET URL 생성](C:/dev/popku-be/src/main/java/org/popku/admin/popup/service/S3PopupImageStore.java:81), [상세 이미지 구성](C:/dev/popku-be/src/main/java/org/popku/popup/service/PublicPopupService.java:345)

**기존 S3 이미지는 받은 URL을 그대로 `<img src>`에 넣는 방식으로 재사용할 수 있습니다.** 실제 객체의 접근 가능 여부는 호출하지 않아 미확인입니다.

일반 이미지 표시와 달리 canvas 픽셀 읽기·브라우저 업로드에는 S3 자체 CORS 확인이 별도로 필요합니다.

현재 웹은 일반 `<img>`를 사용합니다.

- 신규·TOP 10: `loading="lazy"`
- 메인 캐러셀: `decoding="async"`, 로딩 실패 안내 있음
- 신규·TOP 10: 이미지 실패 대체 처리는 추가 필요
- `@nuxt/image`는 현재 의존성에 없음

근거: [메인 이미지](C:/dev/popchive-web/app/components/home/HomePopupCarousel.vue:204), [신규 이미지](C:/dev/popchive-web/app/components/home/HomeNewPopups.vue:57), [TOP 10 이미지](C:/dev/popchive-web/app/components/home/HomeHotRanking.vue:63)

### 5분 URL이 만드는 제약

API 응답을 오래 보관하면 다음 상황이 생깁니다.

1. 홈 데이터를 받음
2. 사용자가 5분 넘게 머묾
3. 아직 로드되지 않은 lazy 이미지에 접근
4. 서명 만료로 이미지 요청 실패

권장 방향은 다음과 같습니다.

- 공개 응답 캐시는 우선 **30~60초 정도의 짧은 값으로 검토**
- stale 응답과 HTML 캐시까지 합쳐 서명 만료를 넘기지 않도록 관리
- 늦게 표시할 이미지에는 URL 갱신 또는 실패 후 한 번의 재조회 처리
- 실제 API 서명 URL을 담은 HTML을 장기 정적 생성하지 않기
- 메인 가시 이미지를 우선 로드하고 나머지 이미지는 지연 로드
- 이미지 null·실패 상태에서도 카드 크기를 유지

`coverImageCacheKey`는 서명 URL과 독립적인 객체 식별자입니다. **이 필드를 받았다고 일반 브라우저 이미지 캐시가 자동으로 공유되는 것은 아닙니다.** URL 서명이나 query를 제거해서도 안 됩니다.

근거: [CoverImageCacheKey.java](C:/dev/popku-be/src/main/java/org/popku/popup/service/CoverImageCacheKey.java:8)

### 개인화·커뮤니티 캐시의 주의점

공유 캐시에서 제외해야 하는 응답이 있습니다.

- 내 정보·내 찜·내 게시글·내 리뷰
- 로그인 사용자의 찜·좋아요·차단 상태가 반영된 응답
- 인증 관련 응답

또한 게시글 상세 GET은 **조회수를 증가시킵니다.** 일반 조회 API라고 가정해 백그라운드 prefetch·중복 호출·무조건 재시도를 하면 조회수에 영향을 줍니다.

근거: [게시글 상세 서비스](C:/dev/popku-be/src/main/java/org/popku/community/service/CommunityFeedService.java:35), [조회수 증가 SQL](C:/dev/popku-be/src/main/resources/org/popku/community/mapper/CommunityFeedMapper.xml:14)

---

## 8. 백엔드 수정 없이 연결하는 권장 구조

아래는 **제안**이며 이번에 구현한 내용은 아닙니다.

```text
페이지·컴포넌트
  → useFetch / useAsyncData
  → 같은 Origin의 Nuxt 서버 API
  → 기존 Spring API
  → 응답을 카드·페이지 모델로 변환
```

역할은 다음처럼 나누는 것이 적절합니다.

| 계층 | 역할 |
|---|---|
| Spring | 기존 조회·번역 fallback·권한·찜·리뷰·커뮤니티 계약 유지 |
| Nuxt 서버 | Base URL, 허용 API 전달, timeout, 오류 전달, 공개 캐시, 인증 토큰 전달 |
| 웹 페이지 | 국가·언어·필터·cursor·로딩·오류 상태 |
| UI 컴포넌트 | 현재 props 기반 표시·사용자 액션 |

프록시는 다음 범위로 제한해야 합니다.

- 백엔드 host 고정
- 필요한 Endpoint·Method만 허용
- 사용자 입력 URL을 그대로 요청하는 오픈 프록시 금지
- query·path 검증
- 불필요한 Cookie·Origin·헤더 전달 금지
- 공개 조회와 인증 조회의 캐시 분리
- 백엔드 오류를 무조건 빈 목록으로 바꾸지 않기

인증은 Nuxt에서 HttpOnly·Secure·SameSite 쿠키 또는 서버 세션을 관리하고, Spring으로 전달할 때 Bearer 헤더를 만드는 구조를 검토할 수 있습니다. 기존 Spring에 쿠키 인증을 추가할 필요는 없습니다.

S3 이미지는 우선 브라우저가 서명 URL을 직접 읽게 두면 됩니다. 초기부터 모든 이미지 바이트를 Nuxt로 중계할 필요는 없습니다.

---

## 9. 실제 연동 작업 순서

다음은 향후 작업 순서입니다. 실제 연결이나 검증은 이번에 수행하지 않았습니다.

| 단계 | 작업 | 먼저 확정할 사항 |
|---|---|---|
| **1단계: 홈** | Nuxt API 경로·Base URL 준비, 배너·최신 목록·NOW_HOT 병렬 조회, 카드 변환, 빈 상태·이미지 만료 처리 | ‘새로 올라온’의 의미, TOP 10이 운영자 선정인지, 국가 기본값 |
| **2단계: 탐색** | 페이지 생성, 지역·태그 조회, cursor 목록, 필터와 URL 동기화, 검색 결과 구성 | 검색의 국가·필터 결합 범위, 검색 결과 10개 제한 수용 여부 |
| **3단계: 상세** | `publicId` 라우트, 상세 SSR, title·description, 이미지·예약·리뷰 표시 | 상세 URL, 언어 URL, canonical, 종료 팝업 정책 |
| **4단계: 지도** | 지도 SDK, bounds 조회, 마커·카드 연결, 요청 취소·중복 방지 | 진행 중 팝업만 표시할지, 예정 팝업도 포함할지 |
| **5단계: 커뮤니티·회원** | 이메일 인증·가입·로그인·refresh, 찜, 피드·리뷰·게시글·댓글 구현 | 세션 저장 방식, 소셜 로그인 범위, 쓰기 오류·재시도 정책 |

이 순서에서는 공개 홈·탐색·상세·지도를 먼저 연결하고 회원 기능을 확장할 수 있습니다. 다만 **찜·작성 기능을 활성화하는 작업 안에서는 인증 계층을 먼저 구현**해야 합니다.

---

## 10. 최종 권장 사항

**백엔드 변경을 먼저 추진할 필요는 없습니다.** 기존 API를 Nuxt 서버를 통해 재사용하는 작업부터 진행하는 것이 적합합니다.

| 우선 판단 | 권장 사항 |
|---|---|
| A | 지역·태그 옵션 API는 현재 계약 그대로 활용 |
| B | 홈·탐색·상세·지도·회원·커뮤니티는 웹 구현과 DTO 변환으로 연결 |
| B | TOP 10은 우선 운영자 선정 `NOW_HOT`으로 연결 |
| C | 자동·기간별 인기 랭킹이 반드시 필요할 때만 집계 기능 추가 |
| 미확정 | 웹 운영 도메인·배포 방식·운영 API 배포 버전 |
| 미확정 | 신규 섹션의 의미·TOP 10 정책·다국어 URL·웹 인증 저장 방식 |

가장 먼저 확정할 것은 **‘새로 올라온 팝업’이 최근 등록인지 이번 주 오픈인지**, **TOP 10이 운영자 선정인지 자동 인기순인지**입니다. 이 두 의미를 정하면 홈은 기존 API만으로 상당 부분 연결할 수 있습니다.
