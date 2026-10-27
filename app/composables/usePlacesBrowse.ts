import type { PlaceListQuery, PlaceOptions, PlacePage, PlacePopup, PlaceStatus, PlaceSort } from '../../shared/types/places'
import { PLACE_PAGE_SIZE } from '../../shared/types/places'

export type PlaceFilterKey = 'countryCode' | 'region' | 'category' | 'status'
export type PlaceFilters = Record<PlaceFilterKey, string[]>
export function emptyPlaceFilters(): PlaceFilters { return { countryCode: [], region: [], category: [], status: [] } }
export function copyPlaceFilters(filters: PlaceFilters): PlaceFilters {
  return { countryCode: [...filters.countryCode], region: [...filters.region], category: [...filters.category], status: [...filters.status] }
}

export function usePlacesBrowse(initialCategory?: number) {
  const sort = ref<PlaceSort>('LATEST')
  const appliedFilters = ref({ ...emptyPlaceFilters(), category: initialCategory === undefined ? [] : [String(initialCategory)] })
  const draftFilters = ref(emptyPlaceFilters())
  const filtersQuery = computed<PlaceListQuery>(() => ({
    limit: PLACE_PAGE_SIZE,
    sort: sort.value,
    ...(appliedFilters.value.countryCode[0] ? { countryCode: appliedFilters.value.countryCode[0] as 'KR' | 'JP' } : {}),
    ...(appliedFilters.value.region.length ? { regionIds: [...appliedFilters.value.region].sort((a, b) => Number(a) - Number(b)).join(',') } : {}),
    ...(appliedFilters.value.category.length ? { tagIds: [...appliedFilters.value.category].sort((a, b) => Number(a) - Number(b)).join(',') } : {}),
    ...(appliedFilters.value.status[0] ? { status: appliedFilters.value.status[0] as PlaceStatus } : {}),
  }))
  const requestKey = computed(() => `places:all:${JSON.stringify(filtersQuery.value)}`)
  const optionsRequest = useFetch<PlaceOptions>('/api/places/options', { key: 'places:options', retry: 0, dedupe: 'defer' })
  const pageRequest = useAsyncData(requestKey, async (_nuxtApp, { signal }) => {
    // Capture the query before awaiting; never attribute a late response to a new sort.
    const key = requestKey.value
    const query = { ...filtersQuery.value }
    const page = await $fetch<PlacePage>('/api/places/popups', { query, signal, retry: 0 })
    return { ...page, requestKey: key }
  }, { server: true, dedupe: 'cancel' })
  // Nuxt may carry previous data while a reactive key changes. Exclude it explicitly.
  const firstPage = computed(() => pageRequest.data.value?.requestKey === requestKey.value ? pageRequest.data.value : undefined)
  const filterGroups = computed(() => [
    { key: 'countryCode' as const, label: '국가', multiple: false, options: [{ value: 'KR', label: '한국' }, { value: 'JP', label: '일본' }] },
    { key: 'region' as const, label: '지역', multiple: true, options: (optionsRequest.data.value?.regions ?? [])
      .filter(region => !draftFilters.value.countryCode.length || draftFilters.value.countryCode.includes(region.countryCode))
      .map(region => ({ value: String(region.id), label: region.name })) },
    { key: 'category' as const, label: '카테고리', multiple: true, options: (optionsRequest.data.value?.tags ?? []).map(tag => ({ value: String(tag.id), label: tag.name })) },
    { key: 'status' as const, label: '진행 상태', multiple: false, options: [
      { value: 'ONGOING', label: '진행 중' }, { value: 'UPCOMING', label: '오픈 예정' }, { value: 'ENDED', label: '종료' },
    ] },
  ])
  // Chips use all metadata, independently of the country currently being drafted.
  const activeChips = computed(() => {
    const groups = [
      { key: 'countryCode' as const, options: [{ value: 'KR', label: '한국' }, { value: 'JP', label: '일본' }] },
      { key: 'region' as const, options: (optionsRequest.data.value?.regions ?? []).map(row => ({ value: String(row.id), label: row.name })) },
      { key: 'category' as const, options: (optionsRequest.data.value?.tags ?? []).map(row => ({ value: String(row.id), label: row.name })) },
      filterGroups.value[3]!,
    ]
    return groups.flatMap(group => group.options.filter(option => appliedFilters.value[group.key].includes(option.value))
      .map(option => ({ group: group.key, ...option })))
  })
  const appended = ref<PlacePopup[]>([])
  // Derive the first cursor directly from SSR data; an async watch does not run during SSR.
  const cursorOverride = ref<string | null | undefined>()
  const nextCursor = computed(() => cursorOverride.value === undefined ? firstPage.value?.nextCursor ?? null : cursorOverride.value)
  const moreLoading = ref(false)
  const moreError = ref(false)
  let controller: AbortController | undefined
  let generation = 0
  let disposed = false
  const seenCursors = new Set<string>()
  function resetPages() {
    controller?.abort()
    ++generation
    appended.value = []
    cursorOverride.value = undefined
    moreLoading.value = false
    moreError.value = false
    seenCursors.clear()
  }
  watch(requestKey, resetPages, { flush: 'sync' })
  watch(pageRequest.data, resetPages)
  const filteredPopups = computed(() => [...new Map([...(firstPage.value?.items ?? []), ...appended.value].map(item => [item.id, item])).values()])
  async function loadMore() {
    const cursor = nextCursor.value
    if (!cursor || moreLoading.value || pageRequest.status.value !== 'success') return
    const version = generation, key = requestKey.value
    controller = new AbortController()
    moreLoading.value = true
    moreError.value = false
    try {
      const page = await $fetch<PlacePage>('/api/places/popups', {
        query: { ...filtersQuery.value, cursor }, retry: 0, timeout: 15_000, signal: controller.signal,
      })
      if (disposed || version !== generation || key !== requestKey.value) return
      if (page.nextCursor && (page.nextCursor === cursor || seenCursors.has(page.nextCursor))) throw new Error('Repeated cursor')
      seenCursors.add(cursor)
      appended.value.push(...page.items)
      cursorOverride.value = page.nextCursor
    } catch {
      if (!disposed && version === generation && key === requestKey.value) moreError.value = true
    } finally {
      if (!disposed && version === generation && key === requestKey.value) moreLoading.value = false
    }
  }
  function toggleDraft(key: PlaceFilterKey, value: string) {
    const group = filterGroups.value.find(item => item.key === key)!
    const current = draftFilters.value[key]
    draftFilters.value[key] = current.includes(value) ? current.filter(item => item !== value) : group.multiple ? [...current, value] : [value]
    if (key === 'countryCode') draftFilters.value.region = draftFilters.value.region.filter(id =>
      optionsRequest.data.value?.regions.some(region => String(region.id) === id
        && (!draftFilters.value.countryCode.length || draftFilters.value.countryCode.includes(region.countryCode))))
  }
  function removeFilter(group: PlaceFilterKey, value: string) {
    appliedFilters.value = { ...copyPlaceFilters(appliedFilters.value), [group]: appliedFilters.value[group].filter(item => item !== value) }
  }
  function selectRegion(countryCode: 'KR' | 'JP', regionId: number) {
    if (!optionsRequest.data.value?.regions.some(region => region.id === regionId && region.countryCode === countryCode)) return false
    // A region shortcut starts a fresh country+region query, without incompatible previous filters.
    appliedFilters.value = { ...emptyPlaceFilters(), countryCode: [countryCode], region: [String(regionId)] }
    draftFilters.value = copyPlaceFilters(appliedFilters.value)
    return true
  }
  function selectCategory(tagId: number) {
    if (!optionsRequest.data.value?.tags.some(tag => tag.id === tagId)) return false
    const filters = { ...emptyPlaceFilters(), category: [String(tagId)] }
    if (JSON.stringify(appliedFilters.value) !== JSON.stringify(filters)) appliedFilters.value = filters
    draftFilters.value = copyPlaceFilters(filters)
    return true
  }
  onBeforeUnmount(() => { disposed = true; controller?.abort() })
  return {
    ready: Promise.all([optionsRequest, pageRequest]), options: optionsRequest.data, optionsError: optionsRequest.error,
    sort, appliedFilters, draftFilters, filterGroups, activeChips, appliedCount: computed(() => activeChips.value.length),
    filteredPopups, listStatus: pageRequest.status, listError: pageRequest.error, refreshList: pageRequest.refresh,
    refreshOptions: optionsRequest.refresh, nextCursor, moreLoading, moreError, loadMore, toggleDraft, removeFilter, selectRegion, selectCategory,
  }
}
