export type HomeSection = 'main-banners' | 'new-popups' | 'now-hot' | 'japan-new-popups'

// Existing carousel/card props, adapted from the public backend DTO.
export type HomePopupCard = {
  id: string
  publicId: string
  src: string | null
  alt: string
  title: string
  heroTitle?: string | null
  period: string
  region: string
  width?: number
  height?: number
}

export type HomeSectionResponse = {
  items: HomePopupCard[]
  fetchedAt: number
}
