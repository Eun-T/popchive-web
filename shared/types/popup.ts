// PublicPopupRows.DetailResponse: only verified public fields used by the web UI.
export type PopupDetail = {
  publicId: string
  name: string
  countryCode: string | null
  regionName: string | null
  address: string | null
  locationDetail: string | null
  latitude: number | null
  longitude: number | null
  startDate: string | null
  endDate: string | null
  operatingHours: string | null
  reservationUrl: string | null
  notice: string | null
  benefits: string | null
  summary: string | null
  tags: { id: number; name: string }[]
  coverImageUrl: string | null
  contentImageUrls: string[]
  officialChannelUrl: string | null
}
