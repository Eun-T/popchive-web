import { normalizeQuickSearch, validQuickSearch } from '../../../shared/utils/quickSearch'

const getQuickSearch = defineCachedFunction(async (apiBase: string, q: string, languageCode: 'ko' | 'ja', countryCode: 'KR') => {
  let response: unknown
  try {
    response = await $fetch<unknown>('/api/popups/search', {
      baseURL: apiBase, query: { q, limit: 5, languageCode, countryCode }, method: 'GET',
      headers: { accept: 'application/json' }, credentials: 'omit', redirect: 'error', timeout: 10_000, retry: 0,
    })
  } catch { throw createError({ statusCode: 502, statusMessage: 'Quick search request failed' }) }
  try { return { popups: normalizeQuickSearch(response) } }
  catch { throw createError({ statusCode: 502, statusMessage: 'Invalid quick search response' }) }
}, { name: 'public-popup-quick-search-v2', maxAge: 30, swr: false })

export default defineEventHandler(event => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const query = getQuery(event)
  if (Object.keys(query).some(key => !['q', 'languageCode', 'countryCode'].includes(key))
    || (query.countryCode !== undefined && query.countryCode !== 'KR')
    || typeof query.q !== 'string' || !validQuickSearch(query.q)
    || (query.languageCode !== 'ko' && query.languageCode !== 'ja')) {
    throw createError({ statusCode: 400, statusMessage: 'Search requires 2 to 100 characters and a supported language' })
  }
  // Country participates in Nitro's argument-based cache key, including legacy requests without it.
  return getQuickSearch(useRuntimeConfig(event).apiBase, query.q.trim(), query.languageCode, 'KR')
})
