import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      meta: [
        { name: 'naver-site-verification', content: '23aee0679433d4cb1b5a5609ee4a4a804312857d' }
      ]
    }
  },
  runtimeConfig: {
    // Server only. Override with NUXT_API_BASE; never expose through public config.
    apiBase: 'https://api.theplave.co.kr',
    naverClientId: '', // NUXT_NAVER_CLIENT_ID — server only
    naverClientSecret: '', // NUXT_NAVER_CLIENT_SECRET — server only
    appleWebRedirectUri: '', // NUXT_APPLE_WEB_REDIRECT_URI — fixed HTTPS Return URL
    appleAuthRedisUrl: '', // NUXT_APPLE_AUTH_REDIS_URL — Redis REST endpoint (server only)
    appleAuthRedisToken: '', // NUXT_APPLE_AUTH_REDIS_TOKEN — server only
    public: {
      appleClientId: '', // NUXT_PUBLIC_APPLE_CLIENT_ID — Apple Services ID
      googleClientId: '', // NUXT_PUBLIC_GOOGLE_CLIENT_ID — OAuth Web application client ID
      ga4MeasurementId: '', // NUXT_PUBLIC_GA4_MEASUREMENT_ID
      ga4Enabled: false, // NUXT_PUBLIC_GA4_ENABLED; enable only after the documented prerequisites
      googleMapsApiKey: '', // NUXT_PUBLIC_GOOGLE_MAPS_API_KEY (browser key)
      googleStaticMapsApiKey: '', // NUXT_PUBLIC_GOOGLE_STATIC_MAPS_API_KEY; separate browser key, no fallback
      googleStaticMapId: '', // NUXT_PUBLIC_GOOGLE_STATIC_MAP_ID; optional home Static Maps styling
      googleMapsMapId: '' // NUXT_PUBLIC_GOOGLE_MAPS_MAP_ID; optional development demo fallback
    }
  },
  css: ['~/assets/css/main.css'],
  components: [
    { path: '~/components/ui', pathPrefix: false },
    '~/components'
  ],
  routeRules: {
    '/': { headers: { 'cache-control': 'no-store' } },
    '/privacy.html': { headers: { 'x-robots-tag': 'noindex, nofollow' } },
    '/privacy-ja.html': { headers: { 'x-robots-tag': 'noindex, nofollow' } },
    '/support.html': { headers: { 'x-robots-tag': 'noindex, nofollow' } },
    '/fonts/pretendard/v1.3.9/**': {
      headers: { 'cache-control': 'public, max-age=31536000, immutable' }
    }
  },
  vite: {
    plugins: [tailwindcss()]
  }
})
