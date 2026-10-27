import { getHomePopups } from '../../utils/homePopups'

export default defineEventHandler(async (event) => {
  // Cache public data inside Nitro for 30 seconds, never HTML/browser responses.
  setResponseHeader(event, 'cache-control', 'no-store')
  const section = getRouterParam(event, 'section')
  if (section !== 'main-banners' && section !== 'new-popups' && section !== 'now-hot' && section !== 'japan-new-popups') {
    throw createError({ statusCode: 404, statusMessage: 'Unknown home section' })
  }
  const query = getQuery(event)
  const countryCode = query.countryCode ?? 'KR'
  const languageCode = query.languageCode ?? 'ko'
  if ((countryCode !== 'KR' && countryCode !== 'JP') || (languageCode !== 'ko' && languageCode !== 'ja')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid country or language' })
  }
  if (section === 'japan-new-popups' && countryCode !== 'JP') {
    throw createError({ statusCode: 400, statusMessage: 'Japan section requires JP' })
  }
  // No incoming Cookie, Authorization, Origin, or arbitrary query is forwarded.
  return getHomePopups(useRuntimeConfig(event).apiBase, section, countryCode, languageCode)
})
