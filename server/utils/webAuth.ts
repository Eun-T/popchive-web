import type { H3Event } from 'h3'
import { randomUUID } from 'node:crypto'
import { setTimeout } from 'node:timers'
import type { AuthUser } from '../../shared/types/auth'

export interface Tokens { accessToken: string; refreshToken: string; accessExpiresInSeconds: number; refreshExpiresInSeconds: number; deviceId: string }
const names = { access: 'plave_access', refresh: 'plave_refresh', device: 'plave_device' }
function options(event: H3Event) {
  return { httpOnly: true, secure: getRequestURL(event, { xForwardedProto: true }).protocol === 'https:', sameSite: 'lax' as const, path: '/' }
}
export function clearAuth(event: H3Event) {
  deleteCookie(event, names.access, options(event))
  deleteCookie(event, names.refresh, options(event))
}
export function deviceId(event: H3Event) {
  const saved = getCookie(event, names.device)
  const id = saved && /^[a-f0-9-]{36}$/.test(saved) ? saved : randomUUID()
  setCookie(event, names.device, id, { ...options(event), maxAge: 365 * 86400 })
  return id
}
function validateTokens(tokens: Tokens, device: string) {
  if (!tokens || typeof tokens.accessToken !== 'string' || !tokens.accessToken || tokens.accessToken.length > 3500
    || typeof tokens.refreshToken !== 'string' || !tokens.refreshToken || tokens.refreshToken.length > 3500
    || tokens.deviceId !== device || !Number.isFinite(tokens.refreshExpiresInSeconds) || tokens.refreshExpiresInSeconds <= 0) {
    throw createError({ statusCode: 502, statusMessage: 'Authentication request failed', data: { message: '인증 응답을 확인할 수 없습니다.' } })
  }
}
function save(event: H3Event, tokens: Tokens, device: string) {
  validateTokens(tokens, device)
  // Retain expired access JWT until refresh expiry so /me can trigger backend rotation.
  const cookieOptions = { ...options(event), maxAge: Math.min(tokens.refreshExpiresInSeconds, 7 * 86400) }
  setCookie(event, names.access, tokens.accessToken, cookieOptions)
  setCookie(event, names.refresh, tokens.refreshToken, cookieOptions)
  event.context.webAuthAccessToken = tokens.accessToken
}
const reasons: Record<string, string> = {
  'Invalid, expired or consumed Apple challenge': 'Apple 인증 요청이 만료되었거나 이미 사용되었습니다. 다시 Apple 로그인해 주세요.',
  'Invalid, expired or consumed Apple signup token': '가입 인증이 만료되었습니다. 다시 Apple 로그인해 주세요.',
  'Invalid Apple identity token': 'Apple 인증이 유효하지 않습니다. 다시 Apple 로그인해 주세요.',
  'Invalid Apple authorization code': 'Apple 인증 코드를 확인하지 못했습니다. 다시 Apple 로그인해 주세요.',
  'Apple web authorization code is required': 'Apple 인증 코드를 받지 못했습니다. 다시 Apple 로그인해 주세요.',
  'apple_email_required': 'Apple 계정의 인증된 이메일이 필요합니다. Apple 계정 설정을 확인하거나 기존 로그인 방법을 이용해 주세요.',
  'apple_verification_unavailable': 'Apple 인증을 완료할 수 없습니다. 잠시 후 Apple 로그인을 다시 시작해 주세요.',
  'Email already registered': '이미 가입된 이메일입니다. 기존 로그인 방법을 사용해 주세요. 계정은 자동 연결되지 않습니다.',
  'email_already_registered': '이미 가입된 이메일입니다. 기존 로그인 방법을 사용해 주세요. 계정은 자동 연결되지 않습니다.',
  'Invalid Google signup token': '가입 인증이 만료되었습니다. 다시 Google 로그인해 주세요.',
  'Invalid Google ID token': 'Google 인증이 유효하지 않습니다. 다시 Google 로그인해 주세요.',
  'Invalid Google identity': 'Google 계정의 인증된 이메일을 확인하지 못했습니다.',
  'Nickname already used': '이미 사용 중인 닉네임입니다.',
  'Email or nickname already used': '이미 사용 중인 이메일 또는 닉네임입니다.',
  'Email verification required': '이메일 인증을 다시 진행해 주세요.',
  'Invalid verification code': '인증번호가 올바르지 않습니다.',
  'Verification code expired': '인증번호가 만료됐습니다. 다시 받아 주세요.',
  'Email already verified': '이미 인증된 이메일입니다. 가입을 진행하거나 잠시 후 다시 인증해 주세요.',
  'Invalid email': '이메일 형식을 확인해 주세요.',
  'Invalid nickname': '닉네임 형식을 확인해 주세요.',
  'Password does not meet policy': '비밀번호 형식을 확인해 주세요.',
  'Current password incorrect': '현재 비밀번호가 일치하지 않습니다.',
  'Password confirmation mismatch': '새 비밀번호 확인이 일치하지 않습니다.',
  'New password must be different': '현재 비밀번호와 다른 비밀번호를 입력해 주세요.',
  'Password change unavailable for social account': '소셜 계정은 비밀번호를 변경할 수 없습니다.',
}
export async function authBackend<T>(event: H3Event, path: string, body?: Record<string, unknown>, token?: string, method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'): Promise<T> {
  const base = String(useRuntimeConfig(event).apiBase).replace(/\/$/, '')
  try {
    return await $fetch<T>(`${base}${path}`, {
      method: method ?? (body ? 'POST' : 'GET'), body, headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      timeout: 12000, retry: 0, redirect: 'error',
    }) as T
  } catch (error: unknown) {
    const failure = error as { response?: { status: number }; data?: unknown }
    const status = failure.response?.status ?? 502
    // Never expose upstream bodies, URLs, tokens or passwords in the response.
    const detail = JSON.stringify(failure.data ?? '')
    const reason = Object.keys(reasons).find(key => detail.includes(key))
    const message = reason ? reasons[reason] : status === 401 && path.startsWith('/api/auth/apple') ? 'Apple 인증이 만료되었거나 유효하지 않습니다. 다시 Apple 로그인해 주세요.'
      : status === 401 ? '이메일 또는 비밀번호를 확인하거나 다시 로그인해 주세요.'
      : status === 429 ? '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
      : status === 403 ? '인증이 만료되었거나 필요한 동의가 없습니다. 다시 확인해 주세요.'
      : status === 400 ? '입력값과 인증번호를 확인해 주세요.' : status === 409 ? '이미 사용 중인 정보입니다.'
      : '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
    throw createError({ statusCode: status >= 500 ? 502 : status, statusMessage: 'Authentication request failed', data: { message } })
  }
}
export async function currentUser(event: H3Event, token: string): Promise<AuthUser> {
  const user = await authBackend<AuthUser>(event, '/api/users/me', undefined, token)
  if (!user || typeof user.id !== 'number' || typeof user.nickname !== 'string' || typeof user.email !== 'string')
    throw createError({ statusCode: 502, statusMessage: 'Authentication request failed', data: { message: '사용자 정보를 확인할 수 없습니다.' } })
  return { id: user.id, email: user.email, nickname: user.nickname, provider: user.provider }
}
export async function loginWeb(event: H3Event, email: string, password: string) {
  const device = deviceId(event)
  const tokens = await authBackend<Tokens>(event, '/api/auth/login', { email, password, deviceId: device })
  return establishWebSession(event, tokens, device)
}
export async function establishWebSession(event: H3Event, tokens: Tokens, device: string) {
  validateTokens(tokens, device)
  const user = await currentUser(event, tokens.accessToken)
  save(event, tokens, device)
  return user
}
// Merge concurrent rotations within this Nitro instance, including parallel browser tabs.
const rotations = new Map<string, Promise<Tokens>>()
export async function restoreWeb(event: H3Event) {
  const access = getCookie(event, names.access), refresh = getCookie(event, names.refresh)
  if (!access || !refresh) { clearAuth(event); return null }
  try { return await currentUser(event, access) } catch (error) {
    if ((error as { statusCode?: number }).statusCode !== 401) throw error
  }
  const device = deviceId(event)
  const key = `${device}:${refresh}`
  let flight = rotations.get(key)
  if (!flight) {
    if (rotations.size >= 1000) throw createError({ statusCode: 503, statusMessage: 'Authentication request failed', data: { message: '잠시 후 다시 시도해 주세요.' } })
    flight = authBackend<Tokens>(event, '/api/auth/refresh', { refreshToken: refresh, deviceId: device })
    rotations.set(key, flight)
    const release = () => { setTimeout(() => rotations.delete(key), 5000).unref?.() }
    void flight.then(release, release)
  }
  try {
    const tokens = await flight
    save(event, tokens, device)
    return await currentUser(event, tokens.accessToken)
  } catch (error) {
    if ([400, 401, 403].includes((error as { statusCode?: number }).statusCode ?? 0)) {
      clearAuth(event)
      return null
    }
    throw error
  }
}
export async function logoutWeb(event: H3Event) {
  const refresh = getCookie(event, names.refresh)
  try {
    if (refresh) await authBackend(event, '/api/auth/logout', { refreshToken: refresh, deviceId: deviceId(event) })
  } finally { clearAuth(event) }
}
