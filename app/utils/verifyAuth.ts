export async function verifyAuth(auth: ReturnType<typeof useAuth>) {
  if (auth.pending.value) {
    await new Promise<void>(resolve => {
      const stop = watch(auth.pending, pending => {
        if (!pending) { stop(); resolve() }
      })
    })
    if (!auth.error.value && auth.ready.value) return auth.user.value
  }
  if (!await auth.restore()) throw createError({ statusCode: 503, message: '로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.' })
  return auth.user.value
}
