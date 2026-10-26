export interface QuickSearchPopup {
  id: string
  name: string
  latitude: number
  longitude: number
  address: string
  regionName: string | null
}
export interface QuickSearchResponse { popups: QuickSearchPopup[] }
