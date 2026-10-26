import type { WeeklyPopup } from '../types/weekly'

function date(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) throw new Error('Invalid weekly date')
  const parsed = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Invalid weekly date')
  return value
}
export function weeklyAddDays(value: string, days: number): string {
  const parsed = new Date(`${date(value)}T00:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return date(parsed.toISOString().slice(0, 10))
}
export function weeklyMonday(value: string): string {
  const parsed = new Date(`${date(value)}T00:00:00Z`)
  return weeklyAddDays(value, -((parsed.getUTCDay() + 6) % 7))
}
export function weeklyWindow(weekStart: string) {
  if (weeklyMonday(weekStart) !== weekStart) throw new Error('Week must start on Monday')
  return { weekStart, weekEnd: weeklyAddDays(weekStart, 6) }
}
export function weeklyLabel(weekStart: string): string {
  const { weekEnd } = weeklyWindow(weekStart)
  const short = (value: string) => `${Number(value.slice(5, 7))}.${Number(value.slice(8, 10))}`
  return `${short(weekStart)} - ${short(weekEnd)}`
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid weekly response')
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid weekly text')
  return value
}
export function normalizeWeeklyPopups(response: unknown, weekStart: string, asOf: string): WeeklyPopup[] {
  const { weekEnd } = weeklyWindow(weekStart)
  date(asOf)
  const body = record(response)
  // The existing weekly mode returns up to 9 selected results, never a cursor page.
  if (!Array.isArray(body.popups) || body.popups.length > 9 || body.nextCursor !== null) throw new Error('Invalid weekly list mode')
  const unique = new Map<string, WeeklyPopup>()
  for (const value of body.popups) {
    const row = record(value)
    const startDate = date(row.startDate), endDate = date(row.endDate)
    if (startDate > endDate || startDate > weekEnd || endDate < weekStart) throw new Error('Popup outside selected week')
    if (row.countryCode !== 'KR' && row.countryCode !== 'JP') throw new Error('Invalid weekly country')
    const coverImageUrl = row.coverImageUrl === null ? null : text(row.coverImageUrl)
    if (coverImageUrl && !['https:', 'http:'].includes(new URL(coverImageUrl).protocol)) throw new Error('Invalid weekly image')
    if (!Array.isArray(row.tags)) throw new Error('Invalid weekly tags')
    const tags = row.tags.map(value => {
      const tag = record(value)
      if (typeof tag.id !== 'number' || !Number.isSafeInteger(tag.id) || tag.id <= 0) throw new Error('Invalid weekly tag ID')
      return { id: tag.id, name: text(tag.name) }
    })
    const publicId = text(row.publicId)
    if (!unique.has(publicId)) unique.set(publicId, {
      publicId, name: text(row.name), countryCode: row.countryCode,
      regionName: row.regionName === null ? null : text(row.regionName), startDate, endDate, coverImageUrl,
      tags: [...new Map(tags.map(tag => [tag.id, tag])).values()],
      status: startDate > asOf ? 'upcoming' : endDate < asOf ? 'ended' : 'ongoing',
    })
  }
  // Equal start dates retain the backend's id ASC order.
  return [...unique.values()].sort((a, b) => a.startDate.localeCompare(b.startDate))
}
