import type { QuickSearchPopup } from '../types/quickSearch'

export function quickSearchLanguage(query: string): 'ko' | 'ja' {
  return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(query)
    && !/\p{Script=Hangul}/u.test(query) ? 'ja' : 'ko'
}
export function validQuickSearch(query: string): boolean {
  const length = Array.from(query.trim()).length
  return length >= 2 && length <= 100
}
export function normalizeQuickSearch(response: unknown): QuickSearchPopup[] {
  if (!response || typeof response !== 'object' || !('popups' in response) || !Array.isArray(response.popups)
    || response.popups.length > 5) throw new Error('Invalid quick search response')
  const unique = new Map<string, QuickSearchPopup>()
  for (const value of response.popups) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid search item')
    const row = value as Record<string, unknown>
    if (typeof row.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(row.id)
      || typeof row.name !== 'string' || !row.name.trim() || typeof row.address !== 'string'
      || (row.regionName !== null && typeof row.regionName !== 'string')
      || typeof row.latitude !== 'number' || !Number.isFinite(row.latitude) || Math.abs(row.latitude) > 90
      || typeof row.longitude !== 'number' || !Number.isFinite(row.longitude) || Math.abs(row.longitude) > 180) throw new Error('Invalid search item')
    if (!unique.has(row.id)) unique.set(row.id, {
      id: row.id, name: row.name, latitude: row.latitude, longitude: row.longitude,
      address: row.address, regionName: row.regionName,
    })
  }
  return [...unique.values()]
}
