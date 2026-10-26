import { SITE_URL } from '../../shared/utils/seo'
import { getPublicSitemap, SITEMAP_CACHE_SECONDS, SITEMAP_CHUNK_SIZE, sitemapXml } from '../utils/publicSitemap'

export default defineEventHandler(async event => {
  try {
    const data = await getPublicSitemap(useRuntimeConfig(event).apiBase)
    const remaining = Math.max(1, SITEMAP_CACHE_SECONDS - Math.floor((Date.now() - data.fetchedAt) / 1000))
    setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
    setResponseHeader(event, 'cache-control', `public, max-age=0, s-maxage=${remaining}`)
    if (data.urls.length <= SITEMAP_CHUNK_SIZE) return sitemapXml(data.urls)
    const parts = Math.ceil(data.urls.length / SITEMAP_CHUNK_SIZE)
    return '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + Array.from({ length: parts }, (_, index) => `<sitemap><loc>${SITE_URL}/sitemaps/${index + 1}.xml</loc></sitemap>`).join('\n') + '\n</sitemapindex>'
  } catch (error) {
    setResponseHeader(event, 'cache-control', 'no-store')
    setResponseHeader(event, 'retry-after', 60)
    throw error
  }
})
