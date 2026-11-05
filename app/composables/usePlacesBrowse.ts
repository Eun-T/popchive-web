import type { PlaceListQuery, PlaceOptions, PlacePage, PlacePopup, PlaceStatus, PlaceSort } from '../../shared/types/places'
import { PLACE_PAGE_SIZE } from '#shared/types/places'
import { emptyDatePeriod, isValidDateRange } from '#shared/utils/placeDatePeriod'
import type { PlaceDatePeriod } from '#shared/utils/placeDatePeriod'
import { MAX_PLACES_PAGE, placesPageNumber } from '#shared/utils/placesPagination'

export type PlaceFilterKey = 'countryCode' | 'region' | 'category' | 'status'
export type PlaceFilters = Record<PlaceFilterKey, string[]>
export function emptyPlaceFilters(): PlaceFilters { return { countryCode: ['KR'], region: [], category: [], status: [] } }
export function copyPlaceFilters(filters: PlaceFilters): PlaceFilters {
  return { countryCode: ['KR'], region: [...filters.region], category: [...filters.category], status: [...filters.status] }
}

export function usePlacesBrowse(initialCategory?: number) {
  const route = useRoute()
  const router = useRouter()
  const initialFullPath = route.fullPath
  const initialPageQuery = route.query.page
  const initialPage = placesPageNumber(initialPageQuery)
  if (initialPage === null) throw createError({ statusCode: 400, statusMessage: 'Invalid popup page' })
  const pageNumber = computed(() => initialPage)
  function routeIds(key: 'regionIds' | 'tagIds'): string[] {
    const value = route.query[key]
    if (value === undefined) return []
    if (typeof value !== 'string' || !/^[1-9]\d{0,8}(,[1-9]\d{0,8}){0,29}$/.test(value)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid popup filters' })
    }
    return [...new Set(value.split(','))]
  }
  // URL-only start-date condition; it is independent of the modal's drafts.
  const openingRange = computed(() => {
    const from = route.query.openingFrom, to = route.query.openingTo
    const present = from !== undefined || to !== undefined
    const valid = typeof from === 'string' && typeof to === 'string' && isValidDateRange(from, to)
    return { from, to, active: present && valid, invalid: present && !valid }
  })
  function removeOpeningRange() {
    const { openingFrom: _, openingTo: __, page: ___, ...query } = route.query
    void router.replace({ query })
  }
  function periodFromRoute(): PlaceDatePeriod {
    const start = route.query.operatingFrom, end = route.query.operatingTo
    return typeof start === 'string' && typeof end === 'string' && isValidDateRange(start, end)
      ? { mode: 'custom', startDate: start, endDate: end } : emptyDatePeriod()
  }
  const appliedPeriod = ref(periodFromRoute())
  const draftPeriod = ref<PlaceDatePeriod>({ ...appliedPeriod.value })
  watch(() => [route.query.operatingFrom, route.query.operatingTo], () => {
    const period = periodFromRoute()
    if (period.startDate !== appliedPeriod.value.startDate || period.endDate !== appliedPeriod.value.endDate) {
      appliedPeriod.value = period
      draftPeriod.value = { ...period }
    }
  })
  const sort = ref<PlaceSort>(['LATEST', 'START_DATE_ASC', 'END_DATE_ASC'].includes(String(route.query.sort)) ? route.query.sort as PlaceSort : 'LATEST')
  function statusFromRoute(): string[] {
    const status = route.query.status
    return typeof status === 'string' && ['ONGOING', 'UPCOMING', 'ENDED'].includes(status) ? [status] : []
  }
  const appliedFilters = ref({ ...emptyPlaceFilters(), region: routeIds('regionIds'), category: route.query.tagIds !== undefined ? routeIds('tagIds') : initialCategory === undefined ? [] : [String(initialCategory)], status: statusFromRoute() })
  const draftFilters = ref(copyPlaceFilters(appliedFilters.value))
  watch(() => route.query.status, () => {
    const status = statusFromRoute()
    if (status[0] !== appliedFilters.value.status[0]) {
      appliedFilters.value = { ...appliedFilters.value, status }
      draftFilters.value.status = [...status]
    }
  })
  const filtersQuery = computed<PlaceListQuery>(() => ({
    limit: PLACE_PAGE_SIZE,
    sort: sort.value,
    // The All list stays Korean regardless of draft, restored state, or URL country.
    countryCode: 'KR',
    ...(appliedFilters.value.region.length ? { regionIds: [...appliedFilters.value.region].sort((a, b) => Number(a) - Number(b)).join(',') } : {}),
    ...(appliedFilters.value.category.length ? { tagIds: [...appliedFilters.value.category].sort((a, b) => Number(a) - Number(b)).join(',') } : {}),
    ...(appliedFilters.value.status[0] ? { status: appliedFilters.value.status[0] as PlaceStatus } : {}),
    ...(appliedPeriod.value.mode !== 'all' && isValidDateRange(appliedPeriod.value.startDate, appliedPeriod.value.endDate)
      ? { operatingFrom: appliedPeriod.value.startDate!, operatingTo: appliedPeriod.value.endDate! } : {}),
    ...(openingRange.value.active
      ? { openingFrom: openingRange.value.from as string, openingTo: openingRange.value.to as string } : {}),
  }))
  function pageLocation(page: number) {
    const query = { ...route.query }
    for (const key of ['page', 'regionIds', 'tagIds', 'tagId', 'sort', 'status', 'operatingFrom', 'operatingTo']) delete query[key]
    if (query.tab === 'explore') delete query.tab
    for (const key of ['regionIds', 'tagIds', 'status', 'operatingFrom', 'operatingTo'] as const) {
      const value = filtersQuery.value[key]
      if (value) query[key] = value
    }
    if (sort.value !== 'LATEST') query.sort = sort.value
    if (page > 1) query.page = String(page)
    return { path: '/places', query }
  }
  watch(filtersQuery, () => {
    // The old component must not rewrite a pagination navigation before it unmounts.
    if (route.fullPath !== initialFullPath) return
    resetPages()
    void router.replace(pageLocation(1))
  })
  // places.vue remounts on query changes. Only that new instance fetches the
  // committed URL; mutable UI filters must not issue intermediate requests here.
  const initialFiltersQuery = { ...filtersQuery.value }
  const initialFiltersKey = JSON.stringify(initialFiltersQuery)
  const invalidOpeningRange = openingRange.value.invalid
  const requestKey = `places:all:${initialFiltersKey}:page:${initialPage}${invalidOpeningRange ? ':invalid-opening-range' : ''}`
  const optionsRequest = useFetch<PlaceOptions>('/api/places/options', { key: 'places:options', retry: 0, dedupe: 'defer' })
  const pageRequest = useAsyncData(requestKey, async (_nuxtApp, { signal }) => {
    const query = { ...initialFiltersQuery, page: String(initialPage) }
    // Never fall back to an unfiltered list for a malformed or incomplete URL.
    if (invalidOpeningRange) throw createError({ statusCode: 400, statusMessage: 'Invalid opening date range' })
    const page = await $fetch<PlacePage>('/api/places/popups', { query, signal, retry: 0 })
    return { ...page, requestKey }
  }, { server: true, dedupe: 'cancel' })
  const firstPage = computed(() => pageRequest.data.value?.requestKey === requestKey ? pageRequest.data.value : undefined)
  const filterGroups = computed(() => [
    { key: 'region' as const, label: '지역', multiple: true, options: (optionsRequest.data.value?.regions ?? [])
      .filter(region => region.countryCode === 'KR')
      .map(region => ({ value: String(region.id), label: region.name })) },
    { key: 'category' as const, label: '카테고리', multiple: true, options: (optionsRequest.data.value?.tags ?? []).map(tag => ({ value: String(tag.id), label: tag.name })) },
    { key: 'status' as const, label: '진행 상태', multiple: false, options: [
      { value: 'ONGOING', label: '진행 중' }, { value: 'UPCOMING', label: '오픈 예정' }, { value: 'ENDED', label: '종료' },
    ] },
  ])
  // The fixed country is not a removable filter or part of the filter count.
  const activeChips = computed(() => {
    const groups = [
      filterGroups.value[0]!,
      { key: 'category' as const, options: (optionsRequest.data.value?.tags ?? []).map(row => ({ value: String(row.id), label: row.name })) },
      filterGroups.value[2]!,
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
  watch(pageRequest.data, resetPages)
  const filteredPopups = computed(() => [...new Map([...(firstPage.value?.items ?? []), ...appended.value].map(item => [item.id, item])).values()])
  async function loadMore() {
    // A pending filter/navigation belongs to the next instance. Do not append
    // its results to this instance's already rendered page.
    if (route.fullPath !== initialFullPath || JSON.stringify(filtersQuery.value) !== initialFiltersKey) return
    const cursor = nextCursor.value
    if (disposed || !cursor || seenCursors.has(cursor) || moreLoading.value || pageRequest.status.value !== 'success') return
    const version = generation
    controller = new AbortController()
    moreLoading.value = true
    moreError.value = false
    try {
      const page = await $fetch<PlacePage>('/api/places/popups', {
        query: { ...initialFiltersQuery, cursor }, retry: 0, timeout: 15_000, signal: controller.signal,
      })
      if (disposed || version !== generation || route.fullPath !== initialFullPath
        || JSON.stringify(filtersQuery.value) !== initialFiltersKey) return
      if (page.nextCursor && (page.nextCursor === cursor || seenCursors.has(page.nextCursor))) throw new Error('Repeated cursor')
      seenCursors.add(cursor)
      appended.value.push(...page.items)
      cursorOverride.value = page.nextCursor
    } catch {
      if (!disposed && version === generation) moreError.value = true
    } finally {
      if (!disposed && version === generation) moreLoading.value = false
    }
  }
  function toggleDraft(key: PlaceFilterKey, value: string) {
    const group = filterGroups.value.find(item => item.key === key)
    if (!group || !group.options.some(option => option.value === value)) return
    const current = draftFilters.value[key]
    draftFilters.value[key] = current.includes(value) ? current.filter(item => item !== value) : group.multiple ? [...current, value] : [value]
  }
  function removeFilter(group: PlaceFilterKey, value: string) {
    appliedFilters.value = { ...copyPlaceFilters(appliedFilters.value), [group]: appliedFilters.value[group].filter(item => item !== value) }
  }
  function selectRegion(countryCode: 'KR' | 'JP', regionId: number) {
    if (countryCode !== 'KR') return false
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
    pageNumber, pageLocation,
    hasNextPage: computed(() => !!firstPage.value?.nextCursor && pageNumber.value < MAX_PLACES_PAGE),
    sort, appliedFilters, draftFilters, appliedPeriod, draftPeriod, openingRange, removeOpeningRange, filterGroups, activeChips,
    appliedCount: computed(() => activeChips.value.length + (appliedPeriod.value.mode === 'all' ? 0 : 1) + (openingRange.value.active ? 1 : 0)),
    filteredPopups, listStatus: pageRequest.status, listError: pageRequest.error, refreshList: pageRequest.refresh,
    refreshOptions: optionsRequest.refresh, nextCursor, moreLoading, moreError, loadMore, toggleDraft, removeFilter, selectRegion, selectCategory,
  }
}
