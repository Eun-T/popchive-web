import type { EndingSoonResponse } from '../../shared/types/endingSoon'
import { normalizeEndingSoon } from '../../shared/utils/endingSoon'

export const getPlacesEndingSoon = defineCachedFunction(async (
  apiBase: string, asOf: string,
): Promise<EndingSoonResponse> => {
  let response: unknown
  try {
    // The same existing public endpoint used by the mobile app. No forwarded credentials.
    response = await $fetch<unknown>('/api/popups', {
      baseURL: apiBase, query: { endingSoon: 'true', languageCode: 'ko' },
      method: 'GET', headers: { accept: 'application/json' }, credentials: 'omit',
      redirect: 'error', timeout: 10_000, retry: 0,
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Ending-soon popup request failed' })
  }
  try {
    return { items: normalizeEndingSoon(response, asOf), asOf, fetchedAt: Date.now() }
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Invalid ending-soon popup response' })
  }
}, {
  name: 'public-places-ending-soon-v1', maxAge: 30, swr: false,
  // API base + snapshot date form the cache key; never carry a day across midnight.
})
