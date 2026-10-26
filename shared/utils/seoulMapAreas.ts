import type { SeoulMapAreaId } from '../types/map'

type Bounds = readonly [south: number, north: number, west: number, east: number]
type AreaDefinition = { id: SeoulMapAreaId; name: string; sourceRegion: string; bounds: readonly Bounds[] }

// Conservative commercial-area windows, not administrative boundaries.
// The authoritative region ID must also match its resolved name, or Seoul Other.
// Broad Hongdae/Sinchon and Gangnam/Seocho labels alone are insufficient.
export const SEOUL_MAP_AREAS: readonly AreaDefinition[] = [
  { id: 'hongdae', name: '홍대', sourceRegion: '홍대·신촌', bounds: [[37.545, 37.565, 126.915, 126.932]] },
  { id: 'yongsan', name: '용산', sourceRegion: '용산', bounds: [[37.515, 37.555, 126.945, 127.010]] },
  { id: 'yeongdeungpo', name: '여의도·영등포', sourceRegion: '여의도', bounds: [
    [37.515, 37.535, 126.915, 126.940], // Yeouido core
    [37.509, 37.523, 126.895, 126.913], // Yeongdeungpo station commercial area
  ] },
  { id: 'seongsu', name: '성수', sourceRegion: '성수', bounds: [[37.533, 37.555, 127.035, 127.075]] },
  { id: 'gangnam', name: '강남', sourceRegion: '강남·서초', bounds: [
    [37.513, 37.535, 127.022, 127.065], // Sinsa/Nonhyeon/Cheongdam core
    [37.495, 37.513, 127.031, 127.065], // Yeoksam/Samseong core, excluding Seocho
  ] },
  { id: 'jamsil', name: '잠실', sourceRegion: '잠실', bounds: [[37.505, 37.525, 127.072, 127.115]] },
]

export function classifySeoulMapArea(sourceRegion: string, latitude: number, longitude: number): SeoulMapAreaId | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  const matches = SEOUL_MAP_AREAS.filter(area =>
    (sourceRegion === area.sourceRegion || sourceRegion === '서울 기타')
    && area.bounds.some(([south, north, west, east]) =>
      latitude > south && latitude < north && longitude > west && longitude < east),
  )
  // Boundary, overlapping, missing or contradictory classifications stay Other.
  return matches.length === 1 ? matches[0]!.id : null
}
