import { endingSoonToday } from '#shared/utils/endingSoon'
import { getTodayPopups } from '../../utils/todayPopups'

export default defineEventHandler(event => {
  setResponseHeader(event, 'cache-control', 'no-store')
  if (Object.keys(getQuery(event)).length) {
    throw createError({ statusCode: 400, statusMessage: 'Today popup query parameters are not supported' })
  }
  return getTodayPopups(useRuntimeConfig(event).apiBase, endingSoonToday())
})
