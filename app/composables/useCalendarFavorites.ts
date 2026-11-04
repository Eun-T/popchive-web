import { authError } from './useAuth'

export interface CalendarFavorite {
  id: string
  title: string
  start: number
  end: number
  tone: 'purple' | 'blue' | 'coral' | 'orange'
}

function calendarDate(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  // Date.UTC treats years 0–99 as 1900–1999; normalize them explicitly.
  if (year < 100) date.setUTCFullYear(year, month - 1, day)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.getTime() : null
}

function calendarFavorites(response: unknown): CalendarFavorite[] {
  if (!response || typeof response !== 'object' || !('popups' in response) || !Array.isArray(response.popups)) {
    throw new Error('Invalid favorites response')
  }
  const tones = ['purple', 'blue', 'coral', 'orange'] as const
  const events = new Map<string, CalendarFavorite>()
  for (const row of response.popups) {
    if (!row || typeof row !== 'object' || row.countryCode !== 'KR'
      || typeof row.publicId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(row.publicId)
      || typeof row.name !== 'string' || !row.name.trim()) continue
    const start = calendarDate(row.startDate), end = calendarDate(row.endDate)
    if (start === null || end === null || end < start) continue
    let hash = 0
    for (const character of row.publicId) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0
    events.set(row.publicId, { id: row.publicId, title: row.name, start, end, tone: tones[hash % tones.length]! })
  }
  // Stable ordering also keeps lane assignment independent of favorite creation order.
  return [...events.values()].sort((a, b) => a.start - b.start || a.end - b.end || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export function useCalendarFavorites() {
  const auth = useAuth()
  const events = ref<CalendarFavorite[]>([])
  const loading = ref(false)
  const error = ref('')
  const mounted = ref(false)
  const authenticated = computed(() => mounted.value && auth.ready.value && !!auth.user.value)
  const authChecking = computed(() => !mounted.value || auth.pending.value || (!auth.ready.value && !auth.error.value))
  const authFailure = computed(() => mounted.value && !auth.ready.value && !auth.pending.value ? auth.error.value : '')
  let ownerId: number | undefined
  let generation = 0
  let controller: AbortController | undefined
  let needsLoad = true
  let loadedAt = 0

  function cancel() {
    ++generation
    controller?.abort()
    controller = undefined
    loading.value = false
  }
  function current(owner: number, version: number, request: AbortController) {
    return mounted.value && !request.signal.aborted && version === generation
      && auth.ready.value && !auth.pending.value && auth.user.value?.id === owner
  }
  async function load(owner: number) {
    if (controller) return
    const request = new AbortController()
    controller = request
    const version = ++generation
    needsLoad = false
    loading.value = true
    error.value = ''
    try {
      const send = () => {
        if (!current(owner, version, request)) throw new Error('Session changed')
        return $fetch<unknown>('/api/web-auth/my-favorites', {
          method: 'POST', body: { ownerId: owner }, retry: 0, timeout: 60000, signal: request.signal,
        })
      }
      const response = navigator.locks
        ? await navigator.locks.request('plave-auth', { signal: request.signal }, send)
        : await send()
      if (!current(owner, version, request)) return
      events.value = calendarFavorites(response)
      loadedAt = Date.now()
    } catch (cause) {
      if (!current(owner, version, request)) return
      events.value = []
      error.value = authError(cause)
      if ((cause as { statusCode?: number }).statusCode === 401) auth.user.value = null
    } finally {
      if (version === generation) { controller = undefined; loading.value = false }
    }
  }
  function sync() {
    if (!mounted.value) return
    const owner = auth.ready.value ? auth.user.value?.id : undefined
    if (owner !== ownerId) {
      cancel()
      events.value = []
      error.value = ''
      loadedAt = 0
      needsLoad = true
      ownerId = owner
    }
    if (auth.pending.value || !auth.ready.value || owner === undefined) {
      if (controller) { cancel(); needsLoad = true }
      return
    }
    if (needsLoad) void load(owner)
  }
  function refresh() {
    if (controller) return
    needsLoad = true
    sync()
  }
  function onFocus() {
    if (!loadedAt || Date.now() - loadedAt >= 30_000) refresh()
  }
  function onPageShow(event: PageTransitionEvent) { if (event.persisted) refresh() }
  watch([() => auth.ready.value, () => auth.user.value?.id, () => auth.pending.value], sync, { flush: 'sync' })
  onMounted(() => {
    mounted.value = true
    sync()
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onPageShow)
  })
  onBeforeUnmount(() => {
    mounted.value = false
    cancel()
    events.value = []
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('pageshow', onPageShow)
  })
  return { events, loading, error, authenticated, authChecking, authFailure, refresh }
}
