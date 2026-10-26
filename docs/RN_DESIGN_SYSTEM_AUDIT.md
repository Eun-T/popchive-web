# 팝카이브 RN 디자인 시스템 조사

조사일: 2026-10-24 · 상태: 읽기 전용 조사 및 웹 토큰 **초안**

## 1. 조사 범위와 판단 기준

- RN 기준 경로: `C:\dev\popku-rn`. 아래 RN 상대 경로는 모두 이 경로 기준이다.

- 웹 기준 경로: `C:\dev\popchive-web`. 생성한 결과물은 이 보고서 한 개다.
- `AGENTS.md`, `docs/CONVENTIONS.md`, `docs/DESIGN.md`, `docs/THEME_AUDIT.md`를 읽고 실제 화면·공통 컴포넌트·테마·에셋 참조를 대조했다. 문서와 다르면 현재 작업 트리의 코드를 우선했다.
- 홈·팝업 목록·상세·지도·커뮤니티의 렌더링 코드와 스타일을 조사했다. 기존 `.tmp-benefit-web.png` 상세 캡처도 직접 열었으나, 현재 코드와 다른 과거/임시 화면이므로 최신 화면의 증거로 사용하지 않았다.
- 앱·브라우저·에뮬레이터를 실행하지 않았다. 따라서 현재 다섯 화면의 실행 결과, 실기기 글꼴, 최종 이미지 크롭, 키보드·포커스·FPS는 검증하지 않았다. 아래 화면 설명은 **현재 소스로 확인한 화면 구성**이다.
- 로고 PNG와 기존 캡처를 눈으로 확인하고 PNG/JPG 크기를 읽었다. WebP는 파일·코드 참조·용량을 확인했으며 크기는 이번 조사에서 확인하지 못했다.
- 외부 사이트 조회·라이선스 최신 조건 검증은 하지 않았다. 라이선스 항목은 저장소에 있는 출처와 고지의 확인 결과이며, 사용권 확정이 아니다.

표기 기준:

| 표기 | 의미 |
| --- | --- |
| RN 코드 | 현재 소스에 정의되거나 사용 중인 값 |
| RN 문서 의도 | 문서에만 있거나 실제 코드와 차이가 있는 규칙 |
| 웹 확정 조건 | 이번 사용자 요청에 명시된 조건 |
| 웹 신규 제안 | RN에 없는 값·웹용 변환·새 동작. 확정된 디자인이 아님 |

웹 `package.json`에는 Nuxt `^4.6.2`, Vue `^3.5.44`가 선언되어 있다. Tailwind는 아직 직접 의존성에 없으며 사용 예정으로만 취급한다. 이번 조사에서는 설치나 설정을 하지 않았다.

## 2. 핵심 결론

기존 앱은 흰색 바탕, 짙은 텍스트, 얇은 회색 경계, 제한적인 초록색 강조가 중심이다. 브랜드 초록색은 `#22C55E`이며 **라이트 모드 선택 칩은 초록색이 아니라 `#111827` 배경과 흰색 글자**다. 상태 배지·찜·리뷰 별점은 별도 의미 색상을 사용한다.

공통 typography·spacing·radius 토큰은 있지만 화면에서 덮어쓰는 값이 많다. 모든 카드가 같은 비율·글꼴·모서리를 갖는 시스템은 아니다. 웹에서는 기초 토큰을 재사용하고 컴포넌트 역할별 예외를 명시하는 방식이 적절하다.

**Pretendard는 문서상의 기본 글꼴이며, 현재 RN 코드에서 실제 전역 적용은 확인되지 않았다.** `src` 전체의 `Pretendard`, `fontFamily`, `useFonts` 검색 결과, 명시적인 폰트 로딩은 로그인 Google Sans뿐이다. `assets/fonts/`에도 Pretendard 파일이 없다. 따라서 웹 Pretendard 설정은 사용자 확정 조건을 새로 구현할 항목이다.

테마 기반 코드와 다크 팔레트는 생겼지만 `src/theme/themeFeature.js:2`의 `DARK_MODE_ENABLED = false`, `themeStore.ts`의 `resolved()` 때문에 현재 유효 테마는 라이트다. 다크 팔레트를 이미 서비스 중인 디자인으로 가져오지 않는다.

## 3. 문서와 실제 코드의 차이

| 항목 | 문서 | 실제 코드와 조사 판단 |
| --- | --- | --- |
| Pretendard | `docs/DESIGN.md:32` 기본 글꼴 | `tokens.ts:20` 이하에는 크기·굵기·행간만 있고 fontFamily 없음. `src/app/_layout.tsx`에도 Pretendard 로딩 없음. 플랫폼 기본 폰트로 렌더될 가능성이 있으나 실기기 미확인 |
| 단위 | DESIGN Typography에 Flutter 논리 픽셀 문구 존재 | 프로젝트는 RN이다. 숫자는 RN 레이아웃 단위이며 CSS px와 동일 렌더링을 보장하지 않음 |
| 토큰 범위 | spacing 표는 주로 4~56 일부 값 | `src/theme/tokens.ts:30`에는 0·2·10·28·48·60도 존재. radius·그림자에도 화면별 literal 존재 |
| 홈 카테고리 | 이미지 64×64, 간격 20, 라벨 12/500/18, 소제목 없음 | `HomeCategoryShortcuts.tsx:62`, `:104` 이하: 소제목 있음, 이미지 72×72, 항목 너비 64, gap 26, 라벨 14/500/18, 위 간격 28·라벨 간격 6 |
| 카테고리 파일 준비 | 에셋 README는 파일이 없는 상태와 향후 등록 설명 | PNG 6개가 실제 존재하며 `HomeCategoryShortcuts.tsx:31`에 모두 등록됨. 원본도 전부 정사각형은 아님 |
| 최근 등록 카드 | DESIGN: 이미지 radius 12, 제목 14/600/20, 기간 위 4 | `LatestPopupCard.tsx` styles: radius 8, 제목 15/700/20, 기간 위 2. 섹션 위 간격은 `HomeLatestPopupSection.tsx:88`의 32 |
| 홈 섹션 간격 | 기본 56 및 여러 세부 명세 | `HomeTrendingSection.tsx` 위 32, 필터·리스트 위 12. `HomeScreen.tsx:119` 신규 섹션 wrapper 위 48. 실제 화면에 일괄 56 적용된 상태가 아님 |
| 상세 Hero | 배경 opacity 0.5 | `PopupHeroImage.tsx:141` 이하 opacity 0.55, scale 1.12, blur 20 및 검정 dim 0.15 |
| 공지/혜택 pill | 배경 #F5F5F5, 소개 아래 16 | `PopupIntroduction.tsx:146` 이하 배경 #EDEDED, 소개 아래 12 |
| 탭바 | 높이 64, 좌우 20, 과거 아이콘 목록 | `FloatingTabBar.tsx:55` 높이 60, styles 좌우 22. 실제 House 커스텀·LayoutGrid·MapPin·MessageCircle·User. 웹 헤더 규칙으로 복제하지 않음 |
| 테마 감사 문서 | `docs/THEME_AUDIT.md`는 2026-10-08 당시 Provider·다크 팔레트 없음으로 기록 | 현재 `ThemeProvider`, `useTheme`, `themeColors`, 저장소가 존재함. 다만 기능 플래그는 꺼져 있음. 과거 감사는 현재 상태 설명으로 재사용하지 않음 |
| 로그인 브랜드 규칙 | auth README Google caption 14/20, Apple 약 22 | 현재 로그인 styles는 두 caption 18/500/22. 문서·코드가 다르므로 웹 로그인 디자인 확정 근거로 삼지 않음 |

