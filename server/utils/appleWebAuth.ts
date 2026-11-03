import type { H3Event } from 'h3'
import { Buffer } from 'node:buffer'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { appleAuthCommand } from './appleAuthStore'
import { authBackend, deviceId, establishWebSession, type Tokens } from './webAuth'
import { normalizeNickname, validNickname } from '../../shared/utils/auth'

const sessionCookie = '__Host-plave_apple_attempt'
const signupCookie = '__Host-plave_apple_signup'
const cookieOptions = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/' }
const random = () => randomBytes(32).toString('base64url')
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)
function equal(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
function fail(statusCode: number, message: string): never {
  throw createError({ statusCode, statusMessage: 'Apple authentication failed', data: { message } })
}
interface Attempt { stateHash: string; challengeId: string; nonce: string; device: string; returnTo: '/' | '/mypage'; expiresAt: number }
interface SignupAttempt { signupToken: string; device: string; returnTo: '/' | '/mypage'; expiresAt: number }
function key(session: string, kind: string, id: string) { return `plave:apple:v1:${hash(session)}:${kind}:${hash(id)}` }
async function save(event: H3Event, key: string, value: object, seconds: number) {
  if (await appleAuthCommand(event, ['SET', key, JSON.stringify(value), 'EX', seconds, 'NX']) !== 'OK')
    fail(503, 'Apple 인증을 시작하지 못했습니다. 다시 시도해 주세요.')
}
async function consume<T>(event: H3Event, key: string): Promise<T> {
  const raw = await appleAuthCommand(event, ['GETDEL', key])
  if (typeof raw !== 'string') fail(401, 'Apple 인증이 만료되었거나 이미 사용되었습니다. 다시 Apple 로그인해 주세요.')
  try { return JSON.parse(raw) as T } catch { fail(401, 'Apple 인증을 다시 시작해 주세요.') }
}
function configuration(event: H3Event) {
  const config = useRuntimeConfig(event)
  const clientId = String(config.public.appleClientId).trim()
  const redirectURI = String(config.appleWebRedirectUri)
  const request = getRequestURL(event, { xForwardedProto: true })
  try {
    const url = new URL(redirectURI)
    // Only the fixed, configured same-origin popup Return URL. Never derive it from input/Host.
    if (!/^[A-Za-z0-9][A-Za-z0-9.-]{0,254}$/.test(clientId) || url.protocol !== 'https:'
      || url.origin !== request.origin || url.pathname !== '/api/web-auth/apple-return'
      || url.search || url.hash || url.username || url.password || url.href !== redirectURI
      || !config.appleAuthRedisUrl || !config.appleAuthRedisToken) throw new Error()
  } catch { fail(503, 'Apple 로그인 HTTPS 주소와 서버 설정이 필요합니다. 이메일 로그인을 이용해 주세요.') }
  return { clientId, redirectURI }
}
export async function appleWebAuth(event: H3Event, action: string, body: Record<string, unknown>) {
  const config = configuration(event)
  let session = getCookie(event, sessionCookie)
  if (action === 'apple-start') {
    if (!validId(session)) session = random()
    setCookie(event, sessionCookie, session, { ...cookieOptions, maxAge: 3600 })
    const device = deviceId(event)
    const challenge = await authBackend<{ challengeId: string; nonce: string; expiresInSeconds: number }>(event, '/api/auth/apple/challenge', undefined, undefined, 'POST')
    if (!validId(challenge?.challengeId) || !validId(challenge?.nonce) || !Number.isFinite(challenge.expiresInSeconds) || challenge.expiresInSeconds < 1)
      fail(502, 'Apple 인증 요청을 준비하지 못했습니다.')
    const seconds = Math.min(300, Math.floor(challenge.expiresInSeconds))
    const state = random()
    const attempt: Attempt = { stateHash: hash(state), challengeId: challenge.challengeId, nonce: challenge.nonce,
      device, returnTo: body.returnTo === '/mypage' ? '/mypage' : '/', expiresAt: Date.now() + seconds * 1000 }
    await save(event, key(session, 'login', state), attempt, seconds)
    return { ...config, state, nonce: challenge.nonce, expiresInSeconds: seconds }
  }
  if (!validId(session)) fail(401, 'Apple 인증 세션이 만료되었습니다. 다시 Apple 로그인해 주세요.')
  // Do not create a replacement device when finishing an attempt.
  const device = getCookie(event, 'plave_device')
  if (!device) fail(401, 'Apple 인증 세션을 다시 시작해 주세요.')
  if (action === 'apple-cancel') {
    if (validId(body.state)) await appleAuthCommand(event, ['DEL', key(session, 'login', body.state)])
    const signup = getCookie(event, signupCookie)
    if (validId(signup)) await appleAuthCommand(event, ['DEL', key(session, 'signup', signup)])
    deleteCookie(event, signupCookie, cookieOptions)
    return { cancelled: true }
  }
  if (action === 'apple') {
    if (!validId(body.state)) fail(401, 'Apple 로그인 요청이 일치하지 않습니다. 다시 시도해 주세요.')
    const attempt = await consume<Attempt>(event, key(session, 'login', body.state))
    if (attempt.expiresAt <= Date.now() || !equal(attempt.stateHash, hash(body.state)) || !equal(attempt.device, device))
      fail(401, 'Apple 로그인 요청이 일치하지 않거나 만료되었습니다. 다시 시도해 주세요.')
    if (typeof body.identityToken !== 'string' || !body.identityToken || body.identityToken.length > 16384
      || typeof body.authorizationCode !== 'string' || !body.authorizationCode.trim() || body.authorizationCode.length > 16384)
      fail(400, 'Apple 인증 토큰 또는 인증 코드를 받지 못했습니다. 다시 Apple 로그인해 주세요.')
    let nonce: unknown
    try {
      const parts = body.identityToken.split('.')
      if (parts.length !== 3) throw new Error()
      nonce = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')).nonce
    } catch { fail(401, 'Apple 인증 정보를 확인할 수 없습니다. 다시 Apple 로그인해 주세요.') }
    if (typeof nonce !== 'string' || !equal(attempt.nonce, nonce)) fail(401, 'Apple 인증 요청이 일치하지 않습니다. 다시 시도해 주세요.')
    // Decoding above only binds this attempt. Spring MUST verify the same original JWT.
    const result = await authBackend<Tokens | { status: string; signupToken: string; expiresInSeconds: number }>(event, '/api/auth/apple', {
      identityToken: body.identityToken, authorizationCode: body.authorizationCode, challengeId: attempt.challengeId, deviceId: attempt.device,
    })
    if (!result || typeof result !== 'object') fail(502, 'Apple 인증 응답을 확인하지 못했습니다.')
    if ('status' in result) {
      if (result.status !== 'SIGNUP_REQUIRED' || typeof result.signupToken !== 'string' || !result.signupToken || result.signupToken.length > 4096
        || !Number.isFinite(result.expiresInSeconds) || result.expiresInSeconds < 1) fail(502, 'Apple 가입 응답을 확인하지 못했습니다.')
      const seconds = Math.min(600, Math.floor(result.expiresInSeconds))
      const signupId = random()
      const signup: SignupAttempt = { signupToken: result.signupToken, device: attempt.device, returnTo: attempt.returnTo, expiresAt: Date.now() + seconds * 1000 }
      await save(event, key(session, 'signup', signupId), signup, seconds)
      setCookie(event, signupCookie, signupId, { ...cookieOptions, maxAge: seconds })
      // The actual signupToken remains server-side, not in browser memory or URLs.
      return { status: 'SIGNUP_REQUIRED', expiresInSeconds: seconds }
    }
    return { user: await establishWebSession(event, result, attempt.device), returnTo: attempt.returnTo }
  }
  if (action === 'apple-complete') {
    const nickname = normalizeNickname(typeof body.nickname === 'string' ? body.nickname : '')
    if (!validNickname(nickname)) fail(400, '닉네임은 문자·숫자·밑줄 2~10자로 입력해 주세요.')
    if (body.ageConfirmed !== true || body.termsOfService !== true || body.privacyPolicy !== true)
      fail(400, '만 14세 이상 확인과 필수 약관 동의를 완료해 주세요.')
    const id = getCookie(event, signupCookie)
    if (!validId(id)) fail(401, '가입 인증이 만료되었습니다. 다시 Apple 로그인해 주세요.')
    const signupKey = key(session, 'signup', id)
    const signup = await consume<SignupAttempt>(event, signupKey)
    if (signup.expiresAt <= Date.now() || !equal(signup.device, device)) fail(401, '가입 인증이 만료되었습니다. 다시 Apple 로그인해 주세요.')
    let tokens: Tokens
    try {
      tokens = await authBackend<Tokens>(event, '/api/auth/apple/complete', {
        signupToken: signup.signupToken, nickname, deviceId: signup.device, ageConfirmed: true,
        consents: { termsOfService: true, privacyPolicy: true, marketing: false },
      })
    } catch (error) {
      // Spring rolls back validation/conflict failures. Allow correction, but never
      // replay a completion with an uncertain network/5xx outcome.
      const status = (error as { statusCode?: number }).statusCode
      const seconds = Math.floor((signup.expiresAt - Date.now()) / 1000)
      if ((status === 400 || status === 409) && seconds > 0) await save(event, signupKey, signup, seconds)
      else deleteCookie(event, signupCookie, cookieOptions)
      throw error
    }
    deleteCookie(event, signupCookie, cookieOptions)
    return { user: await establishWebSession(event, tokens, signup.device), returnTo: signup.returnTo }
  }
  fail(404, '지원하지 않는 요청입니다.')
}
