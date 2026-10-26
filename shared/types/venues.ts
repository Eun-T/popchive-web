export type PopupVenue = {
  venueId: string
  name: string
  address: string
  countryCode: 'KR' | 'JP'
  popupCount: number
  imageUrl: string | null
}

export type VenuePopup = {
  publicId: string
  name: string
  startDate: string
  endDate: string | null
  coverImageUrl: string | null
}

export type PopupVenuesResponse = { venues: PopupVenue[]; asOf: string; fetchedAt: number }
export type VenuePopupsResponse = {
  venueId: string
  popupCount: number
  popups: VenuePopup[]
  asOf: string
  fetchedAt: number
}