## 4. 실제 디자인 기반

### 4.1 색상

기본 정의: `src/theme/tokens.ts:1`. 라이트 의미 토큰: `src/theme/themeColors.ts:4`. 커뮤니티 전용: `src/theme/communityColors.ts:1`.

| RN 토큰/용도 | 값 | 실제 사용 및 웹 판단 |
| --- | --- | --- |
| primary | `#22C55E` | 브랜드/CTA. 웹 확정 메인 컬러와 일치 |
| primaryLight / primaryDark | `#DCFCE7` / `#15803D` | 운영 중 배지, 초록 강조 글자 |
| infoLight / infoDark | `#DBEAFE` / `#1D4ED8` | 오픈 예정 상태 배지. 문서 일부 표현보다 현재 status 분기 우선 |
| background / surface | `#FFFFFF` / `#F8FAFC` | 화면 바탕 / 보조 면. 모든 카드 배경이 surface는 아님 |
| moreButtonBackground | `#F7F8FC` | 더 보기 버튼 |
| text / secondaryText | `#111827` / `#6B7280` | 제목·본문 / 기간·지역·설명 |
| inactiveText / inactiveTabText | `#9CA3AF` / `#B8BEC8` | 비활성/보조 표현. 의미는 요소별 구분 필요 |
| border | `#E5E7EB` | 입력·칩·경계 |
| paginationActive / Inactive | `#494B4F` / `#E5E7EB` | 공통 페이지 상태. 홈 배너는 흰색 별도 palette |
| brandGradient | `#22C55E → #86EFAC` | 정의 존재. `src` 검색에서 직접 소비는 확인하지 못함. 기본 면 스타일로 확대하지 않음 |
| tagBackground / tagText | `#F3F4F6` / `#4B5563` | 목록 카테고리 및 의미 토큰 |
| skeletonBackground | `#F1F3F5` | SkeletonBlock 및 라이트 의미 토큰 |
| favorite | `#FF5A6E` | 목록·홈 하트 및 상세 찜 CTA의 literal |
| error / destructive | `#B91C1C` / `#DC2626` | 로그인·작성 오류 / 메뉴 삭제. 모든 위험 표현을 하나로 통합한 상태는 아님 |
| 별점 | 상세 `#F5B800`, 커뮤니티 `#FACC15` | 두 색이 실제 공존. 통합은 추가 디자인 판단 |
| sheet dim | `rgba(0,0,0,0.4)` | 시트 배경. `PopupGuidanceSheet.tsx` |

커뮤니티 palette는 background/white `#FFFFFF`, text `#252D3A`, secondaryText `#818B9B`, divider `#E8EBF0`, mutedSurface `#F1F3F7`, charcoal `#303A49`, placeLink `#526071`이다. 기본 palette와 별도로 실제 사용된다. `CommunityScreen.tsx`의 헤더·필터는 기본 색상이고 피드 본문·구분선은 커뮤니티 색상을 섞어 사용한다.

지도 카테고리는 별도 분류 palette를 갖는다. `MapScreen.native.tsx:171` 이하에서 캐릭터/IP `#8B5CF6`, 게임 `#2563EB`, 연예 `#DB2777`, 패션 `#374151`, 뷰티 `#FB7185`, F&B `#F97316`, 아트 `#0D9488`, 문구 `#EAB308`, 라이프 `#84A98C`, 패밀리/펫 `#38BDF8`, 기타 `#9CA3AF`다. 이 색은 지도 분류 의미이며 웹 일반 태그 전체에 적용할 규칙은 아니다.

### 4.2 타이포그래피와 폰트

`src/theme/tokens.ts:20`의 규격. 표기는 크기 / 굵기 / 줄 높이 순서다.

| 토큰 | RN 값 | 주요 역할 |
| --- | --- | --- |
| display | 32 / 700 / 40 | 큰 메시지용 정의 |
| titleL | 24 / 700 / 32 | 화면 제목 |
| titleM | 20 / 700 / 28 | 홈 섹션 제목 |
| titleS | 18 / 600 / 26 | 하위 제목·시트 제목 |
| body | 16 / 400 / 24 | 본문·작성 입력 |
| label | 14 / 500 / 20 | 필터·버튼 |
| caption | 12 / 400 / 18 | 보조 정보 |

중요한 실제 override:

