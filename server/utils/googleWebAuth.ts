import type { H3Event } from 'h3'
import { Buffer } from 'node:buffer'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { authBackend, deviceId, establishWebSession, type Tokens } from './webAuth'
import type { GoogleSignup } from '../../shared/types/auth'
import { normalizeNickname, validNickname } from '#shared/utils/auth'

const nonceCookie = 'plave_google_nonce'
const signupCookie = 'plave_google_signup'
function options(event: H3Event) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: getRequestURL(event, { xForwardedProto: true }).protocol === 'https:', path: '/' }
}
function fail(statusCode: number, message: string): never {
  throw createError({ statusCode, statusMessage: 'Google authentication failed', data: { message } })
}
function equal(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export async function googleWebAuth(event: H3Event, action: string, body: Record<string, unknown>) {
  if (!String(useRuntimeConfig(event).public.googleClientId).trim()) fail(503, 'Google 로그인 설정이 필요합니다. 이메일 로그인을 이용해 주세요.')
  if (action === 'google-start') {
    const nonce = randomBytes(32).toString('base64url')
    deviceId(event)
    setCookie(event, nonceCookie, nonce, { ...options(event), maxAge: 300 })
    deleteCookie(event, signupCookie, options(event))
    return { nonce }
  }
  const device = deviceId(event)
  if (action === 'google') {
    const expected = getCookie(event, nonceCookie)
    if (!expected || typeof body.idToken !== 'string' || body.idToken.length > 16384) fail(401, 'Google 인증 시간이 만료되었습니다. 다시 Google 로그인해 주세요.')
    let nonce: unknown
    try {
      const parts = body.idToken.split('.')
      if (parts.length !== 3) throw new Error('Invalid JWT')
      nonce = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')).nonce
    } catch { fail(401, 'Google 인증 정보를 확인할 수 없습니다. 다시 Google 로그인해 주세요.') }
    // This comparison only binds the attempt. The exact JWT must still pass Spring's
    // signature, issuer, expiry and audience verification before any session is saved.
    if (typeof nonce !== 'string' || !equal(expected, nonce)) fail(401, 'Google 로그인 요청이 일치하지 않습니다. 다시 Google 로그인해 주세요.')
    deleteCookie(event, nonceCookie, options(event))
    const result = await authBackend<Tokens | GoogleSignup>(event, '/api/auth/google', { idToken: body.idToken, deviceId: device })
    if (!result || typeof result !== 'object') fail(502, 'Google 로그인 응답을 확인하지 못했습니다.')
    if ('status' in result && result.status === 'SIGNUP_REQUIRED') {
      if (typeof result.signupToken !== 'string' || !result.signupToken || result.signupToken.length > 4096 || !Number.isFinite(result.expiresInSeconds) || result.expiresInSeconds <= 0) fail(502, 'Google 가입 응답을 확인하지 못했습니다.')
      const seconds = Math.min(result.expiresInSeconds, 600)
      setCookie(event, signupCookie, hash(`${device}:${result.signupToken}`), { ...options(event), maxAge: seconds })
      return { status: 'SIGNUP_REQUIRED', signupToken: result.signupToken, expiresInSeconds: seconds }
    }
    return { user: await establishWebSession(event, result as Tokens, device) }
  }
  if (action === 'google-complete') {
    const binding = getCookie(event, signupCookie)
    if (!binding || typeof body.signupToken !== 'string' || body.signupToken.length > 4096 || !equal(binding, hash(`${device}:${body.signupToken}`))) fail(401, '가입 인증이 만료되었습니다. 다시 Google 로그인해 주세요.')
    const nickname = normalizeNickname(typeof body.nickname === 'string' ? body.nickname : '')
    if (!validNickname(nickname)) fail(400, '닉네임은 문자·숫자·밑줄 2~10자로 입력해 주세요.')
    if (body.ageConfirmed !== true || body.termsOfService !== true || body.privacyPolicy !== true) fail(400, '만 14세 이상 확인과 필수 약관 동의를 완료해 주세요.')
    const tokens = await authBackend<Tokens>(event, '/api/auth/google/complete', {
      signupToken: body.signupToken, nickname, deviceId: device, ageConfirmed: true,
      consents: { termsOfService: true, privacyPolicy: true, marketing: false },
    })
    deleteCookie(event, signupCookie, options(event))
    return { user: await establishWebSession(event, tokens, device) }
  }
  fail(404, '지원하지 않는 요청입니다.')
}
