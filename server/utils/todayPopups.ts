import { createHash } from 'node:crypto'
import type { TodayPopup, TodayPopupsResponse } from '#shared/types/todayPopups'
import { publicPopupId } from '#shared/utils/seo'

// The date argument is part of Nitro's cache key. Yesterday's entry cannot serve today.
export const getTodayPopups = defineCachedFunction(async (apiBase: string, asOf: string): Promise<TodayPopupsResponse> => {
  let response: unknown
  try {
    // Existing public list mode: no limit/cursor means ALL matching public popups.
    response = await $fetch<unknown>('/api/popups', {
      baseURL: apiBase, query: { countryCode: 'KR', status: 'ONGOING', languageCode: 'ko' },
      method: 'GET', headers: { accept: 'application/json' }, credentials: 'omit',
      redirect: 'error', timeout: 15_000, retry: 0,
    })
  } catch { throw createError({ statusCode: 502, statusMessage: 'Today popups unavailable' }) }
  const invalid = (): never => { throw createError({ statusCode: 502, statusMessage: 'Today popups require the complete public list' }) }
  if (!response || typeof response !== 'object' || Object.keys(response).length !== 1
    || !('popups' in response) || !Array.isArray(response.popups)) return invalid()
  const text = (value: unknown): string | null => {
    if (value == null) return null
    if (typeof value !== 'string') return invalid()
    return value.trim() || null
  }
  const date = (value: unknown): string | null => {
    const result = text(value)
    if (result && (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result))
      || new Date(result).toISOString().slice(0, 10) !== result)) return invalid()
    return result
  }
  const candidates: TodayPopup[] = []
  const ids = new Set<string>()
  for (const value of response.popups) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
    const row = value as Record<string, unknown>
    if (row.countryCode !== 'KR' || !publicPopupId(row.publicId) || ids.has(row.publicId)) return invalid()
    ids.add(row.publicId)
    const name = text(row.name)
    if (!name) return invalid()
    const startDate = date(row.startDate), endDate = date(row.endDate)
    if (!startDate || !endDate || startDate > asOf || endDate < asOf || startDate > endDate) continue
    let coverImageUrl = text(row.coverImageUrl)
    if (coverImageUrl) {
      try {
        const url = new URL(coverImageUrl)
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) coverImageUrl = null
      } catch { coverImageUrl = null }
    }
    candidates.push({ publicId: row.publicId, name, startDate, endDate, regionName: text(row.regionName), coverImageUrl })
  }
  // Deterministic across processes/users and independent of API ordering. No popularity data.
  const ranked = candidates.map(popup => ({ popup, rank: createHash('sha256').update(`${asOf}|${popup.publicId}`).digest('hex') }))
  ranked.sort((a, b) => a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : a.popup.publicId < b.popup.publicId ? -1 : 1)
  return { items: ranked.slice(0, 3).map(row => row.popup), asOf, fetchedAt: Date.now() }
}, { name: 'public-today-popups-v1', maxAge: 180, swr: false })