- `PopupGridCard.tsx` styles: 제목 16/700/20, 기간 13/400/20, 상태 12/600/16. 기간 위 margin 3은 spacing 토큰 밖의 값이다.
- `LatestPopupCard.tsx` styles: 제목 15/700/20, 기간 caption. `NewPopupCard.tsx`는 제목 body+700으로 16/700/24이며 JSX `numberOfLines={1}`이다.
- 상세 제목은 `src/app/places/[id].tsx:1168`의 18/700/26. 소개문은 `PopupIntroduction.tsx:139`의 14/400/22.
- 커뮤니티 일반 글 compact 본문은 `CommunityPostItem.tsx:469` 부근의 16/600/24. 별도 일반 body 스타일 15/23과 리뷰 16/600도 공존한다.
- 폰트 파일은 `assets/fonts/google-sans-medium.ttf`와 `google-sans-OFL.txt`만 확인했다. 로그인 `src/app/(tabs)/profile/login.tsx:50`, `:538`에서 GoogleSansMedium을 조건부 적용한다. 모든 텍스트가 Pretendard를 사용하는 앱으로 기록하면 안 된다.

### 4.3 간격·모서리·경계·그림자

공통 spacing(`tokens.ts:30`): **0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 48, 56, 60**. 일반 좌우 여백 16, 목록 열 간격 12, 카드 안쪽 여백 16을 많이 사용하되 홈 섹션별 실제 간격은 다르다.

공통 radius(`tokens.ts:49`): **4, 8, 12, 16, 24, full=999**. 상태 배지의 5, 원형 이미지의 36 등 literal 예외가 있다. border는 주로 1, 탭 underline은 2이며 메뉴의 `StyleSheet.hairlineWidth`는 물리 픽셀과 연관되어 CSS 값으로 직역하지 않는다.

그림자 공통 토큰은 없다. 주요 사용처의 값을 추출하면 다음과 같다.

| 실제 위치 | RN 그림자 | 판단 |
| --- | --- | --- |
| `HomeBanner.tsx:338` 포스터 | 검정, offset 0/4, opacity .26, radius 9, elevation 6 | 포스터 강조용 |
| `HomeCategoryShortcuts.tsx:138` | 검정, 0/3, .1, radius 5, elevation 3 | 원형 이미지 그림자 |
| `PopupGridCard.tsx` 찜 버튼 | 검정, 0/1, .25, radius 2, elevation 2 | 이미지 위 아이콘 가독성 |
| `CommunityScreen.tsx:491`, 상세 `:1106` CTA | 검정, 0/4, .15, radius 12, elevation 6 | 떠 있는 액션 |
| `FloatingTabBar.tsx` container | 검정, 0/6, .09, radius 18, elevation 6 | 네이티브 탭바 |
| `MapScreen.native.tsx:81` | 마커 view/text 그림자 비활성 플래그 true | 선언된 그림자 값이 현재 활성인 것으로 오인하지 않음 |

카드마다 그림자를 추가하는 디자인은 아니다. 흰색 면·여백·얇은 구분선이 우선이다. CSS box-shadow는 RN shadowRadius/elevation과 렌더링이 달라 별도 초안으로 제시해야 한다.

### 4.4 공통 컴포넌트와 상태

| 구성 요소 | 코드 근거 | 실제 규칙 |
| --- | --- | --- |
| 필터 칩 | `src/components/common/FilterChips.tsx:52` | 높이 36, 좌우 16, gap 8, full, border 1, Label. 선택 시 검정 계열 면·흰 글자. selected 접근성 상태 제공 |
| 더 보기 | `src/components/common/MoreButton.tsx:31` | 너비 100%, 높이 48, radius 12, Label, 기본 #F7F8FC. primary 변형 #22C55E/흰색. pressed opacity .7 |
| 공통 Tag | `src/components/common/Tag.tsx:20` | padding 4/8, radius 8, 12/500/16, neutral/primary/info. 목록의 작은 상태 badge와 별도 컴포넌트 |
| 목록 카드 | `src/components/place/PopupGridCard.tsx:183` 이하 | 포스터 4:5 cover/radius 8, 상태→제목→기간→지역·카테고리, 외곽 카드 border·shadow 없음 |
| 목록 검색 | `src/screens/PlaceScreen.tsx:776` | 높이 48, 좌우 16, gap 8, radius 12, border 1, 흰색. 글자 크기·굵기는 Body, 입력 행간은 명시 안 됨 |
| 로그인 입력·버튼 | `src/app/(tabs)/profile/login.tsx:498` | 높이 52, radius 8, 입력 border 1, 좌우 16, disabled opacity .6, 오류 #B91C1C |
| 작성 textarea | `src/app/community/write.tsx:368` | minHeight 220, padding 16, radius 12, border 1(커뮤니티 divider), Body. 제출 비활성 배경 별도 |
| 아바타 | `src/components/community/CommunityAuthor.tsx:33` | 40×40 원형, URL 실패·없음 UserRound fallback |
| 로딩 | `src/components/common/SkeletonBlock.tsx:21` | #F1F3F5, opacity 1↔.82, 편도 900ms. 화면별 적용 범위가 다름 |
| 시트 | `src/components/place/PopupGuidanceSheet.tsx:94` | 상단 radius 24, edge-to-edge, 내부 Safe Area, 핸들 36×4/영역 32, dim .4. 등장 200ms/퇴장 160ms, 이동 220, ease in-out |

찜은 선택/비선택 시 하트 outline·fill과 문구로 구별하며, 처리 중 `disabled`와 접근성 상태를 사용한다. 목록에서는 26 아이콘을 40×40 영역에 넣어 사용하고 상세 상단 버튼은 44×44다. 문서의 최소 44 규칙이 모든 실제 버튼에 적용된 것은 아니다. 웹의 접근성 타깃 기준은 별도 보완이 필요하다.

모든 Pressable에 공통 pressed 스타일이 있는 것은 아니다. hover·키보드 focus-visible에 대한 공통 토큰도 없다. React Native accessibilityRole/state의 의미는 재사용하되 웹 HTML 의미 구조로 옮겨야 한다. 특히 카드 전체 클릭과 찜을 구현할 때 `<button>` 안에 다른 `<button>`을 중첩하지 않도록 링크와 버튼을 분리한다(**웹 신규 제안**).

## 5. 화면별 조사

### 5.1 홈

