export type PlaceCountry = 'KR' | 'JP'
export type PlaceStatus = 'ONGOING' | 'UPCOMING' | 'ENDED'
export interface PlaceOption { id: number; name: string }
export interface PlaceRegion extends PlaceOption { countryCode: PlaceCountry }
export interface PlaceOptions { regions: PlaceRegion[]; tags: PlaceOption[] }
export interface PlaceListQuery {
  countryCode?: PlaceCountry
  regionIds?: string
  tagIds?: string
  status?: PlaceStatus
  cursor?: string
}
export interface PlacePopup {
  id: string
  title: string
  image: string | null
  startDate: string | null
  endDate: string | null
  countryCode: PlaceCountry
  regionId: number | null
  tagIds: number[]
}
export interface PlacePage { items: PlacePopup[]; nextCursor: string | null; asOf: string; fetchedAt: number }
