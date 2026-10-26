import type { PopupDetail } from '../types/popup'

export const SITE_URL = 'https://popchive.com'
export const SITE_NAME = '팝카이브 (POPCHIVE)'
export const PAGE_SEO = {
  '/': {
    title: '팝카이브 - 글로벌 팝업스토어 정보',
    description: '한국과 일본의 팝업스토어 정보를 한곳에서 만나보세요. 지금 인기 있는 팝업부터 새롭게 열리는 팝업까지 팝카이브에서 확인하세요.',
  },
  '/places': {
    title: '팝업스토어 찾기 | 팝카이브',
    description: '성수, 홍대, 강남, 도쿄 등 한국과 일본의 다양한 팝업스토어를 지역과 관심 분야별로 탐색해 보세요.',
  },
  '/map': {
    title: '팝업스토어 지도 | 팝카이브',
    description: '지도에서 주변 팝업스토어의 위치와 운영 정보를 확인하고 방문하고 싶은 팝업을 찾아보세요.',
  },
} as const
export function publicPopupId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value) && !/^(place-mock-|japan-mock-)/.test(value)
}
export function normalizedSeoPath(path: string): string { return path.split(/[?#]/)[0]!.replace(/\/+$/, '') || '/' }
export function isPublicSeoPath(path: string): boolean {
  const normalized = normalizedSeoPath(path)
  if (normalized in PAGE_SEO) return true
  return normalized.startsWith('/places/') && publicPopupId(normalized.slice('/places/'.length))
}
export function canonicalUrl(path: string): string { return `${SITE_URL}${normalizedSeoPath(path)}` }
export function isProductionSeoHost(hostname: string, vercelEnv?: string, netlifyContext?: string): boolean {
  return !['preview', 'development'].includes(vercelEnv ?? '')
    && !['deploy-preview', 'branch-deploy', 'dev'].includes(netlifyContext ?? '')
    && ['popchive.com', 'www.popchive.com'].includes(hostname.toLowerCase())
}
export function seoImageUrl(value: string | null | undefined): string | undefined {
  if (!value || (!/^https?:\/\//i.test(value) && !value.startsWith('/'))) return undefined
  try {
    const url = new URL(value, SITE_URL)
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) return undefined
    url.hash = ''
    return url.href
  } catch { return undefined }
}
export function plainSeoText(value: string): string {
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…' }
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|ndash|mdash|hellip);/gi, (original, entity: string) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? original
    const code = entity.toLowerCase().startsWith('#x') ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : ''
  }).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
}
export function popupSeoDescription(popup: PopupDetail): string {
  const summary = plainSeoText(popup.summary ?? '')
  const name = popup.name.replace(/\s+/g, ' ').trim()
  const parts = summary.includes(name) ? [summary] : [name + '.', summary]
  const location = plainSeoText(popup.regionName || popup.address || '')
  if (location && !parts.join(' ').includes(location)) parts.push(`${location}의 팝업스토어 정보를 확인하세요.`)
  const period = [popup.startDate, popup.endDate].filter(Boolean).map(value => value!.replaceAll('-', '.')).join(' ~ ')
  if (period && !summary.includes(popup.startDate?.slice(0, 4) || popup.endDate!.slice(0, 4))) parts.push(`운영 기간: ${period}.`)
  if (!summary && !location && !period) parts.push('팝업스토어의 운영 정보와 방문 정보를 팝카이브에서 확인하세요.')
  const description = parts.filter(Boolean).join(' ')
  return Array.from(description).length > 160 ? Array.from(description).slice(0, 159).join('') + '…' : description
}
