import type { H3Event } from 'h3'
import { authBackend, clearAuth, restoreWeb } from './webAuth'
import { normalizeNickname, validNickname, validPassword } from '../../shared/utils/auth'

export const mypageActions = ['my-favorites', 'unfavorite', 'my-reviews', 'review-edit', 'review-update', 'review-delete', 'my-nickname', 'my-password', 'withdraw']
export async function mypageAction(event: H3Event, action: string, body: Record<string, unknown>) {
  function invalid(message = '입력값을 확인해 주세요.'): never {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: { message } })
  }
  const user = await restoreWeb(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized', data: { message: '다시 로그인해 주세요.' } })
  if (body.ownerId !== user.id) throw createError({ statusCode: 409, statusMessage: 'Session changed', data: { message: '로그인 계정이 변경되었습니다. 페이지를 새로고침해 주세요.' } })
  const token = (event.context.webAuthAccessToken as string | undefined) ?? getCookie(event, 'plave_access')
  const request = async <T>(path: string, method: 'GET' | 'PATCH' | 'DELETE' = 'GET', payload?: Record<string, unknown>) => {
    try { return await authBackend<T>(event, path, payload, token, method) }
    catch (error) { if ((error as { statusCode?: number }).statusCode === 401) clearAuth(event); throw error }
  }
  if (action === 'my-favorites') return request('/api/users/me/favorites')
  if (action === 'unfavorite') {
    if (typeof body.publicId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(body.publicId)) invalid()
    return request(`/api/popups/${body.publicId}/favorite`, 'DELETE')
  }
  if (action === 'my-reviews') {
    if (body.cursor != null && (typeof body.cursor !== 'string' || !/^[1-9]\d{0,18}$/.test(body.cursor))) invalid()
    return request(`/api/users/me/reviews${body.cursor ? `?cursor=${body.cursor}` : ''}`)
  }
  if (action.startsWith('review-')) {
    if (!Number.isSafeInteger(body.id) || Number(body.id) < 1) invalid()
    const path = `/api/community/reviews/${body.id}`
    if (action === 'review-edit') return request(`${path}/edit`)
    if (action === 'review-delete') { await request(path, 'DELETE'); return { deleted: true } }
    if (!Number.isInteger(body.rating) || Number(body.rating) < 1 || Number(body.rating) > 5 || typeof body.content !== 'string'
      || new TextEncoder().encode(body.content).length > 65535 || !Array.isArray(body.retainedImageIds) || body.retainedImageIds.length > 5
      || body.retainedImageIds.some(id => !Number.isSafeInteger(id) || id < 1)) invalid()
    return request(path, 'PATCH', { rating: body.rating, content: body.content, retainedImageIds: body.retainedImageIds })
  }
  if (action === 'my-nickname') {
    const nickname = normalizeNickname(typeof body.nickname === 'string' ? body.nickname : '')
    if (!validNickname(nickname)) invalid('닉네임은 문자·숫자·밑줄 2~10자로 입력해 주세요.')
    return { user: await request('/api/users/me/nickname', 'PATCH', { nickname }) }
  }
  if (action === 'my-password') {
    if (user.provider !== 'LOCAL') invalid('소셜 계정은 비밀번호를 변경할 수 없습니다.')
    if (typeof body.currentPassword !== 'string' || !body.currentPassword || typeof body.newPassword !== 'string' || !validPassword(body.newPassword)
      || body.confirmPassword !== body.newPassword || body.newPassword === body.currentPassword) invalid('현재 비밀번호와 새 비밀번호·확인값을 확인해 주세요.')
    await request('/api/users/me/password', 'PATCH', { currentPassword: body.currentPassword, newPassword: body.newPassword, confirmPassword: body.confirmPassword })
    clearAuth(event)
    return { signedOut: true }
  }
  if (action === 'withdraw') {
    if (body.confirmed !== true) invalid('탈퇴 확인이 필요합니다.')
    await request('/api/users/me', 'DELETE')
    clearAuth(event)
    return { signedOut: true }
  }
  invalid()
}
