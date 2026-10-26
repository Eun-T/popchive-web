import type { MapPopup, SeoulMapAreaId, SeoulMapPreviewResponse } from '../../shared/types/map'
import { classifySeoulMapArea, SEOUL_MAP_AREAS } from '../../shared/utils/seoulMapAreas'

// PublicFilterOptionsController + PopupRegionMatcher in the existing backend.
// Resolve IDs from the API; never guess Seoul from a rectangular map viewport.
const seoulRegionNames = ['성수', '여의도', '잠실', '홍대·신촌', '강남·서초', '용산', '서울 기타']

function invalidResponse(): never {
  throw createError({ statusCode: 502, statusMessage: 'Invalid Seoul popup response' })
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalidResponse()
  return value as Record<string, unknown>
}

function date(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return invalidResponse()
  const parsed = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return invalidResponse()
  return value
}

function validCoordinate(value: unknown, limit: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit
}

export const getSeoulMapPreview = defineCachedFunction(async (
  apiBase: string,
  today: string,
): Promise<SeoulMapPreviewResponse> => {
  date(today)
  async function read(path: '/api/regions' | '/api/popups', query: Record<string, string>): Promise<unknown> {
    try {
      return await $fetch<unknown>(path, {
        baseURL: apiBase, query, method: 'GET', headers: { accept: 'application/json' },
        credentials: 'omit', redirect: 'error', timeout: 10_000, retry: 0,
      })
    } catch {
      throw createError({ statusCode: 502, statusMessage: 'Seoul popup API request failed' })
    }
  }

  const regions = await read('/api/regions', { countryCode: 'KR' })
  if (!Array.isArray(regions)) return invalidResponse()
  const regionIds = seoulRegionNames.map(name => {
    const matches = regions.map(record).filter(region => region.name === name)
    const id = matches[0]?.id
    // Missing/ambiguous classification must not produce a partial count.
    if (matches.length !== 1 || typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return invalidResponse()
    return id
  })
  if (new Set(regionIds).size !== regionIds.length) return invalidResponse()

  // Same two unpaginated requests, now without country/region filters.
  // Reuse the full rows for KR+JP statistics AND the unchanged Seoul subset below.
  const responses = await Promise.all(['ONGOING', 'UPCOMING'].map(status => read('/api/popups', {
    status, languageCode: 'ko',
  })))
  const countries = new Map<string, 'KR' | 'JP'>()
  const eligible = new Map<string, { popup: MapPopup | null; area: SeoulMapAreaId | null }>()
  for (const response of responses) {
    const body = record(response)
    // ListResponse has only popups. Reject a changed/paginated contract instead of undercounting.
    if (Object.keys(body).length !== 1 || !Array.isArray(body.popups)) return invalidResponse()
    for (const value of body.popups) {
      const row = record(value)
      if (row.countryCode !== 'KR' && row.countryCode !== 'JP') continue
      if (typeof row.publicId !== 'string' || !row.publicId.trim()
        || typeof row.name !== 'string' || !row.name.trim()) {
        return invalidResponse()
      }
      const start = date(row.startDate)
      const end = row.endDate === null ? null : date(row.endDate)
      // Seoul date, inclusive end day. An upcoming popup may have an unknown end date.
      if ((end !== null && (end < today || end < start)) || (start <= today && end === null)) continue
      const previousCountry = countries.get(row.publicId)
      if (previousCountry && previousCountry !== row.countryCode) return invalidResponse()
      countries.set(row.publicId, row.countryCode)
      // Keep the original Seoul map membership, total and regional marker rules.
      if (row.countryCode !== 'KR' || typeof row.regionId !== 'number' || !regionIds.includes(row.regionId)) continue
      const popup = validCoordinate(row.latitude, 90) && validCoordinate(row.longitude, 180)
        ? { id: row.publicId, name: row.name, latitude: row.latitude, longitude: row.longitude }
        : null
      const sourceRegion = seoulRegionNames[regionIds.indexOf(row.regionId)]!
      const area = popup ? classifySeoulMapArea(sourceRegion, popup.latitude, popup.longitude) : null
      // Identity is publicId, not coordinates: distinct popups can share the same venue.
      const previous = eligible.get(row.publicId)
      eligible.set(row.publicId, {
        popup: popup ?? previous?.popup ?? null,
        area: previous && (previous.area !== area || previous.popup?.latitude !== popup?.latitude
          || previous.popup?.longitude !== popup?.longitude) ? null : area,
      })
    }
  }
  const areas = SEOUL_MAP_AREAS.map(definition => {
    const members = [...eligible.values()].filter(value => value.area === definition.id && value.popup !== null)
    return {
      id: definition.id, name: definition.name, count: members.length,
      // Geographic centroid of the actual eligible popups, never a fixed pixel position.
      latitude: members.length ? members.reduce((sum, value) => sum + value.popup!.latitude, 0) / members.length : null,
      longitude: members.length ? members.reduce((sum, value) => sum + value.popup!.longitude, 0) / members.length : null,
    }
  })
  return {
    totalCount: eligible.size,
    popupStats: {
      KR: [...countries.values()].filter(country => country === 'KR').length,
      JP: [...countries.values()].filter(country => country === 'JP').length,
      totalCount: countries.size,
    },
    areas,
    otherCount: eligible.size - areas.reduce((sum, area) => sum + area.count, 0),
    popups: [...eligible.values()].map(value => value.popup).filter((popup): popup is MapPopup => popup !== null)
      .sort((a, b) => a.id.localeCompare(b.id, 'en')),
    asOf: today,
  }
}, {
  name: 'public-seoul-map-preview-v3', maxAge: 60, swr: false,
  // Default key includes API base and Seoul date; only successful public JSON is cached.
  // No Google image, URL, API key, or incoming credentials enter this cache.
})
