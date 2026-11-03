// Popup mode is completed by Apple JS and a same-origin JSON POST to /apple.
// This fixed Return URL never accepts external form_post credentials or cookies.
// Do not relax [action].post.ts's Origin policy to support a redirect fallback.
export default defineEventHandler(event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer')
  setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  throw createError({ statusCode: 400, statusMessage: 'Apple popup required',
    data: { message: '로그인 화면에서 Apple 팝업 로그인을 다시 시작해 주세요.' } })
})