근거: `src/screens/HomeScreen.tsx:89`, `src/components/home/HomeBanner.tsx`, `HomeCategoryShortcuts.tsx`, `HomeLatestPopupSection.tsx`, `HomeTrendingSection.tsx`, `HomeNewPopupSection.tsx`.

현재 순서는 배너 → 카테고리 소제목/바로가기 → 최근 등록 → TOP 10 → 신규 오픈이다. 앱 홈 자체에 웹용 화이트 헤더나 좌우 패널 구조는 없다.

배너는 높이 400, 전경 포스터 최대 너비 화면의 .7, contain과 원본 비율 계산, radius 12, 뒷배경 cover/blur 50, 어두운 shade·하단 gradient를 사용한다. 가로 paging과 아래 dot(4×4)/활성 pill(24×4)이 있고 제목·기간·지역을 흰색으로 겹친다. `HomeScreen.tsx:27`의 배너 당김 확대 실험은 활성이다. 이를 웹에서 필수 인터랙션으로 계승하지 않는다.

최근 등록·신규 오픈 카드 이미지는 정사각형이고 순위 카드 이미지는 88×108이다. 따라서 웹의 **세로형 포스터 중심 캐러셀은 배너의 포스터 원본 보존과 목록 4:5 패턴을 참고하되, 홈 카드 전체를 그대로 복사하는 변경은 아니다.**

### 5.2 팝업 목록/플레이스

근거: `src/screens/PlaceScreen.tsx:491`, `:539`, `:617`, `:648`; `src/components/place/PopupGridCard.tsx`.

탐색/전체 탭, 검색창, 빠른/상세 필터와 결과 목록을 사용한다. 전체 목록은 화면 좌우 16·열 간격 12의 2열이며 카드 너비는 `(화면폭 - 좌우 inset - 32 - 12) / 2`다. 탐색에는 오늘 오픈 캐러셀, 관심사·지역·주간 탐색 등 구성이 있다.

목록은 상태 badge → 한 줄 제목 → 기간 → 위치 아이콘·지역·카테고리의 순서다. 포스터는 4:5 cover이고 하트는 이미지 오른쪽 아래에 겹친다. 위치 아이콘은 예외적으로 `@expo/vector-icons`의 Ionicons `location-sharp` 16이다. 이 2열 공식을 웹 826px 메인에 그대로 넣을지, 3~4열로 바꿀지는 신규 설계다.

### 5.3 팝업 상세

근거: `src/app/places/[id].tsx:686`, `:718`, `:941`, `:1025`, `src/components/place/PopupHeroImage.tsx`, `PopupIntroduction.tsx`, `IntroductionImageCarousel.tsx`.

화면폭×화면폭 고정 Hero 안에 블러 cover 배경과 contain 포스터를 둔다. 로딩이나 이미지 비율에 따라 Hero 높이를 바꾸지 않는다. 상단 뒤로/공유는 흰색 24 아이콘·44 타깃이다. 이어서 팝업 정보/방문 리뷰 sticky 탭(높이 56, underline 2), 태그·제목·통계, 기본정보·예약, 지도, 상세 소개·공지/혜택 pill·소개 이미지·공식 채널 등이 배치된다.

상세 찜 CTA는 #FF5A6E, 높이 48, 좌우 16, full, 14/600/20이다. RN 하단 탭바 상수와 Safe Area로 위치를 계산하므로 웹 sticky 헤더·우측 패널 위치로 그대로 이식할 수 없다.

기존 `.tmp-benefit-web.png`를 직접 확인하면 흰색 바탕, 검정 탭, 초록 상태 badge, 기본정보 행과 구분 영역이 보인다. 그러나 이 캡처는 공지·혜택 박스와 하단 탭바가 있고 현재 전용 pill·시트 및 탭바 없는 상세 코드와 다르다. 캡처의 포스터나 임시 문구를 공식 에셋·최신 명세로 사용하지 않는다.

### 5.4 지도

근거: `src/screens/MapScreen.native.tsx:171`, `:980`, `:1549`, `src/components/map/MapPopupPreviewCard.tsx:237`, `MapSearchOverlay.tsx`; 웹 대체 `MapScreen.web.tsx:5`.

네이티브는 Google provider의 react-native-maps, Supercluster, 카테고리별 마커·선택 핀·라벨을 사용한다. 검색은 흰 pill 높이 42, 필터는 높이 36이다. 마커 선택 후 하단에 포스터 96×128·radius 8을 가진 미리보기/가로 캐러셀 및 목록 시트를 보여 준다. 선택 핀은 34×38이고 작은 라벨은 11/600이다. 마커 그림자 A/B 플래그는 현재 꺼진 그림자를 만들도록 설정되어 있다.

현재 RN 웹 지도 화면은 “지도는 Android와 iOS 앱에서 이용할 수 있어요.” 안내뿐이다. **동작하는 웹 지도 구현을 보유한 상태가 아니다.** 상세의 정적 지도는 `PlaceMapPreview.web.tsx` → `StaticMapImage.tsx`의 Google Static Maps 이미지이며 높이 200·radius 12, 환경 키가 없으면 surface 영역만 표시한다. 웹 지도 공급자·검색/목록 배치·줌/키보드·API 제한은 신규 설계 대상이다.

### 5.5 커뮤니티

근거: `src/screens/CommunityScreen.tsx:85`, `:394`, `:454`, `src/components/community/CommunityPostItem.tsx:421`, `CommunityAuthor.tsx`, `CommunityImageCarousel.tsx`, `src/app/community/[id].tsx`.

24/700/32 제목, 카테고리 pill, 흰 피드와 얇은 divider, 떠 있는 글쓰기 버튼으로 구성된다. 최신순으로 고정되며 인기순 선택은 없다. QUESTION/FREE compact 카드와 REVIEW 카드가 다르다. 일반 compact 글은 paddingY 20·gap 12, 썸네일 76×76/radius 8, 본문 16/600/24다. 리뷰는 작성자·별점·팝업 링크·내용·사진을 별도 구성한다.

