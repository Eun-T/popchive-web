import type { PopupVenuesResponse, VenuePopupsResponse } from '../../shared/types/venues'
import { normalizePopupVenues, normalizeVenuePopups } from '../../shared/utils/popupVenues'

async function readVenues(apiBase: string, venueId?: string): Promise<unknown> {
  try {
    return await $fetch<unknown>('/api/popups/venues', {
      baseURL: apiBase, query: { languageCode: 'ko', ...(venueId ? { venueId } : {}) },
      method: 'GET', headers: { accept: 'application/json' }, credentials: 'omit',
      redirect: 'error', timeout: 10_000, retry: 0,
    })
  } catch (error) {
    const upstream = error as { statusCode?: number; response?: { status?: number } }
    const status = upstream.response?.status ?? upstream.statusCode
    throw createError({ statusCode: status === 404 ? 404 : 502, statusMessage: 'Popup venue request failed' })
  }
}

export const getPlacesVenues = defineCachedFunction(async (apiBase: string, asOf: string): Promise<PopupVenuesResponse> => {
  const response = await readVenues(apiBase)
  try { return { venues: normalizePopupVenues(response), asOf, fetchedAt: Date.now() } }
  catch { throw createError({ statusCode: 502, statusMessage: 'Invalid popup venues response' }) }
}, { name: 'public-places-venues-v1', maxAge: 30, swr: false })

export const getPlacesVenuePopups = defineCachedFunction(async (
  apiBase: string, venueId: string, asOf: string,
): Promise<VenuePopupsResponse> => {
  const response = await readVenues(apiBase, venueId)
  try { return { ...normalizeVenuePopups(response, venueId, asOf), asOf, fetchedAt: Date.now() } }
  catch { throw createError({ statusCode: 502, statusMessage: 'Invalid venue popups response' }) }
}, { name: 'public-places-venue-popups-v1', maxAge: 30, swr: false })
