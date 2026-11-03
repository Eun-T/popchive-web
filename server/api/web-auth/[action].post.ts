import { normalizeEmail, normalizeNickname, validEmail, validNickname, validPassword } from '../../../shared/utils/auth'
import { authBackend, loginWeb, logoutWeb, restoreWeb } from '../../utils/webAuth'
import { mypageAction, mypageActions } from '../../utils/mypageActions'
import { googleWebAuth } from '../../utils/googleWebAuth'
import { appleWebAuth } from '../../utils/appleWebAuth'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  setResponseHeader(event, 'Vary', 'Cookie')
  // Every cookie-authenticated operation, including restoration/rotation, is same-origin POST.
  const origin = getHeader(event, 'origin')
  if (!origin || origin !== getRequestURL(event, { xForwardedProto: true }).origin)
    throw createError({ statusCode: 403, statusMessage: 'Authentication request failed', data: { message: '허용되지 않은 요청입니다.' } })
  if (!getHeader(event, 'content-type')?.startsWith('application/json'))
    throw createError({ statusCode: 415, statusMessage: 'Authentication request failed', data: { message: 'JSON 요청이 필요합니다.' } })
  const action = getRouterParam(event, 'action')
  const bodyLimit = action === 'review-update' ? 400000 : action === 'apple' ? 40000 : action === 'google' ? 20000 : 8192
  const contentLength = Number(getHeader(event, 'content-length') || 0)
  if (contentLength > bodyLimit) throw createError({ statusCode: 413, statusMessage: 'Request too large' })
  const rawBody = await readRawBody(event) || ''
  if (new TextEncoder().encode(rawBody).length > bodyLimit) throw createError({ statusCode: 413, statusMessage: 'Request too large' })
  let raw: unknown
  try { raw = JSON.parse(rawBody) } catch { throw createError({ statusCode: 400, statusMessage: 'Invalid JSON' }) }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw createError({ statusCode: 400, statusMessage: 'Authentication request failed', data: { message: '잘못된 입력입니다.' } })
  const body = raw as Record<string, unknown>
  if (action === 'apple-start' || action === 'apple' || action === 'apple-complete' || action === 'apple-cancel') return await appleWebAuth(event, action, body)
  if (action === 'google-start' || action === 'google' || action === 'google-complete') return await googleWebAuth(event, action, body)
  if (action && mypageActions.includes(action)) return await mypageAction(event, action, body)
  if (action === 'session') return { user: await restoreWeb(event) }
  if (action === 'logout') { await logoutWeb(event); return { user: null } }
  const email = normalizeEmail(typeof body.email === 'string' ? body.email : '')
  if (!validEmail(email)) throw createError({ statusCode: 400, statusMessage: 'Authentication request failed', data: { message: '이메일 형식을 확인해 주세요.' } })
  if (action === 'send-code') { await authBackend(event, '/api/auth/email-verifications', { email }); return { sent: true } }
  if (action === 'verify-code') {
    if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) throw createError({ statusCode: 400, statusMessage: 'Authentication request failed', data: { message: '인증번호 6자리를 입력해 주세요.' } })
    return await authBackend<{ signupProof: string }>(event, '/api/auth/email-verifications/verify', { email, code: body.code })
  }
  const password = typeof body.password === 'string' ? body.password : ''
  if (action === 'login') {
    if (!password || password.length > 1024) throw createError({ statusCode: 400, statusMessage: 'Authentication request failed', data: { message: '비밀번호를 입력해 주세요.' } })
    return { user: await loginWeb(event, email, password) }
  }
  if (action === 'signup') {
    const nickname = normalizeNickname(typeof body.nickname === 'string' ? body.nickname : '')
    if (!validNickname(nickname) || !validPassword(password) || body.ageConfirmed !== true || body.termsOfService !== true || body.privacyPolicy !== true || typeof body.signupProof !== 'string' || !body.signupProof)
      throw createError({ statusCode: 400, statusMessage: 'Authentication request failed', data: { message: '입력값, 이메일 인증 및 필수 동의를 확인해 주세요.' } })
    await authBackend(event, '/api/users', { email, password, nickname, signupProof: body.signupProof, ageConfirmed: true,
      consents: { termsOfService: true, privacyPolicy: true, marketing: false } })
    return { registered: true }
  }
  throw createError({ statusCode: 404, statusMessage: 'Authentication request failed', data: { message: '지원하지 않는 요청입니다.' } })
})
