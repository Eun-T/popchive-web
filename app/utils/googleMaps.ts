// Small SDK surface used here, without an extra runtime package or global google references in SSR.
export type MapsListener = { remove(): void }
export type MapsBounds = { toJSON(): { south: number; north: number; west: number; east: number } }
export type GoogleMap = {
  getBounds(): MapsBounds | undefined
  addListener(name: string, handler: () => void): MapsListener
}
export type GoogleMarker = HTMLElement & { map: GoogleMap | null; position: { lat: number; lng: number }; title: string }
export type GoogleInfoWindow = {
  setContent(content: Node): void
  open(options: { map: GoogleMap; anchor: GoogleMarker; shouldFocus: boolean }): void
  close(): void
}
export type GoogleMapsSdk = {
  Map: new (element: HTMLElement, options: {
    center: { lat: number; lng: number }; zoom: number; mapId: string
    mapTypeControl: boolean; streetViewControl: boolean
    gestureHandling?: 'none' | 'cooperative' | 'greedy' | 'auto'
  }) => GoogleMap
  InfoWindow: new (options: { disableAutoPan: boolean }) => GoogleInfoWindow
  marker: { AdvancedMarkerElement: new (options: {
    map: GoogleMap; position: { lat: number; lng: number }; title: string; gmpClickable: boolean
    anchorLeft: string; anchorTop: string
  }) => GoogleMarker }
  event: { clearInstanceListeners(instance: GoogleMap): void }
}
type MapsWindow = Window & {
  google?: { maps?: GoogleMapsSdk }
  gm_authFailure?: () => void
  __popchiveGoogleMapsReady?: () => void
}

export const MAPS_AUTH_FAILURE_EVENT = 'popchive:maps-auth-failure'
let sdkPromise: Promise<GoogleMapsSdk> | undefined
let authFailed = false

export function loadGoogleMaps(apiKey: string): Promise<GoogleMapsSdk> {
  if (!import.meta.client) return Promise.reject(new Error('Google Maps requires a browser'))
  if (authFailed) return Promise.reject(new Error('Google Maps authentication failed'))
  if (sdkPromise) return sdkPromise
  const browser = window as MapsWindow
  sdkPromise = new Promise((resolve, reject) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const fail = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error('Google Maps could not load'))
    }
    const previousAuthFailure = browser.gm_authFailure
    browser.gm_authFailure = () => {
      authFailed = true
      fail()
      window.dispatchEvent(new Event(MAPS_AUTH_FAILURE_EVENT))
      previousAuthFailure?.()
    }
    const ready = () => {
      if (settled) return
      const maps = browser.google?.maps
      if (!maps?.Map || !maps.marker?.AdvancedMarkerElement) return fail()
      settled = true
      clearTimeout(timer)
      resolve(maps)
    }
    if (browser.google?.maps?.marker?.AdvancedMarkerElement) return ready()
    browser.__popchiveGoogleMapsReady = ready
    const script = document.createElement('script')
    const url = new URL('https://maps.googleapis.com/maps/api/js')
    url.search = new URLSearchParams({
      key: apiKey, loading: 'async', libraries: 'maps,marker', language: 'ko', region: 'KR',
      v: 'weekly', callback: '__popchiveGoogleMapsReady',
    }).toString()
    script.id = 'popchive-google-maps-sdk'
    script.src = url.toString()
    script.async = true
    script.onerror = fail
    timer = setTimeout(fail, 20_000)
    document.head.append(script)
  })
  return sdkPromise
}
