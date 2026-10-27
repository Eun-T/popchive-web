import { createGa4Tracker } from '~/utils/ga4'

export default defineNuxtPlugin(nuxtApp => {
  const config = useRuntimeConfig().public
  if (import.meta.dev || String(config.ga4Enabled) !== 'true') return
  const measurementId = String(config.ga4MeasurementId).trim()
  if (!/^G-[A-Z0-9]+$/.test(measurementId)) return

  const production = useState<boolean>('seo:production')
  const router = useRouter()
  let track: ReturnType<typeof createGa4Tracker> | undefined
  nuxtApp.hook('app:mounted', () => {
    // Reuse the existing SSR production-host / Vercel / Netlify context check.
    if (!production.value || !['popchive.com', 'www.popchive.com'].includes(window.location.hostname)) return
    track = createGa4Tracker(measurementId)
    track(router.currentRoute.value.path)
  })
  router.afterEach((to, _from, failure) => {
    if (!failure) track?.(to.path)
  })
})