상세 이미지 캐러셀은 정사각형 contain, 1장은 indicator 없음, 다중 이미지는 비활성 6×6·활성 18×6·gap 6을 사용한다. 댓글·답글은 POST에 있고 REVIEW 댓글은 현재 제공하지 않는다. 일반 POST 좋아요·조회수도 없으며 REVIEW 좋아요는 유지한다. 관련 기능을 웹 디자인에 임의 복원하지 않는다(`docs/DESIGN.md`의 2026-10-08 지원 범위와 코드 분기 일치).

## 6. 아이콘·로고·이미지 에셋

### 6.1 아이콘 체계

- 일반 UI: `lucide-react-native` (`package.json` 선언 `^1.48.0`). Heart, Chevron, Share, Search, User 등. 16·18·20·22·24·26처럼 역할별 크기가 있다.
- 예외: 목록 위치 `@expo/vector-icons` Ionicons, 지도 카테고리 MaterialIcons. 단일 Lucide만으로 구현된 앱은 아니다.
- 커스텀: `src/components/icons/HouseIcon.tsx`, `FilledTabIcons.tsx`, `MapPinnedIcon.tsx`와 `src/components/place/OfficialChannelIcon.tsx`의 RN SVG. 지도 핀 일부는 소스 내부 SVG data URI로 생성한다.
- 웹에서는 동일 의미의 SVG 아이콘으로 옮기는 방향이 가능하다. Vue용 패키지 선택·버전·라이선스 고지와 RN SVG→일반 SVG 변환은 **웹 신규 제안**이며 이번에 설치/변환하지 않았다.

### 6.2 에셋 목록과 재사용 적합성

아래 경로는 RN 루트 기준이다. “가능”은 파일 형식·해상도 측면이며 사용권 보장은 아니다.

| 위치/형식 | 확인한 원본 | 코드 사용처 및 웹 판단 |
| --- | --- | --- |
| `assets/images/popicon.png` PNG | 1024×1024, 약 359KB | `app.json:11` iOS icon. 직접 열어 밝은 바탕의 검정 P 심볼 확인. 웹 심볼 후보이나 배경/여백이 포함된 앱 아이콘이며 벡터 원본은 찾지 못함 |
| `assets/images/splash-icon.png` PNG | 1024×1024 | 직접 열어 검정 P 형태 확인. `app.json:39` splash 참조. 투명 영역·밝고 어두운 배경에서의 사용은 별도 확인 필요 |
| `assets/images/icon.png` PNG | 1024×1024 | 직접 열어 Expo 기본 형태 확인. `app.json:7` 참조. 팝카이브 로고로 재사용하지 않음 |
| `assets/images/favicon.png` PNG | 48×48 | 직접 열어 Expo 기본 형태 확인. `app.json:31` 웹 favicon. 새 웹 브랜드 favicon으로 그대로 쓰지 않음 |
| `assets/images/android-icon-{foreground,background,monochrome}.png` | 512×512 / 512×512 / 432×432 | `app.json` Android adaptive icon 레이어. 웹 로고 자동 채택 대상 아님 |
| `assets/expo.icon/Assets/expo-symbol 2.svg`, `grid.png`, `assets/expo.icon/icon.json` | Expo icon 묶음 | 파일 존재. 팝카이브 SVG 로고로 간주하지 않음 |
| `assets/images/ranking-placeholder.png` PNG | 176×216 | 목록·홈 fallback. 웹에서도 기술적으로 가능하나 큰 포스터로 확대하면 해상도 부족 |
| `assets/images/banner_01.jpg` JPEG | 1025×1024 | `src/constants/placePopupMocks.ts:46` mock 참조. 실제 홈 배너는 API 기반. 운영 대표 배너로 확정하지 않음 |
| `assets/images/home-categories/` PNG 6개 | all 1024×1024, korea 1092×687, japan 1500×1001, fashion 1470×981, beauty 702×682, fnb 960×640 | `HomeCategoryShortcuts.tsx:31`. 웹 재사용 후보. 원형 cover 크롭 전제. 파일별 약 35KB~2.82MB로 원본 그대로 웹 썸네일 제공은 비효율적 |
| `assets/images/categories/` WebP 4개 | anime-character 약26KB, beauty 약19KB, fashion 약36KB, game-digital 약14KB. 픽셀 크기 미확인 | `PlaceInterestSection.tsx:24`. 웹에서 읽을 수 있는 파일 형식. PNG 홈 바로가기와 역할을 구분 |
| `assets/images/regions/` PNG 8개 | seongsu 750×500, hongdae 1280×853, yeouido 852×584, gangnam 1152×648, tokyo 1100×733, osaka 800×534, kyoto 1448×1086, nagoya 1000×667 | `src/constants/placeRegionMocks.ts:25`. PlaceRegionSection 연결. 웹 후보이나 약 .77~2.19MB, 출처/권리 고지 미확인 |
| `assets/images/auth/google-g.png` PNG | 200×204 | 공식 Google G로 README 출처 기록, 로그인 참조. 일반 브랜드 아이콘으로 재색칠하지 않음 |
| `assets/images/auth/apple-logo-white.svg` SVG | viewBox 0 0 31 44 | 공식 Apple 로그인 로고. 로그인 `:469`에서 expo-image Image로 사용. 웹 기술 재사용 가능하나 공급자 용도·여백 규칙 별도 |
| `assets/images/map-apps/{google-maps,naver-map,apple-maps}.png` | 각 512×512 | `DirectionsSheet.tsx:12`. `sources.json`에 App Store 출처 기록. 지도 앱 연결 용도와 사용권 확인 필요 |
| `assets/fonts/google-sans-medium.ttf`, `google-sans-OFL.txt` | TTF 약2.23MB + 라이선스 | Google 로그인 한정 사용. Pretendard 대체 에셋이 아님 |

별도 팝카이브 **워드마크 SVG**, 웹 헤더용 가로 로고, Pretendard WOFF/WOFF2는 확인하지 못했다. 앱 이름이 남아 있는 `popku` 설정과 팝카이브의 최종 표기는 별도 브랜드 검토 사항이다.

### 6.3 출처·라이선스·외부 의존성

