import { normalizePopupRecommendations } from '../../../../shared/utils/popupRecommendations'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const id = getRouterParam(event, 'id') ?? ''
  const kind = getRouterParam(event, 'recommendation')
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid popup ID' })
  if (kind !== 'nearby' && kind !== 'similar') throw createError({ statusCode: 404, statusMessage: 'Unknown recommendation section' })
  const query = getQuery(event)
  if (Object.keys(query).some(key => key !== 'limit' && key !== 'languageCode')
    || query.limit !== '7' || query.languageCode !== 'ko') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid recommendation query' })
  }
  try {
    // Only the two verified public GET endpoints; never forward visitor credentials.
    const response = await $fetch<unknown>(`/api/popups/${encodeURIComponent(id)}/${kind}`, {
      baseURL: useRuntimeConfig(event).apiBase,
      query: { limit: 7, languageCode: 'ko' }, method: 'GET',
      headers: { accept: 'application/json' }, credentials: 'omit', redirect: 'error', timeout: 10_000, retry: 0,
    })
    return normalizePopupRecommendations(response, kind)
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status
    throw createError({ statusCode: status === 404 ? 404 : 502, statusMessage: 'Popup recommendations unavailable' })
  }
})
