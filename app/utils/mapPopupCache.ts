import type { MapPopup } from '../../shared/types/map'
import { popupCalendarDate } from './popupDates'

export type MapViewport = { south: number; north: number; west: number; east: number }
export type BoundsQuery = { minLat: number; maxLat: number; minLng: number; maxLng: number }
export const MAP_CACHE_TTL = 300_000
const floor = (n: number) => Math.floor(n * 1e6) / 1e6
const ceil = (n: number) => Math.ceil(n * 1e6) / 1e6
const longitude = (n: number) => ((n + 180) % 360 + 360) % 360 - 180

// Each rectangle is non-wrapping so it can use the existing Spring API contract.
export function boundsQueries(view: MapViewport, scale = 1): BoundsQuery[] {
  if (!Object.values(view).every(Number.isFinite) || view.south > view.north) return []
  const latPadding = (view.north - view.south) * (scale - 1) / 2
  const latitude = {
    minLat: Math.min(90, Math.max(-90, floor(view.south - latPadding))),
    maxLat: Math.max(-90, Math.min(90, ceil(view.north + latPadding))),
  }
  const rawSpan = view.east - view.west
  const span = rawSpan < 0 ? rawSpan + 360 : rawSpan
  if (span * scale >= 360) return [{ ...latitude, minLng: -180, maxLng: 180 }]
  const padding = span * (scale - 1) / 2
  const west = floor(longitude(view.west - padding))
  const east = ceil(longitude(view.east + padding))
  return west <= east
    ? [{ ...latitude, minLng: west, maxLng: east }]
    : [{ ...latitude, minLng: west, maxLng: 180 }, { ...latitude, minLng: -180, maxLng: east }]
}

export function containsBounds(area: BoundsQuery[], view: BoundsQuery[]): boolean {
  return view.length > 0 && view.every(part => area.some(rect =>
    part.minLat >= rect.minLat && part.maxLat <= rect.maxLat
    && part.minLng >= rect.minLng && part.maxLng <= rect.maxLng,
  ))
}

export function visiblePopups(popups: MapPopup[], view: MapViewport): MapPopup[] {
  const inside = (lng: number) => view.west <= view.east
    ? lng >= view.west && lng <= view.east
    : lng >= view.west || lng <= view.east
  const seen = new Set<string>()
  return popups.filter(popup => {
    if (seen.has(popup.id) || popup.latitude < view.south || popup.latitude > view.north
      || !(inside(popup.longitude) || (Math.abs(popup.longitude) === 180 && inside(-popup.longitude)))) return false
    seen.add(popup.id)
    return true
  })
}

// Signed S3 URLs can expire before a response-completion-based cache TTL.
// Keep the popup data; use the existing missing-image fallback without extra requests.
export function usableImages(popups: MapPopup[], now = Date.now()): MapPopup[] {
  return popups.map(popup => {
    if (!popup.coverImageUrl) return popup
    try {
      const params = new URL(popup.coverImageUrl).searchParams
      const date = params.get('X-Amz-Date')
      const seconds = Number(params.get('X-Amz-Expires'))
      if (date && /^\d{8}T\d{6}Z$/.test(date) && Number.isFinite(seconds)) {
        const timestamp = Date.parse(date.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'))
        if (timestamp + seconds * 1000 <= now + 30_000) return { ...popup, coverImageUrl: null }
      }
    } catch { return { ...popup, coverImageUrl: null } }
    return popup
  })
}

export type MapCacheEntry = {
  bounds: BoundsQuery[]; popups: MapPopup[]; completedAt: number; expiresAt: number; day: string
}

export class MapPopupCache {
  private entries = new Map<string, MapCacheEntry>()

  get size() { return this.entries.size }
  clear() { this.entries.clear() }

  private prune(now: number) {
    const day = popupCalendarDate(now, null)
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now || entry.day !== day) this.entries.delete(key)
    }
  }

  find(view: BoundsQuery[], now = Date.now()): MapCacheEntry | undefined {
    this.prune(now)
    // Prefer the most recently used containing area.
    for (const [key, entry] of [...this.entries].reverse()) {
      if (!containsBounds(entry.bounds, view)) continue
      this.entries.delete(key)
      this.entries.set(key, entry)
      return entry
    }
  }

  store(bounds: BoundsQuery[], popups: MapPopup[], now = Date.now()) {
    this.prune(now)
    const key = JSON.stringify(bounds)
    this.entries.delete(key)
    this.entries.set(key, {
      bounds, popups: [...new Map(popups.map(popup => [popup.id, popup])).values()],
      completedAt: now, expiresAt: now + MAP_CACHE_TTL, day: popupCalendarDate(now, null),
    })
    while (this.entries.size > 10) this.entries.delete(this.entries.keys().next().value!)
  }
}