- 루트 `LICENSE`는 Expo/650 Industries 저작권의 MIT 고지다. 이 파일만으로 모든 자체 로고·사진·포스터·제3자 상표의 웹 사용권까지 확인된 것은 아니다.
- `assets/images/auth/README.md`는 Google/Apple 공식 소스와 브랜드 규칙을 기록한다. Google Sans에는 별도 SIL OFL 텍스트가 있다. 최신 공급자 규칙은 이번 조사에서 검증하지 않았다.
- `assets/images/map-apps/sources.json`은 지도 앱 artwork의 App Store 원본을 기록한다. 다운로드 출처 기록과 재배포 허가는 구분한다.
- 홈 카테고리·지역·관심사 이미지에는 조사한 파일 범위에서 개별 사용권 증거가 확인되지 않았다. 출처 확인 전 “자유 재사용 가능”으로 표시하지 않는다.
- 실제 포스터·배너·리뷰 이미지는 `src/lib/mainBanners.ts`, `src/lib/popups.ts`, `src/lib/communityImages.ts`에서 API URL·캐시 키·S3 서명 업로드 흐름으로 다룬다. 로컬 에셋 세트만 복사해 운영 화면을 구성할 수 없다. 서명 URL을 영구 디자인 토큰이나 고정 에셋 경로로 저장하지 않는다.
- mock `src/constants/placePopupMocks.ts`에는 Unsplash 원격 이미지도 있다. mock 소스와 운영 이미지 출처를 구분한다.
- 웹의 이미지 제공 방식·CORS·크기별 변환·캐시·오류 복구, 지도 API·표시 고지는 향후 검토 사항이다. RN의 API 키나 네이티브 인증 설정을 웹으로 복사하지 않는다. 이 보고서에는 키·토큰 값을 기록하지 않았다.

## 7. A/B/C 분류

| 분류 | 항목 | 적용 판단 |
| --- | --- | --- |
| **A. 그대로 재사용할 규칙** | White-first, primary #22C55E, text/secondary/border 등 기초 팔레트 | 동일 색값·역할 재사용. 일반 선택 칩은 어두운 면 유지 |
| A | 기본 typography 7단계, spacing 숫자 집합, radius 4/8/12/16/24 | 시각 규격 재사용. CSS 단위 표현은 B에서 조정 |
| A | 상태별 초록·파랑·회색 badge, 찜 pink의 의미 | 운영/오픈 예정/종료와 찜을 색·문구로 구별 |
| A | 카드 정보 순서, 흰 카드·가벼운 구분선, 포스터 중심 | 목록의 정보 위계와 이미지 중심성 유지 |
| A | 적합한 PNG/WebP/SVG 이미지와 아이콘 모티프 | 사용권·용도 확인을 조건으로 후보 지정. 이번 복사 없음 |
| **B. 웹에 맞게 조정** | Pretendard | RN은 문서 의도만 확인. 웹에서는 실제 로딩/weight/fallback 설계 필요 |
| B | 1080/826/230/24 레이아웃·화이트 헤더 | 사용자 확정. RN 대응 규칙 없음. 반응형 전환은 신규 제안 |
| B | 포스터 캐러셀 | contain·원본 비율 원칙 계승, 메인 폭 기준 크기·이전/다음·키보드·indicator 신규 설계 |
| B | 카드 그리드·상세 Hero·sticky 탭·CTA | 화면폭 공식 대신 메인 컨테이너 폭 사용, 헤더/패널과 충돌 방지 |
| B | 버튼·검색·태그·입력 | 기존 크기 참고, hover/focus/disabled/error·HTML 의미 구조·확대 대응 보완 |
| B | 그림자·모션 | CSS shadow/easing으로 시각 검증. reduced-motion 대응 신규 설계 |
| B | 지도·시트·이미지 캐시 | 웹 공급자/DOM dialog·popover/브라우저 이미지 로딩 방식으로 재설계 |
| **C. 적용하지 않을 RN 요소** | Expo Router/React Native/StyleSheet/Pressable 구현 자체 | Vue SFC·HTML·Tailwind로 대체할 구현 기술 |
| C | iOS Liquid Glass·Expo Blur 탭바, 네이티브 탭 드래그 | 미니멀 화이트 웹 헤더 조건에 해당하지 않음 |
| C | RN Safe Area 위치 공식, elevation/useNativeDriver, 기기 키보드 보정 | 앱 전용 계산을 복사하지 않음. 웹 모바일 safe-area 대응 필요 여부는 별도 |
| C | 네이티브 지도 뷰·마커 렌더링·onDismiss 타이밍·지도 앱 scheme | 웹 SDK/링크 동작과 다름 |
| C | Android adaptive icon 조합·Expo 기본 아이콘·앱 splash 설정 | 웹 브랜드 디자인 규칙으로 사용하지 않음 |
| C | RN 배너 당김 확대 실험·마커 성능 A/B 플래그 | 현재 구현의 실험/최적화이며 웹 디자인 규칙이 아님 |

## 8. 신규 웹 디자인 토큰 초안

아래는 제안서이며 Tailwind 설정이나 Vue/Nuxt 소스에 적용하지 않았다. RN에서 옮긴 값도 실제 Pretendard·브라우저 렌더링 검증 전까지 디자인 시스템 확정으로 보지 않는다.

### 8.1 colors

| 웹 의미 토큰 초안 | 값 | 출처 |
| --- | --- | --- |
| brand.DEFAULT / soft / strong | #22C55E / #DCFCE7 / #15803D | RN 코드 + 메인 컬러는 웹 확정 |
| bg / surface / surfaceMuted | #FFFFFF / #F8FAFC / #F3F4F6 | RN 코드 |
| text.primary / secondary / inactive | #111827 / #6B7280 / #9CA3AF | RN 코드 |
| border.DEFAULT | #E5E7EB | RN 코드 |
| filter.selectedBg / selectedText | #111827 / #FFFFFF | RN 라이트 코드 |
| status.ongoing.bg / text | #DCFCE7 / #15803D | RN 코드 |
| status.upcoming.bg / text | #DBEAFE / #1D4ED8 | RN 코드 |
| status.ended.bg / text | #F3F4F6 / #6B7280 | RN 코드 |
| tag.bg / text | #F3F4F6 / #4B5563 | RN 코드 |
| favorite / error / destructive | #FF5A6E / #B91C1C / #DC2626 | RN literal의 의미 토큰화 제안 |
| more.bg / skeleton.bg | #F7F8FC / #F1F3F5 | RN 코드 |
| community.* | §4.1의 전용 palette | RN 코드. 기본 본문과 임의 통합하지 않음 |
| overlay | rgba(0,0,0,.4) | RN 코드 |
| action.primaryText | #111827 후보 | **웹 신규 제안**. RN primary 흰 글자의 대비를 검토한 뒤 결정. 메인 색상은 유지 |

