import { getBlogReviews } from '../utils/blogReviews'
import type { BlogReviewsResponse } from '../../shared/types/blogReviews'

export default defineEventHandler(async (event): Promise<BlogReviewsResponse> => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const { publicId } = getQuery(event)
  if (typeof publicId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(publicId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid popup ID' })
  }
  return getBlogReviews(event, publicId)
})
