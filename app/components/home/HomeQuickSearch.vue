<script setup lang="ts">
import { LoaderCircle, Search } from '@lucide/vue'
import type { QuickSearchPopup, QuickSearchResponse } from '../../../shared/types/quickSearch'
import { quickSearchLanguage, validQuickSearch } from '#shared/utils/quickSearch'

const root = ref<HTMLFormElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
defineExpose({ focus: () => input.value?.focus({ preventScroll: true }) })
const text = ref('')
const query = computed(() => text.value.trim())
const composing = ref(false)
const open = ref(false)
const state = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
const results = shallowRef<QuickSearchPopup[]>([])
const activeIndex = ref(-1)
const listId = `quick-search-${useId()}`
const show = computed(() => open.value && validQuickSearch(query.value) && !composing.value)
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
  if (composing.value || !validQuickSearch(query.value)) { open.value = false; return }
  open.value = true
  const q = query.value, languageCode = quickSearchLanguage(q), cacheKey = `${languageCode}:${q}`
  const cached = cache.get(cacheKey)
  if (cached) { results.value = cached; state.value = 'success'; return }
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
    } catch {
      if (!disposed && !request.signal.aborted && version === generation) state.value = 'error'
    }
  }, 300)
}
watch([query, composing], schedule, { flush: 'sync' })
function close() {
  open.value = false
  activeIndex.value = -1
  cancel()
  if (state.value === 'loading') state.value = 'idle'
}
function reopen() {
  if (!validQuickSearch(query.value) || composing.value) return
  open.value = true
  if (state.value === 'idle') schedule()
}
function submit() {
  if (composing.value) return
  const selected = show.value && state.value === 'success' ? results.value[activeIndex.value] : undefined
  if (selected) { close(); void navigateTo(`/places/${encodeURIComponent(selected.id)}`) }
  else reopen()
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
function nameParts(name: string) {
  const index = name.indexOf(query.value)
  return index < 0 ? [name, '', ''] : [name.slice(0, index), name.slice(index, index + query.value.length), name.slice(index + query.value.length)]
}
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => { disposed = true; cancel(); document.removeEventListener('pointerdown', outside) })
</script>

<template>
  <form ref="root" class="home-search" role="search" aria-label="팝업 빠른 검색" @submit.prevent="submit" @focusout="focusout">
    <label class="home-search__field">
      <Search :size="20" aria-hidden="true" class="home-search__icon" />
      <input ref="input" v-model="text" type="search" aria-label="팝업 이름 검색" placeholder="성수, 브랜드, 팝업 이름으로 검색" class="home-search__input" autocomplete="off" role="combobox" aria-autocomplete="list" :aria-expanded="show" :aria-controls="show ? listId : undefined" :aria-activedescendant="show && activeIndex >= 0 ? optionId(activeIndex) : undefined" :aria-invalid="Array.from(query).length > 100 || undefined" @focus="reopen" @click="reopen" @keydown="keydown" @compositionstart="composing = true" @compositionend="composing = false">
    </label>
    <button type="submit" class="home-search__button">검색</button>
    <div v-if="show" class="home-search__dropdown">
      <p v-if="state === 'loading'" class="home-search__state" role="status"><LoaderCircle :size="16" class="home-search__spinner" aria-hidden="true" />검색 중입니다.</p>
      <p v-else-if="state === 'error'" class="home-search__state" role="alert">검색 중 문제가 발생했어요.</p>
      <p v-else-if="state === 'success' && !results.length" class="home-search__state" role="status">검색 결과가 없어요.</p>
      <ul :id="listId" role="listbox" aria-label="팝업 검색 결과" :aria-busy="state === 'loading'" :hidden="state !== 'success' || !results.length">
        <li v-for="(popup, index) in results" :key="popup.id" role="presentation">
          <NuxtLink :id="optionId(index)" :to="`/places/${encodeURIComponent(popup.id)}`" :prefetch="false" role="option" :aria-selected="activeIndex === index" tabindex="-1" class="home-search__result" :class="{ 'is-active': activeIndex === index }" @pointermove="activeIndex = index" @pointerdown.prevent @click="close">
            <Search :size="18" aria-hidden="true" class="home-search__result-icon" />
            <span class="home-search__result-copy"><span class="home-search__name">{{ nameParts(popup.name)[0] }}<mark v-if="nameParts(popup.name)[1]">{{ nameParts(popup.name)[1] }}</mark>{{ nameParts(popup.name)[2] }}</span><span class="home-search__address">{{ [popup.regionName, popup.address].filter(Boolean).join(' · ') }}</span></span>
          </NuxtLink>
        </li>
      </ul>
    </div>
    <p v-if="Array.from(query).length > 100" class="home-search__validation" role="status">검색어는 100자 이하로 입력해 주세요.</p>
  </form>
</template>

<style scoped>
.home-search { position: relative; z-index: 30; display: flex; align-items: center; gap: 8px; flex: 0 0 48px; width: 100%; height: 48px; }
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