보통 크기 글자에 대한 대비 계산에서 #22C55E/흰색 조합은 약 2.28:1이다. RN 값을 웹 전체 버튼에 기계적으로 적용하지 말고 primary 위 글자색과 focus 표시를 실제 화면에서 검토한다. 이 수치는 sRGB 상대휘도 계산이며 브라우저 접근성 테스트 결과는 아니다.

### 8.2 typography

- `fontFamily.sans`: `Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` — **Pretendard 사용은 웹 확정**, fallback 체인은 **웹 신규 제안**.
- 웹 폰트의 출처·사용권·WOFF2/variable 또는 정적 400/500/600/700·font-display: swap 적용 방식은 **웹 신규 제안/추후 검토**. 현재 RN Pretendard 에셋을 복사할 수 있는 상태가 아니다.
- 아래 rem 환산은 **웹 신규 제안**이며 기준은 루트 16px 가정이다. 원래 숫자 규격은 RN 코드 그대로다. 사용자 브라우저 글자 크기 확대를 막지 않는다.

| 토큰 | 크기 | 굵기 | 줄 높이 |
| --- | --- | --- | --- |
| display | 2rem | 700 | 2.5rem |
| titleL | 1.5rem | 700 | 2rem |
| titleM | 1.25rem | 700 | 1.75rem |
| titleS | 1.125rem | 600 | 1.625rem |
| body | 1rem | 400 | 1.5rem |
| label | .875rem | 500 | 1.25rem |
| caption | .75rem | 400 | 1.125rem |

컴포넌트 변형으로 `posterTitle=16/700/20`, `period=13/400/20`, `detailBody=14/400/22`, `latestTitle=15/700/20`을 분리할 수 있다. 숫자는 RN 근거이며 이름과 토큰화는 제안이다. letter-spacing 전역 토큰은 RN 공통 정의가 없어 이번 초안에서 확정하지 않는다.

### 8.3 spacing·radius·border

| 초안 | 값 | 출처/메모 |
| --- | --- | --- |
| space | 0,2,4,6,8,10,12,16,20,24,28,32,40,48,56,60px | RN 숫자 재사용. CSS px 표현은 웹 변환 |
| gutter.mobile | 16px | RN 기본 여백 계승 제안 |
| gutter.desktop | 24px | **웹 신규 제안**. 사용자 지정 열 사이 24와 별개의 외곽 gutter |
| card.gap / padding | 12px / 16px | RN 재사용 |
| section.gap | 32px 기본, 48/56px 큰 구분 후보 | RN에 모두 존재하나 화면별 적용을 통일하는 것은 웹 제안 |
| radius | 4/8/12/16/24px | RN 재사용 |
| radius.full | 9999px | **웹 신규 제안**. RN 999의 pill 의도 계승 |
| border.width / tab.indicator | 1px / 2px | RN 숫자 재사용. hairline은 1px 후보로 별도 웹 변환 |

Tailwind에는 `space-16`처럼 숫자를 px 의미로 임의 해석하지 말고 실제 생성 단위를 확인해야 한다. 예를 들어 기본 척도에서 `p-4`는 1rem이다. 사용자 spacing/radius를 의미 토큰·CSS 변수로 매핑하는 방식을 후속 구현에서 결정한다. Tailwind 버전·설정 문법은 이번에 결정하지 않았다.

### 8.4 shadows·motion

RN에는 공통 shadows 정의가 없으므로 아래 CSS 값은 **전부 웹 신규 제안**이다. 비슷한 RN 사용처를 출처로만 연결했다.

| 토큰 초안 | CSS 후보 | 참고 |
| --- | --- | --- |
| shadow.none | none | 기본 카드/화이트 헤더 |
| shadow.poster | `0 4px 12px rgba(0,0,0,.20)` | RN HomeBanner 포스터 |
| shadow.floating | `0 4px 16px rgba(0,0,0,.15)` | RN 글쓰기/찜 CTA |
| shadow.overlay | `0 8px 24px rgba(0,0,0,.12)` | 웹 dialog/popover용 신규 값 |
| motion.enter / exit | 200ms / 160ms | 시간은 RN 전용 시트 참고, 웹 적용 범위는 신규 제안 |

hover transition은 120ms 후보, prefers-reduced-motion에서는 이동·반복 pulse를 줄이는 방향으로 제안한다(**웹 신규 제안**). RN의 `ReduceMotion.Never`를 웹 정책으로 승계하지 않는다.

### 8.5 layout·breakpoints

| 항목 | 값 | 구분 |
| --- | --- | --- |
| layout.max | **1080px** | 웹 확정 |
| layout.main | **826px** | 웹 확정, 데스크톱 최대 레이아웃 |
| layout.right | **230px** | 웹 확정 |
| layout.gap | **24px** | 웹 확정 |
| 좌측 패널 | 없음 | 웹 확정 |
| 헤더 | 미니멀한 흰색 | 웹 확정 |
| header.height / border | 64px / 아래 1px #E5E7EB 후보 | **웹 신규 제안** |
| breakpoint.md | 768px | **웹 신규 제안**, 중간 폭 카드/헤더 조정 기준 후보 |
| breakpoint.desktop | 1128px | **웹 신규 제안**, 1080 + 외곽 gutter 24×2 확보 기준 |

`826 + 24 + 230 = 1080`이므로 1080은 **열과 열 사이 간격을 합한 내부 콘텐츠 최대 폭**으로 해석한다. 이 1080 안에 좌우 padding 24를 다시 빼면 확정 열 폭이 맞지 않는다. 외곽 gutter는 별도 래퍼에 두고 중앙 정렬하는 방향을 제안한다.

