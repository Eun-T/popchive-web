import type { AuthUser } from '../../shared/types/auth'
import { verifyAuth } from '~/utils/verifyAuth'

export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuth()
  const nuxtApp = useNuxtApp()
  if (import.meta.server) {
    const result = useRequestEvent()?.context.mypageAuth as { user?: AuthUser | null; unavailable?: boolean } | undefined
    if (!result || result.unavailable) throw createError({ statusCode: 503, message: '로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.' })
    auth.user.value = result.user ?? null
    auth.ready.value = true
  } else if (!(nuxtApp.isHydrating && nuxtApp.payload.serverRendered && auth.ready.value)) {
    await verifyAuth(auth)
  }
  if (!auth.user.value) return navigateTo({ path: '/login', query: { redirect: '/mypage' } }, { replace: true })
})
