import { env } from 'std-env'
import { isProductionSeoHost, isPublicSeoPath } from '../../shared/utils/seo'

export default defineEventHandler(event => {
  const url = getRequestURL(event, { xForwardedHost: false })
  // Netlify CONTEXT may be build-only; the production-host allowlist remains mandatory.
  event.context.seoProduction = isProductionSeoHost(url.hostname, env.VERCEL_ENV, env.CONTEXT)
  // Keep host context for robots.txt, but leave crawler-file headers to their routes.
  if (url.pathname === '/sitemap.xml' || url.pathname.startsWith('/sitemaps/') || url.pathname === '/robots.txt') return
  if (!event.context.seoProduction || !isPublicSeoPath(url.pathname)) {
    setResponseHeader(event, 'x-robots-tag', 'noindex, nofollow')
  }
})
