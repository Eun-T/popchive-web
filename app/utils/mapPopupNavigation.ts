import type { MapPopup } from '../../shared/types/map'

export function distanceBetween(a: MapPopup, b: MapPopup): number {
  const rad = Math.PI / 180
  const h = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2
    + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad)
    * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)))
}

export function popupNavigation(popups: MapPopup[], origin: MapPopup): string[] {
  // Group coordinates first so equidistant buildings cannot interleave their popups.
  const groups = new Map<string, MapPopup[]>()
  for (const popup of popups) {
    const key = `${popup.latitude},${popup.longitude}`
    const group = groups.get(key) ?? []
    group.push(popup)
    groups.set(key, group)
  }
  const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
  const sorted = [...groups.values()].map(group => group.sort((a, b) => compare(a.id, b.id)))
  sorted.sort((a, b) => distanceBetween(origin, a[0]!) - distanceBetween(origin, b[0]!) || compare(a[0]!.id, b[0]!.id))
  const originGroup = sorted.findIndex(group => group.some(popup => popup.id === origin.id))
  if (originGroup >= 0) {
    const [group] = sorted.splice(originGroup, 1)
    sorted.unshift([origin, ...group!.filter(popup => popup.id !== origin.id)])
  }
  return sorted.flatMap(group => group.map(popup => popup.id))
}
