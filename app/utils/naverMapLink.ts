type NaverDestination = {
  latitude: number | null
  longitude: number | null
  name: string
  address: string | null
  countryCode: string | null
}

// NAVER Whale support confirms /p/search/{query}. No invented web route parameters.
// https://forum.whale.naver.com/topic/57381/
// https://guide.ncloud-docs.com/docs/ko/maps-url-scheme
export function naverMapLink(place: NaverDestination, android: boolean, appname: string): string | null {
  const query = place.address?.trim() || place.name.trim()
  if (!query) return null
  const webUrl = `https://map.naver.com/p/search/${encodeURIComponent(query)}`
  if (!android) return webUrl

  const { latitude: lat, longitude: lng } = place
  const coordinates = typeof lat === 'number' && Number.isFinite(lat)
    && typeof lng === 'number' && Number.isFinite(lng)
  const inCoverage = coordinates && place.countryCode === 'KR'
    && lat >= 31.43 && lat <= 44.35 && lng >= 122.37 && lng <= 132
  let path: string
  if (inCoverage) {
    path = `route/public?dlat=${lat}&dlng=${lng}&dname=${encodeURIComponent(place.name.trim() || query)}&appname=${encodeURIComponent(appname)}`
  } else if (!coordinates && place.address?.trim() && place.countryCode === 'KR') {
    // Address-only destinations use the officially supported app search action.
    path = `search?query=${encodeURIComponent(query)}&appname=${encodeURIComponent(appname)}`
  } else {
    return webUrl
  }
  // Official Android intent syntax, with a destination-aware browser fallback.
  // https://developer.chrome.com/docs/android/intents
  return `intent://${path}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`
}
