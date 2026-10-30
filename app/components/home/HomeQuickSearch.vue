<script setup lang="ts">
import { ArrowLeft, LoaderCircle, Search, X } from '@lucide/vue'
import type { PopupDetail } from '../../../shared/types/popup'
import type { QuickSearchPopup, QuickSearchResponse } from '../../../shared/types/quickSearch'
import { normalizeSearchQuery, quickSearchLanguage, validQuickSearch } from '#shared/utils/quickSearch'
import PopupSearchResult from '~/components/places/PopupSearchResult.vue'

const props = withDefaults(defineProps<{ pageMode?: boolean; initialQuery?: string }>(), { pageMode: false, initialQuery: '' })
const emit = defineEmits<{ search: [query: string]; back: []; inputQuery: [query: string] }>()
const { add: rememberSearch } = useRecentSearches()

const root = ref<HTMLFormElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
defineExpose({ focus: () => input.value?.focus({ preventScroll: true }), setQuery: (value: string) => { text.value = value; reopen() } })
const text = ref(props.initialQuery)
watch(() => props.initialQuery, value => { text.value = value })
const query = computed(() => normalizeSearchQuery(text.value))
const composing = ref(false)
const open = ref(false)
const state = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
const results = shallowRef<QuickSearchPopup[]>([])
const activeIndex = ref(-1)
const listId = `quick-search-${useId()}`
const show = computed(() => open.value && validQuickSearch(query.value) && (props.pageMode || !composing.value))
const details = ref<Record<string, PopupDetail | null>>({})
const pendingDetails = new Set<string>()
const cache = new Map<string, QuickSearchPopup[]>()
let timer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined
let generation = 0
let disposed = false
function cancel() { clearTimeout(timer); controller?.abort(); ++generation }
function optionId(index: number) { return `${listId}-${index}` }
function schedule() {
  cancel()
  activeIndex.value = -1
  results.value = []
  state.value = 'idle'
  if (props.pageMode) emit('inputQuery', query.value)
  if ((!props.pageMode && composing.value) || !validQuickSearch(query.value)) { open.value = false; return }
  open.value = true
  const q = query.value, languageCode = quickSearchLanguage(q), cacheKey = `${languageCode}:${q}`
  const cached = cache.get(cacheKey)
  if (cached) { results.value = cached; state.value = 'success'; loadDetails(cached, generation); return }
  state.value = 'loading'
  const version = generation
  timer = setTimeout(async () => {
    const request = new AbortController()
    controller = request
    try {
      const response = await $fetch<QuickSearchResponse>('/api/popups/search', {
        query: { q, languageCode }, signal: request.signal, timeout: 12_000, retry: 0, credentials: 'omit',
      })
      if (disposed || request.signal.aborted || version !== generation || query.value !== q) return
      if (cache.size >= 20) cache.delete(cache.keys().next().value!)
      cache.set(cacheKey, response.popups)
      results.value = response.popups
      state.value = 'success'
      loadDetails(response.popups, version)
    } catch {
      if (!disposed && !request.signal.aborted && version === generation) state.value = 'error'
    }
  }, props.pageMode ? 200 : 300)
}
function loadDetails(popups: QuickSearchPopup[], version: number) {
  if (!props.pageMode) return
  for (const popup of popups) {
    if (popup.id in details.value || pendingDetails.has(popup.id)) continue
    pendingDetails.add(popup.id)
    void $fetch<PopupDetail>(`/api/popups/${encodeURIComponent(popup.id)}`, { timeout: 10_000, retry: 0 })
      .then(detail => { if (!disposed) details.value[popup.id] = detail })
      .catch(() => { if (!disposed && version === generation) details.value[popup.id] = null })
      .finally(() => pendingDetails.delete(popup.id))
  }
}
// Chrome can keep the last Korean syllable composing while the user pauses.
// Search the visible page input after the debounce without committing the IME.
// Watching only query avoids restarting a request when that same value commits.
if (props.pageMode) watch(query, schedule, { flush: 'post' })
else watch([query, composing], schedule, { flush: 'sync' })
function onNativeInput(event: Event) {
  if (props.pageMode) {
    text.value = (event.target as HTMLInputElement).value
  }
}
function finishComposition(event: CompositionEvent) {
  // Do not depend on v-model's synthetic input/change ordering at IME commit.
  if (props.pageMode) text.value = (event.target as HTMLInputElement).value
  composing.value = false
}
function close() {
  open.value = false
  activeIndex.value = -1
  cancel()
  if (state.value === 'loading') state.value = 'idle'
}
function reopen() {
  if (!validQuickSearch(query.value) || (!props.pageMode && composing.value)) return
  open.value = true
  if (state.value === 'idle' || (props.pageMode && state.value === 'error')) schedule()
}
function submit() {
  if (composing.value) return
  if (props.pageMode && !query.value) { emit('search', ''); return }
  if (!validQuickSearch(query.value)) return
  rememberSearch(query.value)
  const selected = show.value && state.value === 'success' ? results.value[activeIndex.value] : undefined
  if (selected) { close(); void navigateTo(`/places/${encodeURIComponent(selected.id)}`) }
  else if (props.pageMode) { emit('search', query.value); reopen() }
  else { close(); void navigateTo({ path: '/search', query: { q: query.value } }) }
}
function keydown(event: KeyboardEvent) {
  if (event.isComposing || composing.value || event.keyCode === 229) return
  if (event.key === 'Escape') { event.preventDefault(); close(); return }
  if (event.key === 'Enter') { event.preventDefault(); submit(); return }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault()
  reopen()
  if (state.value !== 'success' || !results.value.length) return
  activeIndex.value = event.key === 'ArrowDown' ? Math.min(results.value.length - 1, activeIndex.value + 1)
    : activeIndex.value < 0 ? results.value.length - 1 : Math.max(0, activeIndex.value - 1)
  void nextTick(() => document.getElementById(optionId(activeIndex.value))?.scrollIntoView({ block: 'nearest' }))
}
function outside(event: PointerEvent) { if (!root.value?.contains(event.target as Node)) close() }
function focusout(event: FocusEvent) { if (!root.value?.contains(event.relatedTarget as Node | null)) close() }
onMounted(() => { document.addEventListener('pointerdown', outside); if (props.pageMode && query.value) schedule() })
onBeforeUnmount(() => { disposed = true; cancel(); document.removeEventListener('pointerdown', outside) })
</script>