1128px 이상에서 위 2열을 유지하고 그 아래에서는 메인을 가용 폭에 맞추고 우측 패널을 아래로 이동하거나 접는 방향을 제안한다. 이동/접기 중 최종 방식과 모바일 패널 내용의 우선순위는 미정이다. 768px 미만은 1열 메인·외곽 16px을 후보로 둔다. 이 breakpoint와 전환 동작은 RN 근거가 없는 **웹 신규 제안**이다.

### 8.6 component styles

| 컴포넌트 | 초안 | 근거/새로 결정할 부분 |
| --- | --- | --- |
| Header | 흰색, 내부 max 1080, 가로 로고·내비·검색 등 최소 구성, shadow 없음 | 화이트·좌측 패널 없음은 확정. 높이/메뉴/로고 크기·sticky 여부는 **웹 신규 제안/미정** |
| PrimaryButton | 높이 48, radius 12, Label, #22C55E, pressed opacity .7 참고 | 크기는 MoreButton. 글자색·hover·focus는 **웹 신규 제안**, 대비 검토 후 확정 |
| MoreButton | 100%×48, #F7F8FC, radius 12, Label | RN 재사용. 키보드 focus 추가는 **웹 신규 제안** |
| FilterChip | 높이 36, px16, full, gap8, border1; 선택 #111827/흰색 | RN 재사용. DOM button/aria-pressed는 **웹 신규 제안** |
| StatusBadge | 운영/예정/종료 색상, 12/600/16, 작은 padding·radius | RN 목록 근거. 시각 badge와 클릭 필터를 구분 |
| PosterCard | 4:5 이미지 cover/radius8, 상태→제목→기간→메타, 기본 그림자 없음 | RN 목록 재사용. 웹 열 수·너비는 **웹 신규 제안/미정** |
| PosterCarousel | 세로 포스터 중심, 전경 contain으로 원본 보존. 프레임 3:4, 데스크톱 높이 360px 후보 | 세로 포스터 중심은 웹 확정. 3:4/360px·이전/다음 버튼·키보드·자동재생 기본 없음은 **웹 신규 제안** |
| DetailHero | contain 포스터와 안정된 viewport, 필요 시 블러 배경 | RN 시각 원칙 계승. 826px를 그대로 정사각 높이로 쓰지 않고 높이/모바일 비율 **추가 설계** |
| SearchInput | 높이 48, radius12, border1, px16, 글자16 | RN 목록 재사용. focus-visible ring 2px #15803D/offset2px 후보는 **웹 신규 제안** |
| Textarea | padding16, radius12, border1, Body, min-height220 참고 | RN 작성 근거. 자동 높이/resize·오류 연결은 **웹 신규 제안** |
| CommunityFeed | 흰 목록, 1px divider, compact 썸네일·review 별도 구성 | RN 정보 위계 재사용. 826px에서 본문 폭/이미지 높이는 **추가 설계** |
| Dialog/Popover | 흰 면, radius16~24, dim .4 후보 | RN 시트 참고. 닫기 버튼·Escape·focus 복원/가두기·scroll lock은 **웹 신규 제안** |
| RightPanel | 230px, 흰색 바탕과 간결한 섹션, 메인과 gap24 | 폭/위치는 확정. 콘텐츠·sticky·모바일 배치는 **추가 설계** |

포스터 **전경은 contain**, 목록 썸네일은 cover로 역할을 나눈다. 모든 원본이 세로 이미지라는 가정은 하지 않는다. 캐러셀의 3:4 프레임은 RN 목록 4:5와 구별되는 신규 후보이며, 실제 세로·정사각·가로 포스터로 비교한 뒤 결정한다.

## 9. 후속 설계에서 확인할 항목

1. Pretendard의 실제 웹 배포 파일·weight·fallback과 한/일 문자열 줄바꿈. RN 기본 폰트 화면과 동일하게 보인다고 가정하지 않는다.
2. 웹 헤더용 P 심볼/워드마크 원본과 favicon. Expo 기본 아이콘을 브랜드 에셋으로 착각하지 않는다.
3. 우측 패널 내용과 작은 화면에서의 위치, 헤더 sticky 여부·검색 배치. 사용자 확정 열 폭은 유지하되 breakpoint는 검토한다.
4. 세로 캐러셀 프레임·포스터 폭·카드 수·페이지 표시·키보드 조작·정사각/가로 포스터 처리.
5. Primary 버튼 텍스트 대비와 hover/focus/error/disabled의 공통 상태. RN에 없는 상태값을 기존 규칙으로 표시하지 않는다.
6. 웹 지도 공급자·검색·마커/목록 패널·정적 지도 대체 상태와 이미지/아이콘 사용권. 현재 웹 지도 안내 화면을 지도 구현으로 오인하지 않는다.
7. 사진 에셋 출처·크기별 최적화와 운영 포스터 URL/캐시 처리. RN 사진 파일이나 API 키를 단순 복사하지 않는다.

## 10. 작업 및 검증 기록

- RN 소스·에셋·문서는 읽기만 수행했다. 웹 애플리케이션 소스·설정·의존성·백엔드/DB를 수정하지 않았다.
- 패키지 설치, 에셋 복사, 앱 실행, Git commit/push를 수행하지 않았다. 작성 파일은 `C:\dev\popchive-web\docs\RN_DESIGN_SYSTEM_AUDIT.md`다.
- 파일 존재·실제 import·토큰 값·화면별 StyleSheet·이미지 크기와 일부 이미지 시각 확인을 수행했다. 테스트와 빌드는 문서 조사 범위이므로 실행하지 않았다.
- 웹 `git status`는 저장소 소유권 검사(dubious ownership)로 조회되지 않았다. 이를 해결하기 위한 Git 설정 변경은 하지 않았다. 따라서 Git diff로 전체 작업 트리 무변경을 검증했다는 의미는 아니다.
- 이 보고서의 웹 신규 값은 검토 후보이며 디자인 시스템의 임의 확정이나 구현 완료 기록이 아니다.
