import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      meta: [
        { name: 'naver-site-verification', content: 'fc99d70b029e697a0a5f2ab63f9fb02a34bef189' }
      ]
    }
  },
  runtimeConfig: {
    // Server only. Override with NUXT_API_BASE; never expose through public config.
    apiBase: 'https://api.popchive.com',
    public: {
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
    '/fonts/pretendard/v1.3.9/**': {
      headers: { 'cache-control': 'public, max-age=31536000, immutable' }
    }
  },
  vite: {
    plugins: [tailwindcss()]
  }
})
