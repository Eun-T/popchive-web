import { getPlacesVenues, getPlacesVenuePopups } from '../../utils/placesVenues'
import { endingSoonToday } from '../../../shared/utils/endingSoon'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const query = getQuery(event)
  if (Object.keys(query).some(key => key !== 'venueId')
    || (query.venueId !== undefined && (typeof query.venueId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(query.venueId)))) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid venue query' })
  }
  const apiBase = useRuntimeConfig(event).apiBase
  const asOf = endingSoonToday()
  return typeof query.venueId === 'string'
    ? getPlacesVenuePopups(apiBase, query.venueId, asOf)
    : getPlacesVenues(apiBase, asOf)
})
