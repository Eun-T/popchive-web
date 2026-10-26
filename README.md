# POPCHIVE Web

`/`는 임시 메인 레이아웃, `/design`은 디자인 시스템 프리뷰입니다. [디자인 시스템 사용법과 토큰](docs/WEB_DESIGN_SYSTEM.md), [RN 디자인 조사](docs/RN_DESIGN_SYSTEM_AUDIT.md)를 참고하세요.

타입 검사는 `npm run typecheck`, 빌드는 `npm run build`로 실행합니다.

배포 설정은 [Netlify SSR](docs/NETLIFY_SSR.md), [Vercel SSR 이전 준비](docs/VERCEL_SSR.md)를 참고하세요.

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
