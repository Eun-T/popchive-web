import type { H3Event } from 'h3'
import type { PopupDetail } from '../../shared/types/popup'
import type { BlogReview, BlogReviewsResponse } from '../../shared/types/blogReviews'
import { getBlogReviewThumbnail } from './blogReviewThumbnails'

// Deliberately limited decoding, without a new dependency. Unknown named entities
// remain literal text. Output is never HTML and must only be rendered as text.
function plainText(value: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    middot: '·', ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  }
  return value.slice(0, 20_000).replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (!code.startsWith('#')) return named[code] ?? entity
      const point = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1))
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point) : ' '
    }).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalized(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

function searchTerms(popup: PopupDetail) {
  const name = plainText(popup.name)
  // Generic words alone cannot identify a popup. Require every remaining name
  // token, plus a location match, rather than filling the list with weak hits.
  const generic = /^(?:팝업스토어|팝업|스토어|popup|pop|up|store|서울|일본|한국|한정|기간|오픈|전시)$/i
  const names = name.normalize('NFKC').split(/[^\p{L}\p{N}]+/u)
    .filter(word => !generic.test(word)).map(normalized).filter(word => word.length >= 2)
  const region = plainText(popup.regionName ?? '')
  const venue = plainText(popup.locationDetail ?? '')
  const address = plainText(popup.address ?? '')
  const places = [region, venue, address].flatMap(value => value.split(/[^\p{L}\p{N}]+/u))
    .filter(word => !/^(?:대한민국|한국|일본|서울|서울시|서울특별시|KR|JP|층|지하|\d+|\d+층|\d+번지|\d+호)$/i.test(word))
    .map(normalized).filter(word => word.length >= 2)
  // Send the original API title unchanged; normalized terms are only for filtering.
  return { names: [...new Set(names)], places: [...new Set(places)], query: popup.name }
}

function cleanItem(value: unknown, terms: ReturnType<typeof searchTerms>): BlogReview | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.title !== 'string' || typeof row.description !== 'string'
    || typeof row.link !== 'string' || typeof row.postdate !== 'string') return null
  const title = plainText(row.title), description = plainText(row.description)
  const content = normalized(`${title} ${description}`)
  if (!title || !terms.names.length || !terms.places.length
    || !terms.names.every(word => content.includes(word))
    || !terms.places.some(word => content.includes(word))) return null
  try {
    const url = new URL(row.link)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port
      || !['blog.naver.com', 'm.blog.naver.com'].includes(url.hostname)) return null
    url.protocol = 'https:'
    url.hostname = 'blog.naver.com'
    url.hash = ''
    // Canonicalize the two common post URL forms and discard tracking parameters.
    const path = url.pathname.match(/^\/([a-zA-Z0-9_-]+)\/(\d+)\/?$/)
    const blogId = path?.[1] ?? url.searchParams.get('blogId')
    const logNo = path?.[2] ?? url.searchParams.get('logNo')
    if (!blogId || !/^[a-zA-Z0-9_-]+$/.test(blogId) || !logNo || !/^\d+$/.test(logNo)) return null
    url.pathname = `/${blogId}/${logNo}`
    url.search = ''
    if (!/^\d{8}$/.test(row.postdate)) return null
    const publishedAt = `${row.postdate.slice(0, 4)}-${row.postdate.slice(4, 6)}-${row.postdate.slice(6, 8)}`
    const timestamp = Date.parse(publishedAt)
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== publishedAt) return null
    return { title, description, publishedAt, url: url.href, thumbnailUrl: null }
  } catch { return null }
}

// Short failure cooldown is separate from the successful one-hour Nitro cache.
// Both cooldown and concurrent-request deduplication are bounded per instance.
const failures = new Map<string, number>()
const pending = new Map<string, Promise<BlogReviewsResponse>>()
const cachedReviews = defineCachedFunction(async (event: H3Event, publicId: string): Promise<BlogReviewsResponse> => {
  const popup = await event.$fetch<PopupDetail>(`/api/popups/${encodeURIComponent(publicId)}`)
  const terms = searchTerms(popup)
  if (!terms.names.length || !terms.places.length) return { items: [] }
  const config = useRuntimeConfig(event)
  const response = await $fetch<{ items?: unknown }>('https://naverapihub.apigw.ntruss.com/search/v1/blog', {
    responseType: 'json',
    query: { query: terms.query, display: 30, start: 1, sort: 'sim', format: 'json' },
    headers: { 'X-NCP-APIGW-API-KEY-ID': config.naverClientId, 'X-NCP-APIGW-API-KEY': config.naverClientSecret },
    credentials: 'omit', redirect: 'error', timeout: 5000, retry: 0,
  }).catch(() => { throw new Error('Blog search unavailable') })
  if (!response || !Array.isArray(response.items)) throw new Error('Invalid blog search response')
  const items: BlogReview[] = []
  const seen = new Set<string>()
  for (const value of response.items) {
    const item = cleanItem(value, terms)
    if (!item || seen.has(item.url)) continue
    seen.add(item.url)
    items.push(item)
    if (items.length === 3) break
  }
  await Promise.all(items.map(async item => {
    try { item.thumbnailUrl = await getBlogReviewThumbnail(item.url) } catch { item.thumbnailUrl = null }
  }))
  return { items }
}, {
  name: 'popup-blog-reviews-v3', maxAge: 3600, swr: false,
  getKey: (event: H3Event, publicId: string) => `${encodeURIComponent(useRuntimeConfig(event).apiBase)}:${publicId}:ko`,
})

export async function getBlogReviews(event: H3Event, publicId: string): Promise<BlogReviewsResponse> {
  const config = useRuntimeConfig(event)
  if (!config.naverClientId || !config.naverClientSecret) return { items: [] }
  const key = `${config.apiBase}:${publicId}`
  if ((failures.get(key) ?? 0) > Date.now()) return { items: [] }
  const existing = pending.get(key)
  if (existing) return existing
  if (pending.size >= 200) return { items: [] }
  const request = cachedReviews(event, publicId).catch(() => {
    if (failures.size >= 200) failures.delete(failures.keys().next().value!)
    failures.set(key, Date.now() + 60_000)
    return { items: [] }
  }).finally(() => { pending.delete(key) })
  pending.set(key, request)
  return request
}
