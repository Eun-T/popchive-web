import type { WeeklyPopupsResponse } from '../../shared/types/weekly'
import { normalizeWeeklyPopups, weeklyWindow } from '../../shared/utils/weeklyPopups'

export const getPlacesWeekly = defineCachedFunction(async (
  apiBase: string, weekStart: string, asOf: string,
): Promise<WeeklyPopupsResponse> => {
  const window = weeklyWindow(weekStart)
  let response: unknown
  try {
    response = await $fetch<unknown>('/api/popups', {
      baseURL: apiBase, query: { ...window, languageCode: 'ko' }, method: 'GET',
      headers: { accept: 'application/json' }, credentials: 'omit', redirect: 'error', timeout: 10_000, retry: 0,
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Weekly popup request failed' })
  }
  try {
    return { ...window, asOf, items: normalizeWeeklyPopups(response, weekStart, asOf), fetchedAt: Date.now() }
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Invalid weekly popup response' })
  }
}, { name: 'public-places-weekly-v1', maxAge: 30, swr: false })
