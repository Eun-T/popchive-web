export const SEOUL_MAP_CENTER = { latitude: 37.5300, longitude: 126.9780 }
const MAX_URL_LENGTH = 16_384

export function buildSeoulStaticMap(apiKey: string, frameWidth: number, frameHeight: number, mapId = '') {
  if (!apiKey.trim() || frameWidth <= 0 || frameHeight <= 0) throw new Error('Static map configuration is missing')
  // One size per component lifetime. scale=2 adds resolution without changing map coverage.
  const ratio = Math.min(1, 640 / frameWidth, 640 / frameHeight)
  const width = Math.max(1, Math.round(frameWidth * ratio))
  const height = Math.max(1, Math.round(frameHeight * ratio))
  const zoom = 11
  const url = new URL('https://maps.googleapis.com/maps/api/staticmap')
  url.search = new URLSearchParams({
    center: `${SEOUL_MAP_CENTER.latitude},${SEOUL_MAP_CENTER.longitude}`, zoom: String(zoom),
    size: `${width}x${height}`, scale: '2', maptype: 'roadmap', language: 'ko', region: 'KR',
    format: 'png', key: apiKey.trim(),
  }).toString()
  if (mapId.trim()) url.searchParams.set('map_id', mapId.trim())
  if (url.href.length > MAX_URL_LENGTH) throw new Error('Static map URL is too long')
  return { url: url.href, width, height, zoom }
}

export function projectSeoulMapPoint(
  latitude: number, longitude: number,
  image: { width: number; height: number; zoom: number }, frameWidth: number, frameHeight: number, badgeWidth = 44,
) {
  if (frameWidth <= 0 || frameHeight <= 0 || image.width <= 0 || image.height <= 0) return null
  const worldSize = 256 * 2 ** image.zoom
  const worldY = (lat: number) => {
    const sin = Math.sin(Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180)
    return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize
  }
  // size uses logical pixels: scale=2 doubles both source size and positions,
  // so it cancels when mapping the complete source image into object-fit:contain.
  const fit = Math.min(frameWidth / image.width, frameHeight / image.height)
  const left = (frameWidth - image.width * fit) / 2
  const top = (frameHeight - image.height * fit) / 2
  const x = left + (image.width / 2 + (longitude - SEOUL_MAP_CENTER.longitude) / 360 * worldSize) * fit
  const y = top + (image.height / 2 + worldY(latitude) - worldY(SEOUL_MAP_CENTER.latitude)) * fit
  // Keep the whole badge inside the actual image and clear its bottom attribution.
  // Out-of-frame locations are hidden; never clamp them to an incorrect map location.
  const halfWidth = Math.max(22, badgeWidth / 2)
  if (x < left + halfWidth || x > left + image.width * fit - halfWidth
    || y < top + 22 || y > top + image.height * fit - 68) return null
  return { x, y }
}
