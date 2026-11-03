# 웹 마이페이지 기능 연결

## 조사 기준과 범위

RN `src/app/(tabs)/profile/index.tsx`, `src/app/profile/{favorites,reviews,nickname,password,withdrawal,settings,posts,blocks}.tsx`, `src/components/profile/AccountSettingsScreen.tsx`와 `src/lib/{favorites,myReviews,reviews,accountSettings,auth}.ts`를 확인했다. 백엔드의 `PublicPopupController`, `ReviewController`, `UserController`, `UserPasswordController`, 관련 DTO·서비스 및 SecurityConfig를 읽기 전용으로 확인했다.

| RN에서 확인된 기능 | 기존 계약·동작 | 이번 웹 구현 |
| --- | --- | --- |
| 찜 목록·취소 | GET /api/users/me/favorites → {popups}; DELETE /api/popups/{publicId}/favorite → publicId, isFavorited, favoriteCount | 목록·상세 링크·취소·빈 상태·오류 |
| 내 리뷰 | GET /api/users/me/reviews?cursor → {items,nextCursor} | 목록·팝업 제목/링크·사진·별점·본문·작성일·더 보기 |
| 리뷰 수정 | GET /api/community/reviews/{id}/edit → 소유자 전용 Detail; PATCH /api/community/reviews/{id} | 별점·본문 변경, 기존 사진 유지/삭제. 새로운 사진 업로드는 미구현 |
| 리뷰 삭제 | DELETE /api/community/reviews/{id}, 소유권은 서버 검증 | 최종 확인 후 삭제, 목록 반영 |
| 닉네임 변경 | PATCH /api/users/me/nickname {nickname} → UserResponse | NFC·trim 및 2~10자 정책, 성공 시 useAuth 사용자 갱신으로 헤더도 반영 |
| 비밀번호 변경 | PATCH /api/users/me/password {currentPassword,newPassword,confirmPassword} → 204 | LOCAL 계정에만 제공, 변경 후 로그인 정보 제거 및 로그인 페이지 이동 |
| 회원탈퇴 | DELETE /api/users/me → 204 | RN의 삭제/보존 안내, 확인 체크 및 최종 확인 후 실행, 성공 시 인증 정리·홈 이동 |

리뷰 목록 항목은 `id, content, rating, popup:{publicId,title}, images:string[], createdAt`을 사용한다. 수정 Detail의 사진은 `{id,url}[]`이며 저장 시 `retainedImageIds`를 전달한다. 별점은 정수 1~5, 본문은 빈 문자열을 허용하고 UTF-8 65,535바이트 이하로 제한한다. 타인의 리뷰 접근/수정/삭제 여부는 백엔드가 최종 판단한다.

닉네임 변경은 백엔드의 중복 검사와 최종 수정 결과를 사용한다. RN의 사전 닉네임 중복 조회를 별도로 반복 호출하지 않는다. 비밀번호 정책은 기존 `shared/utils/auth.ts`를 재사용한다. 현재 비밀번호 오류·동일 비밀번호·확인값 불일치·소셜 계정 제한을 안내한다. 백엔드는 비밀번호 변경과 모든 refresh token 폐기를 같은 트랜잭션으로 처리한다. 웹도 RN처럼 변경 성공 후 다시 로그인한다.

탈퇴 정책은 RN 안내 원문을 따른다: 질문/자유 게시글과 해당 댓글, 찜·좋아요 등 개인 활동은 삭제되고 방문 리뷰와 일부 댓글은 '탈퇴한 사용자'로 남는다. 복구 불가를 알리고 최종 확인을 받는다. 성공 응답 전에는 쿠키와 인증 상태를 제거하지 않는다. 실패/응답 유실 시 자동 재시도하지 않는다.

## 기타 RN 기능 조사

