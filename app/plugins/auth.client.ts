export default defineNuxtPlugin(nuxtApp => {
  const auth = useAuth()
  // Protected documents already verified auth on the actual SSR response.
  // Other pages restore after hydration; never rotate via an SSR subrequest.
  nuxtApp.hook('app:mounted', () => { if (!auth.ready.value) void auth.restore() })
  window.addEventListener('focus', () => { if (auth.ready.value) void auth.restore() })
  window.setInterval(() => {
    if (document.visibilityState === 'visible' && auth.user.value) void auth.restore()
  }, 60_000)
})
