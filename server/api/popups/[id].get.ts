import type { PopupDetail } from '../../../shared/types/popup'

export default defineEventHandler(async (event): Promise<PopupDetail> => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid popup ID' })
  }
  let response: unknown
  try {
    // Fixed public read endpoint. Never forward visitor cookies or authorization.
    response = await $fetch<unknown>(`/api/popups/${encodeURIComponent(id)}`, {
      baseURL: useRuntimeConfig(event).apiBase,
      query: { languageCode: 'ko' },
      method: 'GET', headers: { accept: 'application/json' },
      credentials: 'omit', redirect: 'error', timeout: 10_000, retry: 0,
    })
  } catch (error) {
    const upstream = error as { response?: { status?: number }; statusCode?: number }
    const status = upstream.response?.status ?? upstream.statusCode
    throw createError({ statusCode: status === 404 ? 404 : 502, statusMessage: 'Popup detail request failed' })
  }
  const invalid = (): never => { throw createError({ statusCode: 502, statusMessage: 'Invalid popup detail response' }) }
  if (!response || typeof response !== 'object' || Array.isArray(response)) return invalid()
  const row = response as Record<string, unknown>
  function text(key: string): string | null {
    const value = row[key]
    if (value == null) return null
    if (typeof value !== 'string') return invalid()
    return value.trim() || null
  }
  function url(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) return null
    try {
      const parsed = new URL(value)
      return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? value : null
    } catch { return null }
  }
  function date(key: string): string | null {
    const value = text(key)
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))
      || new Date(value).toISOString().slice(0, 10) !== value)) return invalid()
    return value
  }
  function coordinate(key: string, limit: number): number | null {
    const value = row[key]
    if (value == null) return null
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limit) return invalid()
    return value
  }
  const publicId = text('publicId')
  const name = text('name')
  if (publicId !== id || !name) return invalid()
  if (row.tags != null && !Array.isArray(row.tags)) return invalid()
  const tags = ((row.tags ?? []) as unknown[]).map(value => {
    if (!value || typeof value !== 'object' || !('id' in value) || !('name' in value)
      || typeof value.id !== 'number' || typeof value.name !== 'string') return invalid()
    return { id: value.id, name: value.name }
  })
  if (row.contentImageUrls != null && !Array.isArray(row.contentImageUrls)) return invalid()
  const contentImageUrls = ((row.contentImageUrls ?? []) as unknown[]).map(url).filter((value): value is string => value !== null)
  // Keys verified in the existing administrator's popup-social-links.ts.
  const social = row.socialLinks && typeof row.socialLinks === 'object' ? row.socialLinks as Record<string, unknown> : {}
  const officialChannelUrl = ['website', 'instagram', 'x', 'youtube', 'threads', 'facebook']
    .map(key => url(social[key])).find(value => value !== null) ?? null
  return {
    publicId, name, countryCode: text('countryCode'), regionName: text('regionName'),
    address: text('address'), locationDetail: text('locationDetail'),
    latitude: coordinate('latitude', 90), longitude: coordinate('longitude', 180),
    startDate: date('startDate'), endDate: date('endDate'), operatingHours: text('operatingHours'),
    reservationUrl: url(row.reservationUrl), notice: text('notice'), benefits: text('benefits'),
    summary: text('summary'), tags, coverImageUrl: url(row.coverImageUrl), contentImageUrls, officialChannelUrl,
  }
})
