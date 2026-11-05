import { canonicalUrl, publicPopupId } from '../../shared/utils/seo'
import { venuePath } from '../../shared/utils/venueRoutes'
import { endingSoonToday } from '../../shared/utils/endingSoon'
import { getPlacesVenues } from './placesVenues'

export const SITEMAP_CACHE_SECONDS = 300
export const SITEMAP_CHUNK_SIZE = 10_000
export const getPublicSitemap = defineCachedFunction(async (apiBase: string) => {
  let response: unknown
  let venuePaths: string[]
  try {
    // No limit/status/country: existing list mode returns ALL public popup rows, including ended ones.
    const [popups, venues] = await Promise.all([
      $fetch<unknown>('/api/popups', {
        baseURL: apiBase, query: { languageCode: 'ko' }, method: 'GET', headers: { accept: 'application/json' },
        credentials: 'omit', redirect: 'error', timeout: 15_000, retry: 0,
      }),
      // Share the existing public venue cache; never fetch every venue's popup list here.
      getPlacesVenues(apiBase, endingSoonToday()),
    ])
    response = popups
    venuePaths = venues.venues.map(venue => venuePath(venue.venueId)).sort()
  } catch { throw createError({ statusCode: 503, statusMessage: 'Sitemap source unavailable' }) }
  if (!response || typeof response !== 'object' || Object.keys(response).length !== 1
    || !('popups' in response) || !Array.isArray(response.popups)) {
    throw createError({ statusCode: 503, statusMessage: 'Sitemap requires the complete public list' })
  }
  const ids = new Set<string>()
  for (const row of response.popups) {
    if (!row || typeof row !== 'object' || !('publicId' in row) || !publicPopupId(row.publicId)) {
      throw createError({ statusCode: 503, statusMessage: 'Invalid public sitemap source' })
    }
    ids.add(row.publicId)
  }
  const urls = [...new Set([
    '/', '/places', '/map', ...[...ids].sort().map(id => `/places/${id}`), ...venuePaths,
  ].map(path => canonicalUrl(path)))]
  if (Math.ceil(urls.length / SITEMAP_CHUNK_SIZE) > 50_000) {
    throw createError({ statusCode: 503, statusMessage: 'Sitemap source exceeds index capacity' })
  }
  return { urls, fetchedAt: Date.now() }
}, { name: 'public-sitemap-theplave-v4', maxAge: SITEMAP_CACHE_SECONDS, swr: false })

export function sitemapXml(urls: string[]): string {
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(url => `<url><loc>${escape(url)}</loc></url>`).join('\n') + '\n</urlset>'
}
