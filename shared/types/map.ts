// Optional presentation fields already provided by the backend map DTO.
export type MapPopup = {
  id: string // places.public_id, confirmed in PublicPopupMapper.xml
  name: string
  latitude: number
  longitude: number
  coverImageUrl?: string | null
  startDate?: string | null
  endDate?: string | null
  primaryTag?: string | null
}

export type PopupMapResponse = { popups: MapPopup[] }

export type SeoulMapAreaId = 'hongdae' | 'yongsan' | 'yeongdeungpo' | 'seongsu' | 'gangnam' | 'jamsil'
export type SeoulMapArea = {
  id: SeoulMapAreaId
  name: string
  count: number
  latitude: number | null
  longitude: number | null
}

export type AvailablePopupStats = { KR: number; JP: number; totalCount: number }

// Full Seoul public list, including ongoing/upcoming popups without coordinates.
export type SeoulMapPreviewResponse = PopupMapResponse & {
  totalCount: number
  popupStats: AvailablePopupStats // All eligible KR + JP popups, independent of the Seoul map count
  areas: SeoulMapArea[]
  otherCount: number
  asOf: string // Asia/Seoul calendar date used to exclude ended popups
}
