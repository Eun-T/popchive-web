const MOBILE_HOST = 'm.blog.naver.com'
const IMAGE_HOSTS = new Set(['mblogthumb-phinf.pstatic.net'])
const MAX_BYTES = 1024 * 1024
let activeRequests = 0

// Narrow built-in module boundaries: this project does not install @types/node.
// Non-literal dynamic imports keep this utility independent of those ambient types.
type Address = { address: string; family: number }
type Incoming = {
  statusCode?: number
  headers: Record<string, string | string[] | undefined>
  on(name: 'data', listener: (chunk: Uint8Array) => void): Incoming
  on(name: 'end' | 'error' | 'aborted', listener: () => void): Incoming
  destroy(): void
}
type Request = { on(name: 'error', listener: () => void): Request; end(): void; destroy(): void }
type Https = {
  request(options: {
    hostname: string; servername: string; port: number; path: string; method: string; agent: false
    autoSelectFamily: false
    headers: Record<string, string>
    lookup: (hostname: string, options: { all?: boolean }, callback: (error: Error | null, address: string | Address[], family?: number) => void) => void
  }, listener: (response: Incoming) => void): Request
}

// Fail closed on IPv6 (including mapped IPv4), non-canonical IPv4, and all
// private/special-use ranges. IPv6-only deployments fall back to text cards.
function isPublicIPv4(address: string): boolean {
  const parts = address.split('.')
  if (parts.length !== 4 || parts.some(p => !/^(0|[1-9]\d{0,2})$/.test(p) || Number(p) > 255)) return false
  const [a, b, c] = parts.map(Number) as [number, number, number, number]
  return !(a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99)))
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    || (a === 203 && b === 0 && c === 113) || address === '168.63.129.16')
}

function mobilePostUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !['blog.naver.com', MOBILE_HOST].includes(url.hostname)
      || url.username || url.password || url.port || url.search || url.hash
      || !/^\/[a-zA-Z0-9_-]+\/\d+$/.test(url.pathname)) return null
    return new URL(`https://${MOBILE_HOST}${url.pathname}`)
  } catch { return null }
}

function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = Object.create(null)
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
    const key = match[1]!.toLowerCase()
    if (!(key in result)) result[key] = match[2] ?? match[3] ?? match[4] ?? ''
  }
  return result
}

function firstBodyImage(html: string): string | null {
  // Tokenize only static tags. Skip comments/raw-text contents, never execute HTML.
  // This intentionally supports the verified SmartEditor body, not arbitrary images.
  const tokens = /<!--[\s\S]*?-->|<(script|style|textarea|title)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/?([a-z][\w:-]*)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi
  let bodyDepth = 0
  for (const match of html.matchAll(tokens)) {
    const name = match[2]?.toLowerCase()
    if (!name) continue
    const tag = match[0], closing = tag.startsWith('</')
    if (name === 'div') {
      if (closing) bodyDepth = Math.max(0, bodyDepth - 1)
      else if (bodyDepth) bodyDepth++
      else if (attributes(tag).class?.split(/\s+/).includes('se-main-container')) bodyDepth = 1
    }
    if (!bodyDepth || name !== 'img' || closing) continue
    const attrs = attributes(tag)
    if (!attrs.class?.split(/\s+/).includes('se-image-resource')) continue
    const source = attrs['data-lazy-src'] || attrs['data-src'] || attrs.src
    if (!source) return null
    const decoded = source.replace(/&amp;/gi, '&').replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_, hex, decimal) => {
      const point = hex ? parseInt(hex, 16) : Number(decimal)
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : ''
    })
    try {
      const url = new URL(decoded)
      return url.protocol === 'https:' && IMAGE_HOSTS.has(url.hostname) && !url.username && !url.password
        && !url.port && !url.hash ? url.href : null
    } catch { return null }
  }
  return null
}

async function requestThumbnail(url: URL): Promise<string | null> {
  return new Promise(resolve => {
    let settled = false, request: Request | undefined, response: Incoming | undefined
    const finish = (value: string | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      request?.destroy()
      response?.destroy()
      resolve(value)
    }
    // Includes module loading, DNS, connection, and the complete body transfer.
    const timer = setTimeout(() => finish(null), 2000)
    void (async () => {
      const dnsModule: string = 'node:dns/promises', httpsModule: string = 'node:https'
      const [dns, https] = await Promise.all([
        import(dnsModule) as Promise<{ lookup(host: string, options: { all: true }): Promise<Address[]> }>,
        import(httpsModule) as Promise<Https>,
      ])
      const addresses = await dns.lookup(MOBILE_HOST, { all: true })
      if (settled) return
      if (!addresses.length || addresses.some(a => a.family !== 4 || !isPublicIPv4(a.address))) return finish(null)
      const pinned = addresses[0]!
      request = https.request({
        hostname: MOBILE_HOST, servername: MOBILE_HOST, port: 443, method: 'GET', path: url.pathname,
        agent: false, autoSelectFamily: false,
        // Connect only to the validated IP; retain hostname/SNI/certificate checks.
        lookup: (_host, options, callback) => callback(null, options.all ? [pinned] : pinned.address, 4),
        headers: { accept: 'text/html', 'accept-encoding': 'identity', 'user-agent': 'POPCHIVE-LinkPreview/1.0' },
      }, incoming => {
        response = incoming
        const type = incoming.headers['content-type']
        const encoding = incoming.headers['content-encoding']
        const length = incoming.headers['content-length']
        // No redirect following, compression expansion, cookies, or API credentials.
        if (incoming.statusCode !== 200 || typeof type !== 'string' || !/^text\/html(?:;|$)/i.test(type)
          || (encoding && encoding !== 'identity') || (length && Number(length) > MAX_BYTES)) return finish(null)
        const decoder = new TextDecoder('utf-8', { fatal: true })
        let bytes = 0, html = ''
        incoming.on('data', chunk => {
          if (settled) return
          bytes += chunk.byteLength
          if (bytes > MAX_BYTES) return finish(null)
          try { html += decoder.decode(chunk, { stream: true }) } catch { finish(null) }
        })
        incoming.on('end', () => {
          if (settled) return
          try { finish(firstBodyImage(html + decoder.decode())) } catch { finish(null) }
        })
        incoming.on('error', () => finish(null))
        incoming.on('aborted', () => finish(null))
      })
      request.on('error', () => finish(null))
      request.end()
    })().catch(() => finish(null))
  })
}

export async function getBlogReviewThumbnail(postUrl: string): Promise<string | null> {
  const url = mobilePostUrl(postUrl)
  // Global per-process cap. Saturation falls back immediately instead of queuing.
  if (!url || activeRequests >= 3) return null
  activeRequests++
  try { return await requestThumbnail(url) } catch { return null } finally { activeRequests-- }
}
