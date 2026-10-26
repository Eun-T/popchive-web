import type { PlaceCountry, PlaceListQuery, PlaceOption, PlaceOptions, PlacePage, PlacePopup } from '../../shared/types/places'
import { PLACE_REGION_PAGES } from '../../shared/utils/placeRegions'

function invalid(): never { throw createError({ statusCode: 502, statusMessage: 'Invalid public places response' }) }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return invalid()
  return value
}
function id(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) return invalid()
  return value
}
function date(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return invalid()
  const parsed = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return invalid()
  return value
}
async function read(apiBase: string, path: '/api/popups' | '/api/regions' | '/api/tags', query: Record<string, string | number>) {
  try {
    return await $fetch<unknown>(path, { baseURL: apiBase, query, headers: { accept: 'application/json' },
      method: 'GET', credentials: 'omit', redirect: 'error', timeout: 10_000, retry: 0 })
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status
    throw createError({ statusCode: status === 400 ? 400 : 502, statusMessage: 'Public places request failed' })
  }
}
function options(value: unknown): PlaceOption[] {
  if (!Array.isArray(value)) return invalid()
  const result = value.map(row => { const item = record(row); return { id: id(item.id), name: text(item.name) } })
  if (new Set(result.map(item => item.id)).size !== result.length) return invalid()
  return result
}
export const getPlacesOptions = defineCachedFunction(async (apiBase: string): Promise<PlaceOptions> => {
  const [kr, jp, tags] = await Promise.all([
    read(apiBase, '/api/regions', { countryCode: 'KR' }), read(apiBase, '/api/regions', { countryCode: 'JP' }),
    read(apiBase, '/api/tags', {}),
  ])
  const regions = ([['KR', kr], ['JP', jp]] as const).flatMap(([countryCode, rows]) =>
    options(rows).map(row => ({ ...row, countryCode })))
  if (new Set(regions.map(row => row.id)).size !== regions.length) return invalid()
  for (const page of PLACE_REGION_PAGES) for (const tile of page.items) {
    if (!regions.some(row => row.id === tile.id && row.name === tile.name && row.countryCode === page.countryCode)) return invalid()
  }
  return { regions, tags: options(tags) }
}, { name: 'public-places-options-v1', maxAge: 300, swr: false })

export const getPlacesPage = defineCachedFunction(async (
  apiBase: string, query: PlaceListQuery, asOf: string,
): Promise<PlacePage> => {
  const body = record(await read(apiBase, '/api/popups', { ...query, limit: 10, languageCode: 'ko' }))
  if (!Array.isArray(body.popups) || body.popups.length > 10
    || (body.nextCursor !== null && (typeof body.nextCursor !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(body.nextCursor)))) return invalid()
  if (body.nextCursor && (body.nextCursor === query.cursor || !body.popups.length)) return invalid()
  const requestedRegions = query.regionIds?.split(',').map(Number)
  const requestedTags = query.tagIds?.split(',').map(Number)
  const items: PlacePopup[] = body.popups.map(value => {
    const row = record(value)
    if (row.countryCode !== 'KR' && row.countryCode !== 'JP') return invalid()
    const countryCode: PlaceCountry = row.countryCode
    const regionId = row.regionId === null ? null : id(row.regionId)
    const tagIds = options(row.tags).map(tag => tag.id)
    const startDate = date(row.startDate), endDate = date(row.endDate)
    if ((startDate && endDate && startDate > endDate)
      || (query.countryCode && countryCode !== query.countryCode)
      || (requestedRegions && (regionId === null || !requestedRegions.includes(regionId)))
      || (requestedTags && !tagIds.some(tag => requestedTags.includes(tag)))) return invalid()
    if (query.status === 'ONGOING' && (!startDate || !endDate || startDate > asOf || endDate < asOf)) return invalid()
    if (query.status === 'UPCOMING' && (!startDate || startDate <= asOf)) return invalid()
    if (query.status === 'ENDED' && (!endDate || endDate >= asOf)) return invalid()
    if (!query.status && (!endDate || endDate < asOf)) return invalid()
    const image = row.coverImageUrl === null ? null : text(row.coverImageUrl)
    if (image && !['http:', 'https:'].includes(new URL(image).protocol)) return invalid()
    return { id: text(row.publicId), title: text(row.name), image, startDate, endDate, countryCode, regionId, tagIds }
  })
  if (new Set(items.map(item => item.id)).size !== items.length) return invalid()
  return { items, nextCursor: body.nextCursor as string | null, asOf, fetchedAt: Date.now() }
}, { name: 'public-places-page-v1', maxAge: 30, swr: false })
