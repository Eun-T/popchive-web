import type { H3Event } from 'h3'

// Shared Redis REST, never an in-process fallback: GETDEL is atomic across instances.
// Commands and request bodies must be excluded from infrastructure logging.
export async function appleAuthCommand(event: H3Event, command: (string | number)[]) {
  const config = useRuntimeConfig(event)
  const endpoint = String(config.appleAuthRedisUrl)
  const token = String(config.appleAuthRedisToken)
  try {
    const url = new URL(endpoint)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !token) throw new Error()
    const response = await $fetch<{ result?: unknown; error?: unknown }>(endpoint, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: command,
      retry: 0, timeout: 5000, redirect: 'error',
    })
    if (!response || response.error || !('result' in response)) throw new Error()
    return response.result
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Apple authentication unavailable',
      data: { message: 'Apple 인증 저장소에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' } })
  }
}