<template>
  <form ref="root" class="home-search" :class="{ 'home-search--page': pageMode }" role="search" aria-label="팝업 빠른 검색" @submit.prevent="submit" @focusout="focusout">
    <button v-if="pageMode" type="button" class="home-search__back ds-control" aria-label="뒤로가기" @click="emit('back')"><ArrowLeft :size="24" aria-hidden="true" /></button>
    <label class="home-search__field">
      <Search :size="20" aria-hidden="true" class="home-search__icon" />
      <input ref="input" v-model="text" type="search" aria-label="팝업 이름 검색" placeholder="성수, 브랜드, 팝업 이름으로 검색" class="home-search__input" autocomplete="off" role="combobox" aria-autocomplete="list" :aria-expanded="show" :aria-controls="show ? listId : undefined" :aria-activedescendant="show && activeIndex >= 0 ? optionId(activeIndex) : undefined" :aria-invalid="Array.from(query).length > 100 || undefined" @focus="reopen" @click="reopen" @keydown="keydown" @input="onNativeInput" @compositionstart="composing = true" @compositionend="finishComposition">
      <button v-if="pageMode && text" type="button" class="home-search__clear ds-control" aria-label="검색어 지우기" @click="text = ''; input?.focus()"><X :size="18" aria-hidden="true" /></button>
    </label>
    <button v-if="!pageMode" type="submit" class="home-search__button">검색</button>
    <div v-if="show" class="home-search__dropdown">
      <p v-if="pageMode && !validQuickSearch(query)" class="home-search__state" role="status">검색어는 2~100자로 입력해 주세요.</p>
      <p v-else-if="state === 'loading'" class="home-search__state" role="status"><LoaderCircle :size="16" class="home-search__spinner" aria-hidden="true" />검색 중입니다.</p>
      <p v-else-if="state === 'error'" class="home-search__state" role="alert">검색 중 문제가 발생했어요.</p>
      <p v-else-if="state === 'success' && !results.length" class="home-search__state" role="status">{{ pageMode ? '검색 결과가 없습니다' : '검색 결과가 없어요.' }}</p>
      <ul :id="listId" role="listbox" aria-label="팝업 검색 결과" :aria-busy="state === 'loading'" :hidden="state !== 'success' || !results.length">
        <li v-for="(popup, index) in results" :key="popup.id" role="presentation">
          <NuxtLink :id="optionId(index)" :to="`/places/${encodeURIComponent(popup.id)}`" :prefetch="false" role="option" :aria-selected="activeIndex === index" :tabindex="pageMode ? 0 : -1" class="home-search__result" :class="{ 'is-active': activeIndex === index }" @pointermove="activeIndex = index" @pointerdown.prevent @click="pageMode && rememberSearch(query); close()">
            <PopupSearchResult :popup="popup" :query="query" :compact="pageMode" :detail="details[popup.id]" />
          </NuxtLink>
        </li>
      </ul>
    </div>
    <p v-if="!pageMode && Array.from(query).length > 100" class="home-search__validation" role="status">검색어는 100자 이하로 입력해 주세요.</p>
  </form>
