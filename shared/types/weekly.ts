export interface WeeklyPopup {
  publicId: string
  name: string
  countryCode: 'KR' | 'JP'
  regionName: string | null
  startDate: string
  endDate: string
  coverImageUrl: string | null
  tags: { id: number; name: string }[]
  status: 'ongoing' | 'upcoming' | 'ended'
}
export interface WeeklyPopupsResponse {
  items: WeeklyPopup[]
  weekStart: string
  weekEnd: string
  asOf: string
  fetchedAt: number
}
