# 팝카이브 웹 디자인 시스템 기초

작성일: 2026-10-24. 현재 `/design` 화면은 컴포넌트 검토용 임시 개발 프리뷰다. `/`에는 실제 이미지 3장의 Embla 포스터 캐러셀과 임시 오늘의 팝업 박스를 표시한다. 실제 서비스 데이터·API·인증·SEO·지도는 구현하지 않았다.

공통 데스크톱 Sticky 헤더를 프리뷰 위에 추가했다. 헤더에는 로고를 표시하지 않으며 모바일 최종 디자인은 미정이다.

## 구성과 실행

- Nuxt 4.6.2 + Vue 3.5.44, Tailwind CSS 4.3.3 + `@tailwindcss/vite` 4.3.3.
- [Tailwind 공식 Nuxt 가이드](https://tailwindcss.com/docs/installation/framework-guides/nuxt)에 따라 Vite 플러그인을 `nuxt.config.ts`에 등록하고 `app/assets/css/main.css`를 전역 로드한다. CSS의 `@import 'tailwindcss'`와 `@theme inline`을 사용한다. 별도 Tailwind Nuxt 모듈·PostCSS 설정·UI 라이브러리는 추가하지 않았다.
- `@lucide/vue` **1.61.0** 안정판으로 전환했다. [공식 Vue 안내](https://lucide.dev/guide/vue/getting-started), [전환 안내](https://lucide.dev/guide/vue/migration) 및 npm `latest=1.61.0`, peer `vue >=3.0.1`을 확인했다. next/nightly는 사용하지 않았다. `lucide-vue-next` 1.0.0은 제거했고 lockfile에도 남지 않는다.
- Nuxt 4.6.2/Vue 3.5.44/TypeScript 6.0.3에서 타입 검사·SSR 빌드·브라우저 hydration을 확인했다. 사용 중인 ArrowRight·Check·Heart·Search 네 개의 SVG 내부 도형이 구 패키지와 동일함을 SSR 결과로 비교했다. 라이브러리 전체 아이콘의 동일성을 의미하지는 않는다.
- 타입 검사: TypeScript `~6.0.3`, vue-tsc `^3.3.13`. 설치 시 최신 TypeScript 7.0.2와 vue-tsc 조합이 `ERR_PACKAGE_PATH_NOT_EXPORTED`를 일으켜, 실제 검사에 통과하는 6.0 계열로 제한했다.

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

`npm run dev`가 출력하는 로컬 주소에서 프리뷰를 볼 수 있다. 포트가 비어 있으면 기본값은 3000이다. 설치된 Node 22.23.3으로 검증한다. Windows에서 nvm shim이 “No active Node.js version”이라고 표시하면 실제 Node 설치 경로를 해당 터미널의 PATH 앞에 두어 실행한다. 프로젝트에 사용자별 절대 경로를 하드코딩하지 않는다.

## 메인 포스터 캐러셀 (2026-10-24)

- `app/components/home/HomePopupCarousel.vue`를 `app/pages/index.vue`에서 사용한다. 부모의 `posters`는 id/src/alt/원본 크기를 가진 원본 3개다. `public/SaveClip.App_` 이미지 파일의 이름·위치·내용은 유지했다. 향후 API 데이터도 이 props 경계로 전달할 수 있다.
- **`embla-carousel-vue` 8.6.0 안정판**을 정확한 버전으로 설치했다. npm `latest=8.6.0`, Vue peer `^3.2.37`을 확인했고 Nuxt4.6.2/Vue3.5.44에서 검증했다. 공식 사이트의9.0 RC는 사용하지 않았다. [공식 Vue v8 사용법](https://www.embla-carousel.com/docs/v8/get-started/vue), [옵션](https://www.embla-carousel.com/docs/v8/api/options), [이벤트](https://www.embla-carousel.com/docs/v8/api/events)를 따른다.
- 옵션은 `align: 'center'`, `containScroll: false`, `slidesToScroll: 1`, `dragFree: false`, `skipSnaps: false`, **`loop: true`**다. `containScroll`의 기본 trimSnaps가 가장자리 중앙 정렬을 바꾸지 않도록 false로 지정했다.
- Embla는 트랙 길이가 부족하면 loop를 자동 해제한다. 원본3장/826px viewport/340px 카드 조합의 실제 동작과 표시용6장 조합을 브라우저에서 비교한다. 원본 데이터는 늘리지 않고 컴포넌트 내부 표시 배열만 `[1,2,3,1,2,3]`으로 구성했다. 초기 물리 인덱스3에서 원본1이 중앙이며 양옆은3과2다. 내부 API 수정·임의 위치 점프·자동 재생은 없다.
- 인디케이터는 원본3개만 생성한다. 물리 인덱스를 원본 논리 인덱스로 변환하며, 클릭 시 동일 원본의 두 후보 중 순환 거리가 가장 짧은 슬라이드를 선택한다. 끝→처음에서도 먼 역방향 이동을 피한다. 현재 물리 슬라이드만 접근성 트리에 노출하고 나머지는 `aria-hidden` 처리한다. 카드 클릭 목적지는 아직 없으며 향후 추가 시 원본 id를 사용하고 숨겨진 복제본의 포커스 요소를 함께 관리해야 한다.
- 데스크톱 viewport826×400px, 중앙 카드340×400px, 슬라이드 간격16px, radius8px. 오른쪽은 기존230×400px, 외부 간격24px를 유지한다. 양옆 슬라이드 슬롯의 노출은 `(826 - 340 - 32) / 2 = 227px`다. 내부 카드만 scale0.94/brightness0.88을 적용하므로 실제 포스터 노출은 각216.8px, 양옆 카드 크기는319.6×376px다. 중앙은 scale1/brightness1/opacity1이다.
- 카드 transform/filter 전환은250ms다. 회전·perspective·translateZ·blur·그림자는 없다. Embla 자체의 트랙 이동은 라이브러리가 생성하는 `translate3d(x,0,0)`를 사용하지만 z축 깊이 효과를 추가하지 않는다. 마지막 슬라이드의 끝 여백16px도 지정해 loop 경계의 간격을 유지한다.
- 이미지는 cover/center이며 원본 비율을 유지해 자른다. 이미지 기본 드래그와 텍스트 선택을 막고, 실패 시 안내문으로 대체한다. SSR 직후 실패도 확인한다. 별도 제목·그라데이션·API 연결은 없다.
- 하단 별도 공간에3개 도트를 배치한다. 비활성#D1D5DB/6×6px, 활성brand#22C55E/18×6px, 버튼 간격8px, 클릭 영역24×32px다. 접근성 이름·aria-current·전역 focus-visible과 좌우/Home/End 키를 제공한다.
- `select/reInit`에서 활성 상태를 동기화하고 이벤트를 해제한다. 공식 Vue composable이 언마운트 시 Embla를 파괴한다. reduced-motion에서는 CSS 전환을 끄고 인디케이터/키보드 이동을 즉시 처리한다.
- 기존1120px 미만1열·좌우20px 구조를 유지한다. 캐러셀 최대826px, 카드 너비`min(340px, 100%)`로 좁은 화면의 넘침을 방지한다. 카드 높이는400px로 유지하며 모바일 최종 디자인은 확정하지 않았다.

### 캐러셀 검증 결과

- `npm run typecheck`, `npm run build` 통과. Chrome 실제 프로덕션 프리뷰에서 DevTools Protocol로 마우스·터치 입력을 전달해 검증했다. 물리 모바일 기기 검증은 수행하지 않았다.
- 동일한 기하 조건에서3장만으로 요청한 loop는 끝에서 다음/처음에서 이전 이동이 불가능해 자동 해제를 확인했다. 표시용6장은 양쪽 경계에서도 이동 가능했다. 공식 public API만 이용해 비교했으며 라이브러리 내부를 변경하지 않았다.
- 1440px 화면: viewport826×400, 중앙340×400, 중앙 좌표593px로 viewport 중앙과 오차0px, 양옆 슬롯227px/실제 포스터 약216.8px. 우측 패널230×400, 카드와 상단 정렬. 별도 하단 도트 공간 포함 캐러셀 전체 높이444px.
- 마우스 드래그로 `3-1-2 → 1-2-3 → 2-3-1 → 3-1-2` 확인. 이어서 터치 스와이프를 정방향12회·역방향12회 연속 실행해 같은 순환 순서를 확인했다. 이동 중·스냅 완료 후114개 시점에서 viewport 경계와16px 슬롯 간격을 검사했고 루프 경계의 빈 공간·간격 변화는 발견하지 않았다.
- 도트 클릭6회, Enter 선택, 방향키 경계 이동, reduced-motion의0s 전환, `/design` 왕복 시 해제·재초기화 및 헤더1개 유지를 확인했다. 인디케이터는 항상3개이며 논리 인덱스와 일치했다. 콘솔 경고·예외·hydration 오류 없음. 캡처에서도 깜빡임이나 빈 영역은 발견하지 않았으나 모든 기기에서의 프레임 단위 무결성을 보장하는 결과는 아니다.
- viewport1280/1080/768/375/320px에서 페이지 가로 넘침 없음. 캐러셀 실측 폭은 각각826/826/728/335/280px, 중앙 카드 폭340/340/340/335/280px, 높이는 모두400px이며 중앙 오차0px였다.
- `app/app.vue`, `AppHeader.vue`, `design.vue`, `main.css`, `nuxt.config.ts`는 작업 전후 SHA-256이 동일하다. 기존 보안 취약점 high7은 이번 설치로 증가하지 않았으며 이전 분석과 후속 조치는 아래 보안 절을 따른다.
- 로컬 검증 산출물(모두 Git 제외): `.data/check-carousel.mjs`, `.data/carousel-verification.json`, `.data/home-popup-carousel-1440.png`. 이번 제품 변경 파일은 `app/components/home/HomePopupCarousel.vue`, `app/pages/index.vue`, `package.json`, `package-lock.json`, 이 문서다.

## 토큰의 출처

근거 문서는 [RN 조사 보고서](./RN_DESIGN_SYSTEM_AUDIT.md)다. RN 문서의 의도만 존재하는 값과 실제 코드 값을 혼동하지 않는다. `main.css`에서 `--ds-*`는 원본 CSS 변수이고 `@theme inline`은 Tailwind 유틸리티 연결이다. 같은 값의 별도 TS 토큰 객체는 만들지 않았다.

| 구분 | 이번 적용 |
| --- | --- |
| RN 실제 코드 재사용 | 브랜드·텍스트·배경·경계·태그·찜·선택 필터·상태 색상, spacing 16개, radius 5개, typography 7개, 버튼 48px/radius12 |
| RN 문서 의도 + 웹 사용자 확정 | Pretendard. RN 실제 로딩은 확인되지 않았으므로 웹에서 새로 로드 |
| 웹 신규 제안 | rem 환산, full=9999px, primary 짙은 글자, 종료 배지의 tag-text 적용, hover·focus-visible·disabled·reduced-motion, 칩 최소 높이44px, secondary 버튼의 진한 경계, 임시 텍스트 로고 |
| 이번 미적용 | RN 화면별 타이포 override·커뮤니티 전용 palette·그림자·다크 모드·최종 모바일 서비스 breakpoint |

`/design`의 1080px 래퍼와 Tailwind 기본 `sm`/`md`는 샘플 배치다. `/`는 사용자 확정의1080 = 826 + 24 + 230px 구조를 사용한다. 데스크톱 헤더는64px이며 우측 패널 내용, 최종 모바일 레이아웃·헤더 구성은 미정이다. 캐러셀 치수와 효과는 웹 사용자 확정 사양이며 RN 공통 토큰으로 추가하지 않았다.

### 색상

| CSS 변수 (`--ds-` 생략) | 값 | Tailwind 예시 |
| --- | --- | --- |
| brand / brand-soft / brand-strong | #22C55E / #DCFCE7 / #15803D | `bg-brand`, `bg-brand-soft`, `text-brand-strong` |
| background / surface | #FFFFFF / #F8FAFC | `bg-background`, `bg-surface` |
| text / secondary | #111827 / #6B7280 | `text-foreground`, `text-secondary` |
| border | #E5E7EB | `border-border` |
| tag / tag-text | #F3F4F6 / #4B5563 | `bg-tag`, `text-tag-text` |
| favorite | #FF5A6E | `text-favorite` |
| filter-selected / filter-on-selected | #111827 / #FFFFFF | `bg-filter-selected`, `text-filter-on-selected` |
| info-soft / info-strong | #DBEAFE / #1D4ED8 | `bg-info-soft`, `text-info-strong` |
| on-brand / focus | text / brand-strong 참조 | `text-on-brand`, 전역 focus outline |
| disabled-bg / disabled-text | tag / secondary 참조 | `bg-disabled-bg`, `text-disabled-text` |

브랜드 초록 위 흰색 글자는 약 2.28:1이므로 기본 primary는 #111827 글자를 사용한다(**웹 신규 제안**). 색상값을 바꿀 때는 상태 조합과 대비도 함께 재검토한다. favorite는 현재 장식 아이콘에만 사용하며 작은 글자나 필수 단독 액션 표시용 색상으로 확대하지 않는다.

### 간격과 모서리

- spacing: `0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 48, 56, 60`.
- `--ds-space-16: 1rem`처럼 루트16px 기준으로 변환했다. 사용자 글자 확대를 막는 html font-size 고정은 없다.
- `p-rn-16`, `gap-rn-12`, `mt-rn-24`, `min-h-rn-48`처럼 **rn 접두어를 사용**한다. Tailwind 기본 `p-16`은 16px가 아니라 4rem이므로 혼용하지 않는다.
- radius: `4, 8, 12, 16, 24`를 rem으로 연결한다. `rounded-rn-12`, `rounded-rn-24`. `rounded-pill`은 웹 신규 값9999px다.

### 타이포그래피

| 클래스 | 크기 / 굵기 / 줄 높이 (루트16px 기준) |
| --- | --- |
| `type-display` | 32 / 700 / 40 |
| `type-title-l` | 24 / 700 / 32 |
| `type-title-m` | 20 / 700 / 28 |
| `type-title-s` | 18 / 600 / 26 |
| `type-body` | 16 / 400 / 24 |
| `type-label` | 14 / 500 / 20 |
| `type-caption` | 12 / 400 / 18 |

`type-*`는 크기·굵기·행간을 묶은 레시피다. `text-title-m` 같은 Tailwind 글자 유틸리티는 크기·행간만 설정하므로 굵기를 따로 지정할 때 사용한다. 예: `text-title-m font-bold`. 의미에 맞는 h1~h3·p·button을 유지하며 글자 모양 때문에 heading 레벨을 선택하지 않는다.

## Pretendard 파일과 라이선스

- 원저작자: Kil Hyung-jin / orioncactus, Reserved Font Name Pretendard.
- [공식 저장소](https://github.com/orioncactus/pretendard), 고정 버전 **v1.3.9**.
- [공식 Dynamic Subset CSS](https://raw.githubusercontent.com/orioncactus/pretendard/v1.3.9/packages/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css)와 같은 폴더의 `woff2-dynamic-subset/PretendardVariable.subset.{0..91}.woff2`를 사용한다.
- `app/assets/css/pretendard.css`는 공식 CSS에서 URL만 `/fonts/pretendard/v1.3.9/` 로컬 경로로 변경했다. 저작권 고지, unicode-range, weight45~920, `font-display: swap`은 유지했다. 원본 CSS SHA-256은 `2973bcae80262dcb630cfb793fbf6af29bd986c769ee54953fb3e5b3e32323ca`다.
- 로컬 WOFF2는 `public/fonts/pretendard/v1.3.9/woff2-dynamic-subset/`의 **92개**, 합계 **2,957,724 bytes**다. 폰트 바이너리는 수정하지 않았다. 파일별 크기·SHA-256과 출처는 같은 버전 디렉터리의 `manifest.json`에 기록했다.
- 이전 전체 WOFF2는 2,057,688 bytes(SHA-256 `9599f12fd42fc0bce1cd50b47a0c022e108d7aa64dd0d1bb0ed44f3282d900b4`)였다. 참조 교체·브라우저 검증 후 삭제했다. 전체 폰트 묶음의 디스크 용량은 오히려 약44% 늘지만 초기에는 필요한 분할 파일만 다운로드한다.
- 라이선스: [SIL Open Font License 1.1 원본](https://raw.githubusercontent.com/orioncactus/pretendard/v1.3.9/LICENSE). 전문을 `public/fonts/pretendard/OFL.txt`에 동봉했다. 재배포 시 고지를 보존한다.
- CSS font-family는 `'Pretendard Variable'`다. CSS 변수/타이포그래피 크기·굵기·행간은 유지했다. 런타임 CDN이나 별도 대형 일본어 웹폰트 의존성은 없다. RN 에셋을 가져온 것이 아니다.
- 폰트 전부를 preload하지 않는다. [unicode-range](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@font-face/unicode-range)에 따라 실제 텍스트에 필요한 face만 요청한다. 같은 variable 파일을400/500/600/700에서 공유하므로 굵기별 중복 파일을 받지 않는다.
- [font-display: swap](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@font-face/font-display)은 폴백으로 먼저 표시하고 로딩 후 웹폰트로 교체한다. 글자 모양·폭 차이로 레이아웃 이동이 생길 가능성은 남는다. 샘플 검증값은 아래에 별도 기록했다.

### 일본어 범위와 폴백

공식 CSS의 unicode-range 합집합을 계산하면 한국어 배포본은13,154 code point/92 face, [JP 배포본](https://raw.githubusercontent.com/orioncactus/pretendard/v1.3.9/packages/pretendard-jp/dist/web/variable/pretendardvariable-jp-dynamic-subset.css)은16,368 code point/119 face다. 이는 **선언된 범위의 수**이며 모든 Unicode 문자·일본어 인명 한자 지원을 보장하는 숫자는 아니다.

한국어판은 조사 샘플의 한글·영문·숫자·기호를 전부 포함하지만 일본어 전체는 포함하지 않는다. 예를 들어 `渋 谷 宿 阪 限 催 ゔ ゕ ゖ ヷ ヸ ヹ ヺ 髙 﨑 𠮷`는 한국어판 CSS 범위에 없다. JP판은 이 일본어 샘플을 포함하지만 한글 샘플 음절은 제공하지 않는다. 그래서 한국어판을 JP판으로 교체하거나 두 묶음을 무조건 동시에 추가하지 않았다.

현재 폴백 순서:

```css
'Pretendard Variable', Pretendard, 'Hiragino Sans',
'Yu Gothic', Meiryo, 'Noto Sans JP', -apple-system,
BlinkMacSystemFont, 'Segoe UI', sans-serif
```

- 한국어·영문·숫자는 지원되는 Pretendard Variable 분할 파일에서 표시한다.
- 일본어는 Pretendard 지원 글리프를 먼저 사용하고 부족한 문자는 **기기에 설치된** 일본어 폴백으로 넘긴다. 위 이름은 local/system 폴백이며 Noto Sans JP를 네트워크로 내려받는 설정이 아니다.
- Windows Chrome에서는 Yu Gothic의 Regular/Medium/Bold와 일부 로컬 Pretendard가 실제로 사용됨을 DevTools `CSS.getPlatformFontsForNode`로 확인했다. 로컬 Pretendard가 없는 기기에서는 그 다음 폴백으로 이동한다.
- 추가로 테스트 브라우저에서 로컬 Pretendard 폴백만 제외해도400/500/600/700 모두 웹 Pretendard + Yu Gothic으로 일본어 샘플이 표시되고, 캡처에 누락/네모 대체가 없는 것을 확인했다. 앱의 기존 Pretendard 폴백은 그대로 유지했다.
- 일본어 데이터에는 `lang="ja"`를 표시하는 것이 향후 서비스의 권장 방향이다. 이번에는 실제 페이지를 추가하지 않았으며 테스트 문서에만 ko/ja 언어를 지정했다.
- 폴백 설치 상태와 글자 형태는 OS마다 다르다. iOS/macOS/Android 실기기, 모든 희귀 인명 한자의 무결함 지원은 이번 결과로 보장하지 않는다. 향후 특정 기기에서 누락이 확인되면 해당 문자의 지원을 확인한 JP 서브셋을 제한적으로 도입할 수 있다.

### 캐시와 전후 실측

`nuxt.config.ts`는 버전 고정 경로 `/fonts/pretendard/v1.3.9/**`에만 `Cache-Control: public, max-age=31536000, immutable`을 설정한다. 로컬 프로덕션 응답에서 이 헤더·ETag·Content-Length를 확인했다. 폰트/CSS를 갱신할 때 기존 immutable URL을 덮어쓰지 말고 버전 경로도 바꾼다. 폰트 CSS는 Vite의 해시가 포함된 앱 CSS에 묶인다. 라이선스 `/fonts/pretendard/OFL.txt`에는 이 immutable 규칙을 적용하지 않는다. 실제 운영 배포·CDN 설정은 변경하지 않았다.

**아래는 추정치가 아닌 로컬 Chrome 실측**이다. 최적화 전후 동일 환경/문자/400·500·600·700 조합을 사용했다. cold는 브라우저 캐시를 비운 후, warm은 직후 같은 문서로 재탐색했다. 요청 개수는 Resource Timing에 기록된 WOFF2 리소스 수이고 warm에서는 실제 재전송 없이 캐시에서 제공될 수 있다. 전송량은 `PerformanceResourceTiming.transferSize` 합계로 HTTP 오버헤드를 포함한다. 본문 크기는 `encodedBodySize`다.

| 문서 | 전 요청 수 | 후 요청 수 | 전 폰트 전송량 | 후 폰트 전송량 | 후 WOFF2 본문 합계 | 전송량 감소 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 헤더 추가 전 프리뷰 전체 문서, 초기 로드 | 1 | 14 | 2,057,988B | 371,356B | 367,156B | 81.96% |
| 한국어 긴 제목/본문 샘플 | 1 | 8 | 2,057,988B | 208,700B | 206,300B | 89.86% |
| 일본어 히라가나·가타카나·한자 샘플 | 1 | 13 | 2,057,988B | 336,796B | 332,896B | 83.63% |
| 한국어·일본어 혼합 샘플 | 1 | 11 | 2,057,988B | 278,160B | 274,860B | 86.48% |
| 위 문서의 warm 재방문 | 1 | 14/8/13/11 | 0B | 0B | 캐시된 본문 크기는 동일 | 추가 전송 없음 |

실제 서비스 한국어·일본어 페이지는 아직 없다. 한국어/일본어 행은 브라우저에서 실제 앱 CSS·로컬 폰트를 쓰도록 만든 **합성 테스트 문서**의 값이다. 서비스 화면 트래픽의 측정값으로 해석하지 않는다. 프리뷰 행은 **폰트 최적화 작업 당시, 공통 헤더 추가 전**의 `/` 화면을 스크롤하지 않고 로드한 전체 문서 기준이다. 폰트 요청은 보이는 viewport뿐 아니라 레이아웃된 문서의 문자에 영향을 받는다.

샘플은 `.data/font-samples.mjs`에 기록했다. 예: 한국어 `성수에서 만나는 새로운 팝카이브 한정 팝업스토어…`, 일본어 `東京・渋谷・新宿・大阪・京都…ひらがな…カタカナ…髙﨑𠮷`, 영문/숫자/기호 `POPCHIVE 2026 10:30 ¥₩ !? & + @ # % — ·` 및 혼합 문장. 숫자는 해당 문자열에 종속되며 글자가 늘면 더 많은 서브셋이 요청될 수 있다.

공식 분할 CSS 원본은55,760B다. 프로덕션 엔트리 CSS는 약13.58KB→64.46KB(빌드 gzip 추정3.68KB→18.40KB)로 증가했다. 위 전송량 표는 **폰트만** 측정하며 이 CSS 비용을 포함하지 않는다. 이를 감안해도 현재 문서의 초기 폰트 비용은 크게 감소했다.

400/500/600/700 각각 실제 platform font의 Regular/Medium/SemiBold/Bold 매핑을 확인했다. 샘플 캡처에서 누락/네모 대체를 발견하지 않았고 콘솔 오류도 없었다. 일반 및 느린 혼합 샘플(지연150ms·다운로드200,000B/s)에서 PerformanceObserver의 layout-shift 합계는 전후0이었다. 전체 서비스나 모든 OS에서 CLS가0이라는 보장은 아니다.

## 공통 헤더

컴포넌트: `app/components/layout/AppHeader.vue`. `app/layouts/default.vue`와 `app/layouts/preview.vue`에서 재사용한다. `app/app.vue`는 `NuxtLayout` 안에 `NuxtPage`를 배치하며 각 페이지에서는 헤더를 렌더링하지 않는다. API·인증 코드는 포함하지 않는다.

- 전체 너비100%, 높이64px(하단 선 포함), 불투명 `--ds-background`, 하단1px `--ds-border`, box-shadow:none.
- `position:sticky; top:0; z-index:40`. 스크롤 전후 같은 흰색/선/그림자 없음. 기존 스킵 링크는 z-index50으로 위에 표시한다. 본문 앵커에는80px scroll-margin을 둔다.
- 내부 너비 `calc(100% - 40px)`, 최대1080px, margin-inline:auto. 좌우 최소20px은 최대 폭 바깥에 확보한다.
- Grid 열은 `minmax(0,1fr) auto minmax(0,1fr)`, 열 사이16px이다. 동일한 좌우 열 덕분에 오른쪽 액션 폭이 중앙 메뉴를 밀지 않는다. 액션은 마지막 열의 오른쪽 정렬이다.
- 왼쪽은 빈 영역이고 `brand` slot만 준비했다. 현재 slot을 전달하지 않아 P 심볼·POPCHIVE 텍스트 로고가 모두 없다. 기존 `BrandLogo.vue`는 보존했고 프리뷰에서도 렌더링하지 않는다.
- 메뉴 gap32px, 16px/500, 비활성 `--ds-secondary`. 현재 경로와 일치하는 구현된 링크는 `--ds-text`/600 및 aria-current=page만 적용한다. 밑줄·배경·초록색 강조는 없다.
- 오른쪽 gap18px. Search는20px SVG/40×40px 버튼, 로그인은14px 텍스트, 회원가입은 높이36px·padding-inline14px·radius6px·1px border다. 기존 색상·글꼴 토큰은 수정하지 않았다.64/40/36px, radius6px, breakpoint900px 등은 이번 웹 헤더 요청에 따른 지역 규칙이다.

### 경로와 미구현 동작

홈은 `NuxtLink to="/"`이며 현재 `/`의 포스터 캐러셀 레이아웃을 가리킨다. 홈 서비스가 완성되었다는 의미는 아니다. 팝업 탐색·지도·커뮤니티는 목적지를 `null`로 두고 href 없는 비활성 링크로 표시한다(aria-disabled, tabindex=-1, 접근성 이름·title에 준비 중). 없는 경로로 연결하거나 가짜 서비스 페이지를 만들지 않았다. 실제 페이지가 생기면 items의 목적지를 넣어 동일한 NuxtLink 분기를 사용한다.

검색·로그인·회원가입은 native disabled 버튼이다. title에 준비 중 상태를 표시하고 액션 그룹에도 준비 중이라는 접근성 이름을 제공한다. 검색 버튼 aria-label은 `검색`이다. 클릭해도 라우트 이동·API·빈 모달이 없다. 프리뷰 본문 상단에 홈 외 메뉴와 검색·인증이 준비 중임을 텍스트로 표시한다.

키보드로 스킵 링크→홈→본문의 활성 예시 버튼으로 이동한다. 준비 중인 링크·버튼은 탭 순서에서 제외된다. 전역 focus-visible과 ds-control의 reduced-motion 규칙을 재사용한다. 활성 링크는 hover 시 텍스트 색상만 사용하며 비활성 placeholder에 hover 액션을 추가하지 않았다.

### 헤더 반응형과 실측

**900px 이상**은3영역 헤더이며1080px 이상 요구를 충족한다. **900px 미만**은 임시 최소 헤더로 가운데 홈만 표시하고 미구현 메뉴·액션·빈 좌측 열을 숨긴다. 햄버거·드로어·하단 내비게이션은 추가하지 않았다. 모바일 최종 디자인은 별도 확정 대상이다.

Pretendard 로딩 후 메뉴 폭은 약290.53px, 액션은190.72px다. 대칭 Grid에서 필요한 최소 내부 폭은 `290.53 + 190.72×2 + 16×2 = 약703.97px`다.900px viewport의 실제 내부 폭845px(테스트 Chrome의 세로 스크롤바15px 제외)에서 충분한 여유가 있어900px를 안전한 전환점으로 선택했다. 이후 로고나 메뉴·언어·액션 구성이 늘면 다시 측정해야 한다.

| 브라우저 viewport | 내부 폭 실측 | 메뉴 중심과 컨테이너 중심 차이 | 결과 |
| --- | ---: | ---: | --- |
| 1440px | 1080px | 0px | 메뉴4개·액션 정상 |
| 1280px | 1080px | 0px | 메뉴4개·액션 정상 |
| 1081 / 1080 / 1079px | 1026 / 1025 / 1024px | 모두0px | 겹침 없음 |
| 901 / 900px | 846 / 845px | 모두0px | 겹침 없음 |
| 899 / 768 / 375 / 320px | 844 / 713 / 320 / 265px | 모두0px | 홈만 표시, 가로 넘침 없음 |

로컬 프로덕션 Chrome 검증: typecheck/build 통과, 콘솔 오류·경고 없음, 스크롤600px 후 header.top=0, 흰 배경·하단1px 선·shadow:none 유지. Tab/focus-visible(2px #15803D)·disabled 동작·기존 프리뷰 버튼 클릭·reduced-motion을 확인했다. Pretendard 로딩, Lucide Search20px, 버튼 크기·모서리도 확인했다. 이 결과는 데스크톱 Chrome 반응형 viewport 검사이며 모바일 실기기 검사는 아니다.

스크린샷: `.data/header-1440.png`, `header-1280.png`, `header-1080.png`, `header-375.png`, `header-320.png`. 검사 원본은 `.data/check-header.mjs`, 결과는 `.data/header-verification.json`이며 모두 Git 제외 로컬 산출물이다.

이번 헤더 작업 변경 파일은 `app/components/layout/AppHeader.vue`(추가), `app/app.vue`, `docs/WEB_DESIGN_SYSTEM.md`다. 토큰 CSS·BrandLogo·패키지·Nuxt 설정은 변경하지 않았다.

## 페이지 구성

Nuxt 4 파일 기반 라우팅:

| 파일 | 경로 | 역할 |
| --- | --- | --- |
| `app/app.vue` | 공통 | 스킵 링크, NuxtRouteAnnouncer, NuxtLayout → NuxtPage |
| `app/layouts/default.vue` | 기본 레이아웃 | AppHeader + 1080px Grid(826 + 24 + 230), 본문 스킵 링크 대상과 slot. 헤더 아래24px, 1120px 미만1열 |
| `app/components/layout/TodayPopupSidebar.vue` | 공통 사이드바 | 230×400px 회색 임시 패널, Sticky top88px, 1120px 미만 숨김. 실제 데이터 미연동 |
| `app/pages/index.vue` | `/` | 왼쪽 콘텐츠: 캐러셀과48px 아래 인기 카테고리. 포스터 데이터 유지 |
| `app/layouts/preview.vue` | 프리뷰 레이아웃 | AppHeader + slot, 기존 프리뷰 폭 보존 |
| `app/pages/design.vue` | `/design` | preview 레이아웃 사용. 기존 색상10개·타이포7단계·간격·모서리·버튼·필터·상태 배지·아이콘 예시와 상태 관리 |

공통 레이아웃 결정은 [DECISIONS.md](./DECISIONS.md)를 따른다. 아래 라우팅 복구·검증 기록은 공통 레이아웃 분리 이전의 이력이다. 이번 분리에서는 테스트·빌드를 실행하지 않았다.

기존 박스가 이미 구현되어 있어 새 구현 시의 대체 조건(높이400px/상단32px)은 적용하지 않았다. 프리뷰에 새 컴포넌트 예시를 추가할 때는 `design.vue`에 추가한다. 페이지별 헤더·전역 CSS·폰트 로딩을 중복 등록하지 않는다. 헤더 디자인·토큰·Nuxt 설정은 변경하지 않았다.

작업 시작 시 `app.vue` 상단이 끊겨 script와 template이 섞인 상태였으므로 기존 프리뷰 구성을 기준으로 상단 선언을 복구했다. 남아 있던 프리뷰 본문은 그대로 옮겼다. 작업 전 원본은 Git 제외 `.data/routes-before-app.vue`에 보관했다.

검증: `npm run typecheck`, `npm run build` 통과. 실제 Chrome에서 두 경로를 직접 열어 각각 헤더1개/main1개인지 확인했다.1440/768/375/320px에서 가로 넘침 없음. `/design`의4개 섹션·색상10개·타이포7개·아이콘4개, 버튼 클릭/초기화·칩 토글·disabled 동작과 헤더 홈 링크를 통한 `/` 이동을 확인했다. 콘솔 오류·경고 없음. 결과는 `.data/pages-verification.json`, 캡처는 `.data/pages-index-1440.png`, `.data/pages-design-1440.png`다.

이번 라우팅 변경 파일: `app/app.vue`, `app/pages/index.vue`, `app/pages/design.vue`, `README.md`, `docs/WEB_DESIGN_SYSTEM.md`.

## 컴포넌트 사용

공통 UI 컴포넌트 `BaseButton.vue`, `BrandLogo.vue`, `FilterChip.vue`, `StatusBadge.vue`는 `app/components/ui/`의 Vue 3 SFC + `<script setup lang="ts">`이며 Nuxt 자동 import를 사용한다. `nuxt.config.ts`에서 이 폴더에만 `pathPrefix: false`를 적용해 기존 컴포넌트 이름을 유지한다. `home/`, `layout/`은 기존 자동 import 규칙을 유지한다.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Heart } from '@lucide/vue'

const selected = ref(false)
</script>

<template>
  <BaseButton @click="selected = true">적용</BaseButton>
  <BaseButton variant="secondary" type="submit">저장</BaseButton>
  <BaseButton disabled>처리 불가</BaseButton>
  <FilterChip v-model:selected="selected">한국</FilterChip>
  <StatusBadge status="ongoing" />
  <StatusBadge status="upcoming" />
  <StatusBadge status="ended" />
  <BrandLogo />
  <BaseButton variant="secondary" aria-label="찜하기">
    <Heart :size="20" aria-hidden="true" />
  </BaseButton>
</template>
```

| 컴포넌트 | 계약 |
| --- | --- |
| BaseButton | `variant?: 'primary' \| 'secondary'`(기본 primary), `disabled?: boolean`, `type?: 'button' \| 'submit' \| 'reset'`(기본 button). 기본 slot. click/aria-label/class 등은 네이티브 단일 루트 button으로 전달 |
| FilterChip | `v-model:selected` boolean, 기본 false. `disabled?: boolean`, 기본 slot. 독립 토글 버튼이며 radio/tab이 아니다. 단일 선택 그룹은 부모가 상태 관리 |
| StatusBadge | `status: 'ongoing' \| 'upcoming' \| 'ended'`. 한글 라벨 포함, 클릭/포커스 없는 정보용 span. 자동 live announcement 없음 |
| BrandLogo | 스타일링한 텍스트 P + POPCHIVE. RN 로고 복제·공식 SVG 원본 아님. 한 개의 접근성 이름을 제공하는 정적 요소 |

아이콘은 [공식 사용 예시](https://lucide.dev/guide/vue/getting-started)처럼 필요한 것만 named import한다. 라이선스는 `node_modules/@lucide/vue/LICENSE`의 ISC/Feather 고지다. 프리뷰는 Search·Heart·Check·ArrowRight만 사용한다. 장식 아이콘은 aria-hidden, 단독 아이콘 버튼은 부모 button에 aria-label을 제공한다.

## 접근성 및 검증

- 네이티브 button으로 Tab·Enter·Space와 실제 disabled 동작을 사용한다. FilterChip은 aria-pressed로 선택 상태를 노출한다. 비활성 요소는 탭 순서에서 빠진다.
- 전역 focus-visible: #15803D outline2px/offset3px. 선택 여부는 색과 aria-pressed로 제공하고 forced-colors에서는 선택 outline을 추가한다.
- RN 필터 높이36px에서 최소44px로 확대했다(**웹 신규 제안**). 버튼은 고정 높이 대신 최소48px이므로 긴 라벨·사용자 글자 확대 시 늘어날 수 있다.
- 비선택 칩/secondary 버튼 경계는 #6B7280로 강화했다(**웹 신규 제안**). #E5E7EB는 카드·구분선·비활성 경계에 유지한다.
- hover는 enabled 요소에만 적용한다. 120ms 색상 전환을 사용하며 prefers-reduced-motion에서는 전환 시간을0으로 한다.
- 스킵 링크, h1~h3, section 라벨, 색상 텍스트 라벨을 제공한다. 프리뷰는 루트 컨테이너 `lang="ko"`로 발음 언어를 지정한다.
- 종료 배지의 RN 조합(#6B7280/#F3F4F6)은 4.39:1로 작은 글자 대비가 부족하다. 색상 토큰 자체는 보존하되 종료 배지에 기존 tag-text #4B5563을 조합했다(**웹 신규 제안**). disabled는 실제 비활성 컨트롤이며 일반 텍스트와 구분한다.

| 확인한 조합 | 대비 (sRGB 상대휘도 계산) |
| --- | --- |
| primary: #111827 / #22C55E | 7.79:1 |
| primary hover: #111827 / #DCFCE7 | 16.15:1 |
| secondary text: #6B7280 / #FFFFFF | 4.83:1 |
| secondary text on surface: #6B7280 / #F8FAFC | 4.62:1 |
| 선택 칩: #FFFFFF / #111827 | 17.74:1 |
| 운영 중: #15803D / #DCFCE7 | 4.57:1 |
| 오픈 예정: #1D4ED8 / #DBEAFE | 5.49:1 |
| 종료: #4B5563 / #F3F4F6 | 6.87:1 |
| focus: #15803D / #FFFFFF | 5.02:1 |

검증 기록:

- `npm run typecheck`, `npm run build` 통과. 타입 검사와 빌드는 별도 실행한다.
- 실제 로컬 프로덕션 프리뷰에서 headless Chrome으로 hydration·콘솔 오류 없음, 로컬 WOFF2 로딩·Pretendard 사용, Display32/700/40, 버튼 최소48px·칩44px을 확인했다.
- Tab 이동·Enter로 primary 실행, Space/Enter로 칩 토글, disabled 네 개의 클릭 무반응·탭 건너뜀, focus-visible 색상/두께, enabled hover, reduced-motion 전환0s를 확인했다.
- 가로 viewport320/375/768/1280px에서 가로 넘침 없음. 375px·루트 글자200%에서도 가로 넘침 없음. 데스크톱/작은 화면 캡처를 확인했다. 모바일 실기기·스크린리더 검증은 수행하지 않았다.
- 의존성 전환 후에도 타입 검사·프로덕션 빌드가 통과했다. 새 Lucide SVG4개, 컴포넌트 색/높이/글꼴·키보드·disabled·hover·focus·reduced-motion·모바일 가로 넘침을 다시 확인했다. 상세 보안 분석은 아래를 따른다.

## npm 보안 분석 (2026-10-24)

실행: `npm audit --json`, `npm ls --depth=0`, 관련 `npm ls`와 `npm view`. 최종 `npm audit`도 실행했다. 결과는 **high7→high7, critical0→0, 해결0/보류7**이다. 마지막 audit은 취약점이 남아 정상적으로 exit1을 반환한다. 이를 검사 통과로 기록하지 않는다.

7개 항목은 서로 다른 CVE7개가 아니라 **node-forge의 한 advisory와 상위 패키지로 전파된 metavulnerability6개**다. 원 advisory는 [GHSA-86w9-cpqp-85rv / CVE-2026-85393](https://github.com/advisories/GHSA-86w9-cpqp-85rv), CVSS7.5/high, 영향 범위 `node-forge <=1.4.0`이며 공식 patched version은 **None**이다. RSA PKCS#1 v1.5 서명 검증에서 중첩 DigestAlgorithm 요소 수를 충분히 검증하지 않는 문제다. 공격자가 제어한 메시지/서명을 낮은 공개 지수 RSA 키로 검증하는 흐름에서 서명 진위 판정에 영향을 줄 수 있다.

의존 경로:

```text
nuxt@4.6.2
  @nuxt/nitro-server@4.6.2
    nitropack@2.13.5
      listhen@1.10.1
        node-forge@1.4.0
```

| audit 패키지 / 설치 버전 | 심각도·식별자 | 직접/전이 | 실제 역할·운영 영향 판단 | 안전한 수정 버전/호환성 판단 |
| --- | --- | --- | --- | --- |
| node-forge 1.4.0 | high, 위 GHSA/CVE 원인 | 전이 | 암호화/서명 라이브러리. listhen은 로컬 HTTPS용 인증서 생성·서명·PEM/PKCS12 처리에 사용. 현재 앱에 공격자 서명을 검증하는 API는 없음 | npm latest도1.4.0이며 advisory에 수정판 없음. 안전한 패치/마이너 교체 불가 |
| listhen 1.10.1 | high, 같은 advisory의 전파 | 전이 | 개발/preview 서버·HTTPS 보조. node-forge 사용 지점의 코드에서 `.verify()` 호출은 확인되지 않음 | latest1.10.1의 node-forge 제약은 `^1.4.0`. 수정판/제거판 없음 |
| nitropack 2.13.5 | high, 같은 advisory의 전파 | 전이 | SSR 서버를 **생성**하는 도구와 dev/preview. 설치 트리의 존재와 생성된 운영 번들의 포함 여부를 구분 | latest2.13.5, listhen `^1.10.1`. 안전한 수정판 없음 |
| @nuxt/nitro-server 4.6.2 | high, 같은 advisory의 전파 | 전이 | Nuxt의 Nitro 연동·서버 빌드. nuxt와 같은 버전 고정 관계 | Nuxt4.6.2가4.6.2로 pin. 독립 강제 교체하지 않음 |
| nuxt 4.6.2 | high, 같은 advisory의 전파 | **직접** | 프레임워크는 dev/SSR 양쪽에 관련. 현재 preview의 운영 output에서는 원인 라이브러리 미포함 확인 | npm latest도4.6.2. 사용자 범위`^4.6.2` 내 안전한 새 stable 없음 |
| @nuxt/vite-builder 4.6.2 | high, 같은 advisory의 전파 | 전이 | Vite 빌드·개발용. audit의 nuxt 의존/영향 그래프 순환으로 함께 집계되며 자체 별도 CVE가 아님 | audit은 fixAvailable=true로 표시하지만 Nuxt의4.6.2 pin과 순환 경로상 독립 수정 근거 없음 |
| @nuxt/vite-server 4.6.2 | high, 같은 advisory의 전파 | 전이 | 개발 서버 통합. 같은 nuxt 영향 그래프에서 집계 | Nuxt4.6.2 pin. 안전한 독립 교체 없음 |

**운영 우선 점검 결과:** 이7개는 npm상 Nuxt의 production dependency 트리에 있으므로 단순한 “devDependencies만의 취약점”은 아니다. `npm install --omit=dev`만으로 제거된다고 주장하지 않는다. 다만 이번 node-server 빌드 `.output/server/package.json`, 번들 문자열과 `.output/server/node_modules`를 조사했을 때 `node-forge`/`listhen`은 포함되지 않았다. 현재 애플리케이션에는 외부 서명 검증 경로도 없다. 따라서 **현재 생성된 `.output`만 실행하는 프리뷰에서 해당 서명 검증 결함으로 들어가는 경로는 확인되지 않았다**는 제한된 판단이다. 운영 서버의 설치/배포 방식 자체는 조사하거나 변경하지 않았다.

**안전한 수정 검토:** npm은 `nuxt@4.1.3` 설치를 force 수정안으로 제시하며 breaking/isSemVerMajor로 표시한다. 실제로는4.6.2→4.1.3의 다운그레이드이며 사용자 범위 밖이다. 단순 audit 수를 줄이려고 Nuxt/Vue/TypeScript 호환성을 깨는 이 변경은 적용하지 않았다. overrides, 취약점 무시, 무관한 의존성 삭제, `npm audit fix --force`를 사용하지 않았다. 최신 Nuxt/Nitro/listhen/node-forge가 이미 설치되어 이번에 안전하게 해결할 수 있는 항목은0건이었다. 디자인 작업과 무관한 전체 트리 업데이트도 하지 않았다.

**후속 조치:** node-forge patched release 또는 이를 안전하게 교체한 listhen/Nitro/Nuxt stable이 나오면 현재 허용 범위에서 업데이트하고 typecheck/build/audit를 재실행한다. 그 전 외부 입력에 대한 node-forge RSA 검증 기능을 새로 도입하거나 dev/preview HTTPS 보조를 운영 인증 경로에 쓰지 않는다. `.output` 배포 방식을 바꾸거나 서버 기능을 추가할 때 도달 가능성을 다시 분석한다. 위험이 영구 해소되었다고 간주하지 않는다.

검증 원본은 Git 제외 경로 `.data/audit-before.json`, `audit-after.json`, `dependencies-before.json`, `dependencies-after.json`, `lucide-comparison.json`, `font-before.json`, `font-after.json`, `font-coverage.json`에 남겼다. 모두 로컬 감사 산출물이며 앱 실행이나 빌드에 의존하지 않는다.

미확정: 최종 로고, 서비스 레이아웃·헤더·우측 패널, 웹 breakpoint·그림자, OS별 일본어 폴백 품질과 남은 보안 advisory의 수정판. 현재 웹 신규 규칙도 기초 프리뷰에서 검토할 선택이며 전체 서비스의 최종 디자인 확정은 아니다.

## 이번 의존성/폰트 정리 변경 파일

- 설정/의존성: `nuxt.config.ts`, `package.json`, `package-lock.json`.
- 프리뷰/토큰: `app/app.vue`, `app/assets/css/main.css`, 공식 분할 face 정의 `app/assets/css/pretendard.css`.
- 기존 `BaseButton.vue`, `FilterChip.vue`, `StatusBadge.vue`, `BrandLogo.vue`는 수정하지 않았다.
- 폰트/고지: `public/fonts/pretendard/v1.3.9/woff2-dynamic-subset/` 92개, `v1.3.9/manifest.json`, 기존 `OFL.txt` 보존. 이전 단일 전체 WOFF2는 참조·테스트 확인 후 제거.
- 문서: `docs/WEB_DESIGN_SYSTEM.md`. README와 RN 조사 문서는 수정하지 않았다.
- 로컬 검증 산출물은 Git 제외 경로 `.data/`의 검사 스크립트와 데스크톱/작은 화면 PNG다. 애플리케이션·배포 의존성이 아니다.

기존 RN 조사 문서는 보존했다. RN/관리자 웹/백엔드/DB 변경과 Git commit/push는 수행하지 않았다. 저장소 파일이 작업 시작부터 untracked 상태여서 Git diff만으로 파일 변경을 판별하지 않았고, 위 목록은 이번 작업에서 직접 편집·추가한 파일 기준이다.
