import { getPlacesOptions } from '../../utils/placesBrowse'

export default defineEventHandler(event => {
  setResponseHeader(event, 'cache-control', 'no-store')
  if (Object.keys(getQuery(event)).length) throw createError({ statusCode: 400, statusMessage: 'Invalid options query' })
  return getPlacesOptions(useRuntimeConfig(event).apiBase)
})
