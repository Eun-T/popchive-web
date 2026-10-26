import type { PopupVenue, VenuePopup } from '../types/venues'

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid venue response')
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Missing venue text')
  return value // Do not normalize the authoritative address.
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid venue count')
  return value
}
function image(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !['https:', 'http:'].includes(new URL(value).protocol)) throw new Error('Invalid venue image')
  return value
}
function date(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid venue popup date')
  const parsed = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Invalid venue popup date')
  return value
}

export function normalizePopupVenues(response: unknown): PopupVenue[] {
  const body = record(response)
  if (!Array.isArray(body.venues)) throw new Error('Invalid venue list')
  const ids = new Set<string>()
  return body.venues.map(value => {
    const row = record(value)
    const venueId = text(row.venueId)
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(venueId) || ids.has(venueId)) throw new Error('Invalid or duplicate venue ID')
    ids.add(venueId)
    if (row.countryCode !== 'KR' && row.countryCode !== 'JP') throw new Error('Invalid venue country')
    return {
      venueId, name: text(row.name), address: text(row.address), countryCode: row.countryCode,
      popupCount: count(row.popupCount), imageUrl: image(row.imageUrl),
    } satisfies PopupVenue
  }).filter(venue => venue.popupCount > 0)
}

export function normalizeVenuePopups(response: unknown, venueId: string, asOf: string) {
  date(asOf)
  const body = record(response)
  if (body.venueId !== venueId || !Array.isArray(body.popups) || 'nextCursor' in body) throw new Error('Invalid venue popup list')
  const declaredCount = count(body.popupCount)
  const unique = new Map<string, VenuePopup>()
  for (const value of body.popups) {
    const row = record(value)
    const publicId = text(row.publicId)
    const startDate = date(row.startDate)
    const endDate = row.endDate === null ? null : date(row.endDate)
    const ongoing = startDate <= asOf && endDate !== null && endDate >= asOf
    const upcoming = startDate > asOf && (endDate === null || endDate >= asOf)
    if ((!ongoing && !upcoming) || (endDate !== null && endDate < startDate)) continue
    if (!unique.has(publicId)) unique.set(publicId, {
      publicId, name: text(row.name), startDate, endDate, coverImageUrl: image(row.coverImageUrl),
    })
  }
  // This endpoint returns the entire list, not a page. Never show a partial result as the full count.
  if (unique.size !== declaredCount) throw new Error('Venue popup count does not match the full list')
  return { venueId, popupCount: unique.size, popups: [...unique.values()] }
}
