import type { PlaceListQuery } from '../../../shared/types/places'
import { PLACE_PAGE_SIZE } from '../../../shared/types/places'
import { endingSoonToday } from '../../../shared/utils/endingSoon'
import { getPlacesPage } from '../../utils/placesBrowse'

export default defineEventHandler(event => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const raw = getQuery(event)
  const allowed = ['countryCode', 'regionIds', 'tagIds', 'status', 'cursor', 'limit', 'sort']
  const bad = () => { throw createError({ statusCode: 400, statusMessage: 'Invalid popup filters' }) }
  if (Object.keys(raw).some(key => !allowed.includes(key) || typeof raw[key] !== 'string')) bad()
  if (raw.limit !== undefined && raw.limit !== String(PLACE_PAGE_SIZE)) bad()
  if (raw.sort !== undefined && !['LATEST', 'START_DATE_ASC', 'END_DATE_ASC'].includes(raw.sort as string)) bad()
  const query: PlaceListQuery = { limit: PLACE_PAGE_SIZE, sort: (raw.sort ?? 'LATEST') as PlaceListQuery['sort'] }
  if (raw.countryCode !== undefined) {
    if (raw.countryCode !== 'KR' && raw.countryCode !== 'JP') bad()
    query.countryCode = raw.countryCode as PlaceListQuery['countryCode']
  }
  for (const key of ['regionIds', 'tagIds'] as const) if (raw[key] !== undefined) {
    const value = raw[key] as string
    if (!/^[1-9]\d{0,8}(,[1-9]\d{0,8}){0,29}$/.test(value)) bad()
    query[key] = [...new Set(value.split(',').map(Number))].sort((a, b) => a - b).join(',')
  }
  if (raw.status !== undefined) {
    if (!['ONGOING', 'UPCOMING', 'ENDED'].includes(raw.status as string)) bad()
    query.status = raw.status as PlaceListQuery['status']
  }
  if (raw.cursor !== undefined) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(raw.cursor as string)) bad()
    query.cursor = raw.cursor as string
  }
  return getPlacesPage(useRuntimeConfig(event).apiBase, query, endingSoonToday())
})
