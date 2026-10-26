import type { EndingSoonPopup } from '../types/endingSoon'

export function endingSoonToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

function readDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid popup date')
  const parsed = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Invalid popup date')
  return value
}

export function normalizeEndingSoon(response: unknown, asOf: string): EndingSoonPopup[] {
  readDate(asOf)
  if (!response || typeof response !== 'object' || !('popups' in response) || !Array.isArray(response.popups)
    || 'nextCursor' in response) throw new Error('Invalid ending-soon response')
  const unique = new Map<string, EndingSoonPopup>()
  for (const value of response.popups) {
    if (!value || typeof value !== 'object') throw new Error('Invalid ending-soon popup')
    const row = value as Record<string, unknown>
    if (row.countryCode !== 'KR' && row.countryCode !== 'JP') continue
    if (typeof row.publicId !== 'string' || !row.publicId.trim() || typeof row.name !== 'string' || !row.name.trim()) {
      throw new Error('Invalid ending-soon popup')
    }
    const startDate = readDate(row.startDate)
    const endDate = readDate(row.endDate)
    // Date-only UTC arithmetic avoids local browser time zones and DST.
    const daysLeft = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / 86_400_000
    if (startDate > asOf || endDate < startDate || daysLeft < 0 || daysLeft > 5) continue
    const cover = row.coverImageUrl
    if (cover !== null && cover !== undefined && (typeof cover !== 'string' || !['https:', 'http:'].includes(new URL(cover).protocol))) {
      throw new Error('Invalid ending-soon image')
    }
    if (!unique.has(row.publicId)) unique.set(row.publicId, {
      publicId: row.publicId, name: row.name, countryCode: row.countryCode,
      startDate, endDate, daysLeft, coverImageUrl: typeof cover === 'string' ? cover : null,
    })
  }
  // Stable ties preserve the backend's id order; never pad or repeat cards.
  return [...unique.values()].sort((a, b) => a.endDate.localeCompare(b.endDate)).slice(0, 7)
}
