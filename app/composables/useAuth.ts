import type { AuthUser, GoogleSignup, AppleSignup } from '../../shared/types/auth'

export function authError(error: unknown): string {
  const failure = error as { data?: { data?: { message?: string } }; response?: unknown }
  return failure.data?.data?.message || '네트워크 연결을 확인하고 다시 시도해 주세요.'
}
export function useAuth() {
  const user = useState<AuthUser | null>('auth:user', () => null)
  const pending = useState('auth:pending', () => false)
  const ready = useState('auth:ready', () => false)
  const error = useState('auth:error', () => '')
  async function run<T extends AppleSignup = GoogleSignup>(action: 'login' | 'session' | 'logout' | 'google' | 'google-complete' | 'apple' | 'apple-complete', body: Record<string, unknown> = {}, onSignup?: (value: T) => void, onFailure?: (status: number) => void, onDestination?: (path: string) => void) {
    if (pending.value) return false
    pending.value = true
    error.value = ''
    try {
      const request = () => $fetch<{ user: AuthUser | null; returnTo?: string } | T>(`/api/web-auth/${action}`, {
        method: 'POST', body, retry: 0, timeout: 45000,
      })
      const response = navigator.locks
        ? await navigator.locks.request('plave-auth', request)
        : await request()
      if ('status' in response) onSignup?.(response)
      else { user.value = response.user; ready.value = true; onDestination?.(response.returnTo === '/mypage' ? '/mypage' : '/') }
      return true
    } catch (cause) {
      error.value = authError(cause)
      onFailure?.((cause as { statusCode?: number }).statusCode ?? 0)
      return false
    } finally {
      if (action === 'logout') { user.value = null; ready.value = true }
      pending.value = false
    }
  }
  return { user, pending, ready, error,
    restore: () => run('session'), login: (email: string, password: string) => run('login', { email, password }),
    logout: () => run('logout'),
    googleLogin: (idToken: string, onSignup: (value: GoogleSignup) => void) => run('google', { idToken }, onSignup),
    appleLogin: (body: Record<string, unknown>, onSignup: (value: AppleSignup) => void, onDestination: (path: string) => void) => run<AppleSignup>('apple', body, onSignup, undefined, onDestination),
    completeApple: (body: Record<string, unknown>, onFailure: (status: number) => void, onDestination: (path: string) => void) => run<AppleSignup>('apple-complete', body, undefined, onFailure, onDestination),
    completeGoogle: (body: Record<string, unknown>, onFailure: (status: number) => void) => run('google-complete', body, undefined, onFailure) }
}
