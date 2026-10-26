import { getPublicSitemap, SITEMAP_CACHE_SECONDS, SITEMAP_CHUNK_SIZE, sitemapXml } from '../../utils/publicSitemap'

export default defineEventHandler(async event => {
  const part = getRouterParam(event, 'part') ?? ''
  if (!/^[1-9]\d{0,4}\.xml$/.test(part)) throw createError({ statusCode: 404, statusMessage: 'Sitemap part not found' })
  try {
    const data = await getPublicSitemap(useRuntimeConfig(event).apiBase)
    const start = (Number(part.slice(0, -4)) - 1) * SITEMAP_CHUNK_SIZE
    if (start >= data.urls.length) throw createError({ statusCode: 404, statusMessage: 'Sitemap part not found' })
    const remaining = Math.max(1, SITEMAP_CACHE_SECONDS - Math.floor((Date.now() - data.fetchedAt) / 1000))
    setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
    setResponseHeader(event, 'cache-control', `public, max-age=0, s-maxage=${remaining}`)
    return sitemapXml(data.urls.slice(start, start + SITEMAP_CHUNK_SIZE))
  } catch (error) {
    setResponseHeader(event, 'cache-control', 'no-store')
    setResponseHeader(event, 'retry-after', 60)
    throw error
  }
})
