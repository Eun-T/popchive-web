import type { PlaceCountry } from '../types/places'

// App placeRegionPages order and verified public /api/regions IDs.
// Images remain null until file-specific web usage rights are confirmed.
export const PLACE_REGION_PAGES: { countryCode: PlaceCountry; label: string; items: { id: number; name: string; image: string | null }[] }[] = [
  { countryCode: 'KR', label: '한국', items: [
    { id: 1, name: '성수', image: null }, { id: 4, name: '홍대·신촌', image: null },
    { id: 2, name: '여의도', image: null }, { id: 5, name: '강남·서초', image: null },
  ] },
  { countryCode: 'JP', label: '일본', items: [
    { id: 15, name: '도쿄', image: null }, { id: 16, name: '오사카', image: null },
    { id: 17, name: '교토', image: null }, { id: 18, name: '나고야', image: null },
  ] },
]
