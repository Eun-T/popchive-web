import { restoreWeb } from '../utils/webAuth'

export default defineEventHandler(async event => {
  if (!/^\/mypage\/?$/.test(getRequestURL(event).pathname)) return
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  setResponseHeader(event, 'Vary', 'Cookie')
  // Restore on the document response so refresh Set-Cookie reaches the browser.
  try { event.context.mypageAuth = { user: await restoreWeb(event) } }
  catch { event.context.mypageAuth = { unavailable: true } }
})
