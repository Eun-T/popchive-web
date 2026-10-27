import type { HomePopupCard, HomeSection, HomeSectionResponse } from '../../shared/types/home'

// Only these public read endpoints can be reached. No caller-provided URLs or headers.
const endpoints: Record<HomeSection, string> = {
  'main-banners': '/api/main-banners',
  'new-popups': '/api/popups',
  'now-hot': '/api/home-curations/NOW_HOT',
  'japan-new-popups': '/api/popups',
}

function invalidResponse(): never {
  throw createError({ statusCode: 502, statusMessage: 'Invalid popup API response' })
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return invalidResponse()
  return value.trim() || null
}

function displayDate(value: unknown): string | null {
  const date = nullableString(value)
  if (date === null) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return invalidResponse()
  // LocalDate: format directly without converting time zones.
  return date.replaceAll('-', '.')
}

function toCard(value: unknown, isMainBanner = false): HomePopupCard {
  if (!value || typeof value !== 'object') return invalidResponse()
  const row = value as Record<string, unknown>
  const publicId = nullableString(row.publicId)
  const name = nullableString(row.name)
  if (!publicId || !name) return invalidResponse()
  let heroTitle: string | null = null
  if (isMainBanner && row.heroTitle != null) {
    if (typeof row.heroTitle !== 'string') return invalidResponse()
    // Preserve the original whitespace/newlines; validity is checked at display time.
    heroTitle = row.heroTitle
  }
  const start = displayDate(row.startDate)
  const end = displayDate(row.endDate)
  const src = nullableString(row.coverImageUrl)
  if (src) {
    let imageUrl: URL
    try { imageUrl = new URL(src) } catch { return invalidResponse() }
    if (!['https:', 'http:'].includes(imageUrl.protocol)) return invalidResponse()
  }
  return {
    id: publicId,
    publicId,
    src,
    alt: `${name} 포스터`,
    title: name,
    ...(isMainBanner ? { heroTitle } : {}),
    period: start || end ? `${start ?? '시작일 미정'} ~ ${end ?? '종료일 미정'}` : '운영 기간 미정',
    region: nullableString(row.regionName) ?? '',
  }
}

export const getHomePopups = defineCachedFunction(async (
  apiBase: string,
  section: HomeSection,
  countryCode: 'KR' | 'JP',
  languageCode: 'ko' | 'ja',
): Promise<HomeSectionResponse> => {
  const query: Record<string, string | number> = { languageCode }
  // The banner API has no country filter; preserve its complete ordered response.
  if (section !== 'main-banners') query.countryCode = countryCode
  if (section === 'new-popups') query.limit = 10
  // Japan uses the unpaginated list: all statuses, ordered in SQL by
  // places.created_at DESC, places.id DESC. Do not use homeNew/startDate order.
  // Its createdAt is not exposed in the DTO; preserve the backend's order.

  let response: unknown
  try {
    response = await $fetch<unknown>(endpoints[section], {
      baseURL: apiBase,
      query,
      method: 'GET',
      headers: { accept: 'application/json' },
      credentials: 'omit',
      redirect: 'error',
      timeout: 10_000,
      retry: 0,
    })
  } catch (error) {
    const upstream = error as { statusCode?: number; response?: { status?: number } }
    const status = upstream.response?.status ?? upstream.statusCode
    const statusCode = status && status >= 400 && status <= 599 ? status : 502
    // Do not expose upstream bodies, configuration, or signed image URLs in errors.
    throw createError({ statusCode, statusMessage: 'Popup API request failed', data: { section } })
  }

  if (!response || typeof response !== 'object' || !('popups' in response) || !Array.isArray(response.popups)) {
    return invalidResponse()
  }
  if (section === 'japan-new-popups') {
    // Reject a changed/paginated contract rather than present a partial list as latest.
    if ('nextCursor' in response || 'hasMore' in response || 'page' in response) return invalidResponse()
    if (response.popups.some(row => !row || typeof row !== 'object' || row.countryCode !== 'JP')) return invalidResponse()
  }
  const items = response.popups.map(row => toCard(row, section === 'main-banners'))
  if (new Set(items.map(item => item.publicId)).size !== items.length) return invalidResponse()
  return {
    // NOW_HOT is the administrator's order. Never sort, pad, or duplicate it.
    items: section === 'main-banners' ? items : items.slice(0, 10),
    fetchedAt: Date.now(),
  }
}, {
  name: 'public-home-popups-v1',
  maxAge: 30,
  swr: false,
  // Default key includes base URL, endpoint, country, and language.
  // Only successful public responses are stored; credentials never enter this function.
})
