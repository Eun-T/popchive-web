import type { MapPopup, PopupMapResponse, SeoulMapPreviewResponse } from '../../../shared/types/map'
import { getSeoulMapPreview } from '../../utils/seoulMapPreview'

export default defineEventHandler(async (event): Promise<PopupMapResponse | SeoulMapPreviewResponse> => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const query = getQuery(event)
  if (query.preview !== undefined) {
    if (query.preview !== 'seoul' || Object.keys(query).some(key => key !== 'preview')) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid map preview query' })
    }
    // Extend this existing public route; the interactive map's bounds mode is unchanged.
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
    return getSeoulMapPreview(useRuntimeConfig(event).apiBase, today)
  }
  const bounds: Record<string, number> = {}
  for (const key of ['minLat', 'maxLat', 'minLng', 'maxLng']) {
    const value = query[key]
    if (typeof value !== 'string' || value.trim() === '' || !Number.isFinite(Number(value))) {
      throw createError({ statusCode: 400, statusMessage: 'All four numeric bounds are required' })
    }
    bounds[key] = Number(value)
  }
  const { minLat, maxLat, minLng, maxLng } = bounds as Record<'minLat' | 'maxLat' | 'minLng' | 'maxLng', number>
  if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180 || minLat > maxLat || minLng > maxLng
    || (query.languageCode !== undefined && query.languageCode !== 'ko')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid map bounds or language' })
  }

  let response: unknown
  try {
    // Fixed public endpoint only. Do not forward incoming cookies, auth, origin or arbitrary parameters.
    response = await $fetch<unknown>('/api/popups/map', {
      baseURL: useRuntimeConfig(event).apiBase,
      query: { minLat, maxLat, minLng, maxLng, languageCode: 'ko' },
      method: 'GET',
      headers: { accept: 'application/json' },
      credentials: 'omit',
      redirect: 'error',
      timeout: 10_000,
      retry: 0,
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Popup map API request failed' })
  }

  const invalid = (): never => { throw createError({ statusCode: 502, statusMessage: 'Invalid popup map response' }) }
  if (!response || typeof response !== 'object' || !('popups' in response) || !Array.isArray(response.popups)) {
    return invalid()
  }
  const popups: MapPopup[] = response.popups.map((value: unknown) => {
    if (!value || typeof value !== 'object') return invalid()
    const row = value as Record<string, unknown>
    if (typeof row.id !== 'string' || !row.id.trim() || typeof row.name !== 'string' || !row.name.trim()
      || typeof row.latitude !== 'number' || !Number.isFinite(row.latitude) || Math.abs(row.latitude) > 90
      || typeof row.longitude !== 'number' || !Number.isFinite(row.longitude) || Math.abs(row.longitude) > 180) {
      return invalid()
    }
    return { id: row.id, name: row.name, latitude: row.latitude, longitude: row.longitude }
  })
  if (new Set(popups.map(popup => popup.id)).size !== popups.length) return invalid()
  return { popups }
})
