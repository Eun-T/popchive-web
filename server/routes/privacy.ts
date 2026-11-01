import html from '../../public/privacy.html'

// Serve the standalone document without the application layout or global CSS.
export default defineEventHandler(event => {
  assertMethod(event, ['GET', 'HEAD'])
  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
  return html
})
