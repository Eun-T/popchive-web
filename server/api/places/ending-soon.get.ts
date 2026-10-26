import { getPlacesEndingSoon } from '../../utils/placesEndingSoon'
import { endingSoonToday } from '../../../shared/utils/endingSoon'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'cache-control', 'no-store')
  if (Object.keys(getQuery(event)).length) {
    throw createError({ statusCode: 400, statusMessage: 'Ending-soon query parameters are not supported' })
  }
  return getPlacesEndingSoon(useRuntimeConfig(event).apiBase, endingSoonToday())
})
