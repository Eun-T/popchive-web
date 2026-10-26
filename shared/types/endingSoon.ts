export type EndingSoonPopup = {
  publicId: string
  name: string
  countryCode: 'KR' | 'JP'
  startDate: string
  endDate: string
  coverImageUrl: string | null
  daysLeft: number
}

export type EndingSoonResponse = {
  items: EndingSoonPopup[]
  asOf: string // Shared server snapshot date, UTC+9 for both Korea and Japan
  fetchedAt: number
}
