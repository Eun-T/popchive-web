export interface TodayPopup {
  publicId: string
  name: string
  startDate: string
  endDate: string
  regionName: string | null
  coverImageUrl: string | null
}

export interface TodayPopupsResponse {
  items: TodayPopup[]
  asOf: string
  fetchedAt: number
}
