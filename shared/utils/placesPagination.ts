// Cursor-only upstream: bound random page traversal to avoid unbounded backend work.
export const MAX_PLACES_PAGE = 100
export function placesPageNumber(value: unknown): number | null {
  if (value === undefined) return 1
  if (typeof value !== 'string' || !/^[1-9]\d{0,2}$/.test(value)) return null
  const page = Number(value)
  return page <= MAX_PLACES_PAGE ? page : null
}
