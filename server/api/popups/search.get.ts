import { normalizeQuickSearch, validQuickSearch } from '../../../shared/utils/quickSearch'

const getQuickSearch = defineCachedFunction(async (apiBase: string, q: string, languageCode: 'ko' | 'ja') => {
  let response: unknown
  try {
    response = await $fetch<unknown>('/api/popups/search', {
      baseURL: apiBase, query: { q, limit: 5, languageCode }, method: 'GET',
      headers: { accept: 'application/json' }, credentials: 'omit', redirect: 'error', timeout: 10_000, retry: 0,
    })
  } catch { throw createError({ statusCode: 502, statusMessage: 'Quick search request failed' }) }
  try { return { popups: normalizeQuickSearch(response) } }
  catch { throw createError({ statusCode: 502, statusMessage: 'Invalid quick search response' }) }
}, { name: 'public-popup-quick-search-v1', maxAge: 30, swr: false })

export default defineEventHandler(event => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const query = getQuery(event)
  if (Object.keys(query).some(key => !['q', 'languageCode'].includes(key))
    || typeof query.q !== 'string' || !validQuickSearch(query.q)
    || (query.languageCode !== 'ko' && query.languageCode !== 'ja')) {
    throw createError({ statusCode: 400, statusMessage: 'Search requires 2 to 100 characters and a supported language' })
  }
  return getQuickSearch(useRuntimeConfig(event).apiBase, query.q.trim(), query.languageCode)
})
