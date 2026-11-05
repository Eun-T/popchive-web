import type { PlaceListQuery, PlacePage } from '../../shared/types/places'
import { PLACE_PAGE_SIZE } from '../../shared/types/places'
import { MAX_PLACES_PAGE } from '../../shared/utils/placesPagination'
import { getPlacesPage } from './placesBrowse'

// In-flight work only: retain neither results nor cursor checkpoints after completion.
// The existing per-cursor 30s cache remains the sole data freshness policy.
const pending = new Map<string, Promise<PlacePage>>()
const MAX_PENDING = 64

export function getNumberedPlacesPage(apiBase: string, query: PlaceListQuery, asOf: string, page: number): Promise<PlacePage> {
  if (!Number.isInteger(page) || page < 1 || page > MAX_PLACES_PAGE || query.cursor !== undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid popup page' })
  }
  const normalized: PlaceListQuery = { ...query, limit: PLACE_PAGE_SIZE, sort: query.sort ?? 'LATEST' }
  const key = JSON.stringify([
    apiBase, asOf, 'ko', page,
    Object.entries(normalized).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b)),
  ])
  const existing = pending.get(key)
  if (existing) return existing
  // At capacity, perform the normal traversal without retaining another map entry.
  if (pending.size >= MAX_PENDING) return traverse(apiBase, normalized, asOf, page)
  const flight: Promise<PlacePage> = traverse(apiBase, normalized, asOf, page).finally(() => {
    if (pending.get(key) === flight) pending.delete(key)
  })
  pending.set(key, flight)
  return flight
}

async function traverse(apiBase: string, query: PlaceListQuery, asOf: string, requestedPage: number): Promise<PlacePage> {
  const startedAt = Date.now()
  const seen = new Set<string>()
  const withinBudget = () => {
    if (Date.now() - startedAt > 20_000) {
      throw createError({ statusCode: 503, statusMessage: 'Popup pagination unavailable' })
    }
  }
  let result = await getPlacesPage(apiBase, query, asOf)
  withinBudget()
  for (let page = 1; page < requestedPage; page++) {
    if (!result.nextCursor) throw createError({ statusCode: 404, statusMessage: 'Popup page not found' })
    if (seen.has(result.nextCursor)) throw createError({ statusCode: 503, statusMessage: 'Popup pagination unavailable' })
    withinBudget()
    seen.add(result.nextCursor)
    result = await getPlacesPage(apiBase, { ...query, cursor: result.nextCursor }, asOf)
    withinBudget()
  }
  if (requestedPage > 1 && !result.items.length) throw createError({ statusCode: 404, statusMessage: 'Popup page not found' })
  return result
}
