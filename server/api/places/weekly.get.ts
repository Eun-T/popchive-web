import { getPlacesWeekly } from '../../utils/placesWeekly'
import { endingSoonToday } from '../../../shared/utils/endingSoon'
import { weeklyWindow } from '../../../shared/utils/weeklyPopups'

export default defineEventHandler(event => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const query = getQuery(event)
  if (Object.keys(query).some(key => key !== 'weekStart') || typeof query.weekStart !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid weekly query' })
  }
  let weekStart: string
  try { weekStart = weeklyWindow(query.weekStart).weekStart }
  catch { throw createError({ statusCode: 400, statusMessage: 'Week must be Monday through Sunday' }) }
  return getPlacesWeekly(useRuntimeConfig(event).apiBase, weekStart, endingSoonToday())
})
