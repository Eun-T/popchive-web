export type PopupRecommendationKind = 'nearby' | 'similar'

// NearbyPopupRows / SimilarPopupRows: country is inherited from the origin popup.
export interface RecommendedPopup {
  publicId: string
  name: string
  coverImageUrl: string | null
  startDate: string | null
  endDate: string | null
  regionName: string | null
  tags: { id: number; name: string }[]
  distanceMeters?: number
  matchedTagCount?: number
}

export interface PopupRecommendationsResponse { popups: RecommendedPopup[] }
