export type BlogReview = {
  title: string
  description: string
  publishedAt: string
  url: string
  thumbnailUrl: string | null
}

export type BlogReviewsResponse = { items: BlogReview[] }
