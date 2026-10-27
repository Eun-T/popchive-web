import type { PopupRecommendationKind, PopupRecommendationsResponse, RecommendedPopup } from '../types/popupRecommendations'

export function normalizePopupRecommendations(value: unknown, kind: PopupRecommendationKind): PopupRecommendationsResponse {
  const invalid = (): never => { throw new Error('Invalid popup recommendations response') }
  const record = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
    return value as Record<string, unknown>
  }
  const text = (value: unknown): string | null => {
    if (value === null) return null
    if (typeof value !== 'string') return invalid()
    return value.trim() || null
  }
  const date = (value: unknown) => {
    const result = text(value)
    if (result && (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result))
      || new Date(result).toISOString().slice(0, 10) !== result)) return invalid()
    return result
  }
  const body = record(value)
  if (!Array.isArray(body.popups) || body.popups.length > 7) return invalid()
  const popups = body.popups.map((value): RecommendedPopup => {
    const row = record(value)
    const publicId = text(row.publicId), name = text(row.name)
    if (!publicId || !/^[a-zA-Z0-9_-]{1,128}$/.test(publicId) || !name || !Array.isArray(row.tags)) return invalid()
    const coverImageUrl = text(row.coverImageUrl)
    if (coverImageUrl) {
      const image = new URL(coverImageUrl)
      if (!['http:', 'https:'].includes(image.protocol) || image.username || image.password) return invalid()
    }
    const tags = row.tags.map(value => {
      const tag = record(value), name = text(tag.name)
      if (typeof tag.id !== 'number' || !Number.isSafeInteger(tag.id) || tag.id <= 0 || !name) return invalid()
      return { id: tag.id, name }
    })
    const startDate = date(row.startDate), endDate = date(row.endDate)
    if (startDate && endDate && startDate > endDate) return invalid()
    const popup: RecommendedPopup = { publicId, name, coverImageUrl, startDate, endDate, regionName: text(row.regionName), tags }
    if (kind === 'nearby') {
      if (typeof row.distanceMeters !== 'number' || !Number.isFinite(row.distanceMeters) || row.distanceMeters < 0) return invalid()
      popup.distanceMeters = row.distanceMeters
    } else {
      if (typeof row.matchedTagCount !== 'number' || !Number.isSafeInteger(row.matchedTagCount) || row.matchedTagCount < 1) return invalid()
      popup.matchedTagCount = row.matchedTagCount
    }
    return popup
  })
  if (new Set(popups.map(popup => popup.publicId)).size !== popups.length) return invalid()
  return { popups }
}

export function recommendationDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`
}

export function recommendationDayStatus(popup: RecommendedPopup, today: string) {
  const { startDate: start, endDate: end } = popup
  const daysUntil = (date: string) => (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000
  if (end && end < today) return { label: '종료', state: 'ended' }
  if (start && start > today) return { label: `오픈 D-${daysUntil(start)}`, state: 'upcoming' }
  if (end === today) return { label: '오늘 종료', state: 'last-day' }
  if (start === today) return { label: '오늘 오픈', state: 'ongoing' }
  if (start && start < today && end && end > today) return { label: `종료 D-${daysUntil(end)}`, state: 'ongoing' }
  return null
}
