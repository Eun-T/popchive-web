import type { HomeSection, HomeSectionResponse } from '../../shared/types/home'

export function useHomePopups(section: HomeSection) {
  const result = useFetch<HomeSectionResponse>(`/api/home/${section}`, {
    key: `home:${section}:KR:ko`,
    query: { countryCode: 'KR', languageCode: 'ko' },
    server: true,
    dedupe: 'defer',
    retry: 0,
  })

  let timer: ReturnType<typeof setInterval> | undefined
  let lastImageRefresh = 0
  function refreshIfStale() {
    if (document.hidden || result.status.value === 'pending') return
    const fetchedAt = result.data.value?.fetchedAt
    // Refresh before signatures expire, including after returning to a hidden tab.
    if (fetchedAt && Date.now() - fetchedAt >= 180_000) void result.refresh()
  }
  function onImageError() {
    // At most one recovery request per section per minute, not one per failed card.
    const now = Date.now()
    if (result.status.value === 'pending' || now - lastImageRefresh < 60_000) return
    const fetchedAt = result.data.value?.fetchedAt
    if (!fetchedAt || now - fetchedAt < 60_000) return
    lastImageRefresh = now
    void result.refresh()
  }
  onMounted(() => {
    // No mount-time fetch: useFetch reuses the SSR payload during hydration.
    timer = setInterval(refreshIfStale, 30_000)
    document.addEventListener('visibilitychange', refreshIfStale)
    window.addEventListener('pageshow', refreshIfStale)
  })
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
    document.removeEventListener('visibilitychange', refreshIfStale)
    window.removeEventListener('pageshow', refreshIfStale)
  })

  return { result, onImageError }
}
