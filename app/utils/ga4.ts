import { normalizedSeoPath, PAGE_SEO, publicPopupId, SITE_URL } from '../../shared/utils/seo'

type AnalyticsWindow = Window & {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
  __popchiveGa4Started?: boolean
} & Partial<Record<`ga-disable-${string}`, boolean>>

// Only fixed public page metadata is sent. Never send query/hash, popup IDs,
// document.title, external referrers, search text or account data.
export function ga4Page(path: string): { location: string; title: string } | null {
  const clean = normalizedSeoPath(path)
  if (Object.hasOwn(PAGE_SEO, clean)) {
    return { location: `${SITE_URL}${clean}`, title: PAGE_SEO[clean as keyof typeof PAGE_SEO].title }
  }
  if (clean.startsWith('/places/') && publicPopupId(clean.slice('/places/'.length))) {
    return { location: `${SITE_URL}/places/:publicId`, title: '팝업 상세 | 팝카이브' }
  }
  return null
}

export function ga4OptedOut(): boolean {
  if (navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return true
  try { return localStorage.getItem('popchive:ga4:disabled') === 'true' }
  catch { return true } // Fail closed when the browser cannot read its preference.
}

// Call only from the client plugin after production and legal/configuration gates.
export function createGa4Tracker(measurementId: string): (path: string) => void {
  const target = window as unknown as AnalyticsWindow
  const disableKey = `ga-disable-${measurementId}` as const
  if (!/^G-[A-Z0-9]+$/.test(measurementId) || target.__popchiveGa4Started
    || target[disableKey] || target.gtag || document.querySelector('script[src*="googletagmanager.com/"]')) return () => {}
  let initialized = false
  let lastPath: string | undefined
  let previousLocation = ''

  return (path: string) => {
    const page = ga4Page(path)
    const disabled = ga4OptedOut() || !page
    target[disableKey] = disabled
    if (disabled) {
      lastPath = undefined
      return
    }
    const clean = normalizedSeoPath(path)
    if (lastPath === clean) return

    if (!initialized) {
      // Do not mix this integration with another GA/GTM installation.
      if (target.gtag || document.querySelector('script[src*="googletagmanager.com/"]')) return
      target.__popchiveGa4Started = true
      target.dataLayer = target.dataLayer || []
      target.gtag = function (..._args: unknown[]) { target.dataLayer!.push(arguments) }
      target.gtag('consent', 'default', {
        // The deployment gate is not user consent. Only enable for a confirmed lawful setup.
        analytics_storage: 'granted', ad_storage: 'denied',
        ad_user_data: 'denied', ad_personalization: 'denied',
      })
      target.gtag('set', { page_location: page.location, page_title: page.title, page_referrer: '' })
      target.gtag('js', new Date())
      target.gtag('config', measurementId, {
        send_page_view: false, allow_google_signals: false,
        allow_ad_personalization_signals: false, user_id: null,
        page_location: page.location, page_title: page.title, page_referrer: '',
      })
      const script = document.createElement('script')
      script.async = true
      script.referrerPolicy = 'no-referrer'
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
      script.onerror = () => { target[disableKey] = true }
      document.head.appendChild(script)
      initialized = true
    }

    target.gtag!('set', { page_location: page.location, page_title: page.title, page_referrer: previousLocation })
    target.gtag!('event', 'page_view', {
      send_to: measurementId, page_location: page.location,
      page_title: page.title, page_referrer: previousLocation,
    })
    lastPath = clean
    previousLocation = page.location
  }
}