RN 프로필에는 내 게시글, 공지사항, 문의, 약관, 언어 설정도 있고 설정 화면에는 차단 사용자 관리가 있다. 테마 선택은 `DARK_MODE_ENABLED` 조건부다. 내 게시글은 `myPosts.ts`, 차단 목록/해제는 `moderation.ts`를 사용하는 별도 화면이다. 공지·문의 백엔드 컨트롤러도 존재한다. 이번 요청에서 구체화된 네 메뉴의 기능 외에 게시판·문의·차단·언어/테마 화면은 확장하지 않았으며 작동하지 않는 메뉴는 만들지 않았다. 프로필 사진 수정은 확인한 계정 설정 화면에 없으므로 추가하지 않았다.

## 웹 구조와 인증

- `/mypage` 내부 콘텐츠 전환으로 네 메뉴를 1열 세로 배치한다. 보호되지 않은 하위 경로를 추가하지 않았다.
- `hideSidebar:false`로 기존 기본 레이아웃의 1080px / 826px + 24px + 230px 구성과 TODAY를 그대로 사용한다. 페이지에서 TODAY를 다시 조회하거나 생성하지 않는다. 1120px 미만에서는 기존 정책대로 TODAY를 숨긴다.
- 찜 카드는 `HomeNewPopups.vue`를 재사용한다. 제목 prop과 카드별 action slot만 추가했으며 기존 홈 기본값·표시·조회 로직은 유지한다.
- 기존 `/api/web-auth/[action]` 중계의 동일 Origin JSON POST·no-store 보호를 재사용한다. **새로운 Spring 엔드포인트나 새 Nuxt 라우트 파일은 만들지 않았다.** 고정 허용 action을 기존 중계에 추가했다.
- 기존 `restoreWeb`으로 사용자/갱신을 확인하고 Bearer를 서버에서만 전달한다. refresh 발생 시 같은 요청에서 사용할 access token을 event.context로 전달한다. token/cookie의 발급·만료·회전 규칙은 유지한다. PATCH·DELETE 호출만 기존 서버 전용 HTTP 함수에 추가했다.
- API별 요청 중 중복 작업과 인증 복원/로그아웃 충돌을 막고 Web Locks 지원 브라우저에서는 기존 인증 요청과 같은 잠금을 사용한다. 다른 계정으로 쿠키가 바뀐 경우 ownerId와 서버 인증 사용자를 비교해 요청을 거부한다. ownerId는 인증 수단이 아니다.
- 사용자 ID가 바뀌면 콘텐츠를 다시 생성하고, 로그아웃·이력 복원의 기존 개인정보 숨김과 Route Middleware를 유지한다. 사용자 목록을 공용 캐시나 localStorage에 저장하지 않는다.

## 변경 파일

- `app/pages/mypage.vue`
- `app/components/account/MypageContent.vue`
- `app/components/home/HomeNewPopups.vue`
- `server/utils/mypageActions.ts`
- `server/utils/webAuth.ts`
- `server/api/web-auth/[action].post.ts`
- 이 문서 및 [WEB_AUTH.md](./WEB_AUTH.md)의 연결 안내

## 정적 검토와 남은 확인

API 계약·권한 분기·요청 method·빈 상태·중복 제출·사용자 전환·개인정보 표시 조건을 코드로 검토했다. 빌드·타입 검사·테스트·개발 서버·API 실호출은 실행하지 않았다. 운영 배포 상태와 브라우저 실동작을 검증한 것은 아니다.

수동 확인: PC/TODAY와 모바일 1열 메뉴, 찜 조회/취소/빈 목록/상세 이동, 리뷰 커서·별점/본문·기존 사진 유지/삭제·취소·삭제 확인, 닉네임 중복/헤더 갱신, 비밀번호 오류/변경 후 재로그인, 탈퇴 취소 및 성공 후 뒤로가기, 만료 세션/네트워크 오류/다중 탭 계정 변경. 회원탈퇴와 비밀번호 변경은 전용 테스트 계정에서 확인해야 한다.