</template>

<style scoped>
.home-search { position: relative; z-index: 30; display: flex; align-items: center; gap: 8px; flex: 0 0 48px; width: 100%; height: 48px; }
.home-search--page { gap: var(--ds-space-12); }
.home-search--page .home-search__dropdown { left: 56px; z-index: 1; background: #fff; box-shadow: none; }
.home-search__clear { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 32px; height: 40px; color: var(--ds-secondary); }
.home-search--page input::-webkit-search-cancel-button { appearance: none; }
.home-search__back { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 44px; width: 44px; height: 44px; color: var(--ds-text); }
.home-search--page .home-search__field { border-radius: var(--ds-radius-12); background: var(--ds-tag); gap: var(--ds-space-12); }
.home-search__field:focus-within { outline: 2px solid #7c3aed; outline-offset: 2px; }
.home-search__field { display: flex; align-items: center; gap: 16px; flex: 1; min-width: 0; height: 100%; padding-inline: 12px; border: 0; border-radius: 5px; background: #f5f5f7; }
.home-search__icon { flex-shrink: 0; color: #737373; }
.home-search__input { width: 100%; min-width: 0; height: 100%; border: 0; outline: none; background: transparent; color: #111827; font-family: inherit; font-size: 16px; font-weight: 400; }
.home-search__input::placeholder { color: #737373; }
/* Preserve the original width by distributing the removed 20px icon + 8px gap equally. */
.home-search__button { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; height: 48px; padding-inline: 34px; border: 0; border-radius: 5px; background: #7c3aed; color: #ffffff; font-size: 16px; font-weight: 400; white-space: nowrap; }
.home-search__dropdown { position: absolute; top: calc(100% + 8px); left: 0; right: 0; overflow: auto; max-height: min(380px, 60dvh); border: 1px solid var(--ds-border); border-radius: 12px; background: var(--ds-background); color: var(--ds-text); box-shadow: 0 4px 16px rgb(0 0 0 / 8%); }
.home-search__dropdown ul { margin: 0; padding: 0; list-style: none; }
.home-search__dropdown li + li { border-top: 1px solid var(--ds-border); }
.home-search__result { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
.home-search__result:hover, .home-search__result.is-active { background: var(--ds-tag); }
.home-search__result:focus-visible { outline: 2px solid #7c3aed; outline-offset: -3px; }
.home-search__result-icon { flex-shrink: 0; color: var(--ds-secondary); }
.home-search__result-copy { flex: 1; min-width: 0; }
.home-search__name, .home-search__address { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.home-search__name { font-size: 14px; line-height: 22px; }
.home-search__name mark { background: transparent; color: #7839ef; font-weight: 600; }
.home-search__address { margin-top: 2px; color: var(--ds-secondary); font-size: 12px; line-height: 18px; }
.home-search__state { display: flex; align-items: center; gap: 8px; padding: 16px; color: var(--ds-secondary); font-size: 14px; }
.home-search__spinner { animation: search-spin 1s linear infinite; }
.home-search__validation { position: absolute; top: calc(100% + 8px); left: 0; padding: 8px 12px; border-radius: 8px; background: var(--ds-background); color: var(--ds-secondary); font-size: 13px; }
@keyframes search-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .home-search__spinner { animation: none; } }
</style>
