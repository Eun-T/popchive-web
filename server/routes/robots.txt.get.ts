import { SITE_URL } from '../../shared/utils/seo'

export default defineEventHandler(event => {
  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'no-store')
  // Let crawlers read page-level noindex; do not replace noindex with Disallow.
  return `User-agent: *\nAllow: /\n${event.context.seoProduction ? `Sitemap: ${SITE_URL}/sitemap.xml\n` : ''}`
})
