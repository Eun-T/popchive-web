<script setup lang="ts">
import { ChevronLeft, ChevronRight, X } from '@lucide/vue'
import useEmblaCarousel from 'embla-carousel-vue'
import type { PopupVenue, PopupVenuesResponse, VenuePopupsResponse } from '../../../shared/types/venues'
import { endingSoonToday } from '#shared/utils/endingSoon'
import { formatPopupCardPeriod } from '~/utils/formatPopupCardPeriod'

const props = defineProps<{ active: boolean }>()
const { data, status, error, refresh } = await useFetch<PopupVenuesResponse>('/api/places/venues', {
  key: 'places:venues:ko', server: true, dedupe: 'defer', retry: 0,
})
const venues = computed(() => data.value?.venues ?? [])
const failedImages = ref(new Set<string>())
const [viewport, embla] = useEmblaCarousel({ align: 'start', slidesToScroll: 1, loop: false, containScroll: 'trimSnaps' })
const canPrev = ref(false)
const canNext = ref(false)
const dialog = ref<HTMLDialogElement | null>(null)
const selected = shallowRef<PopupVenue | null>(null)
const popupData = shallowRef<VenuePopupsResponse | null>(null)
const popupState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const popupCache = new Map<string, VenuePopupsResponse>()
let request: AbortController | undefined
let requestVersion = 0
let trigger: HTMLElement | null = null
let timer: ReturnType<typeof setInterval> | undefined
let lastRecovery = 0
let disposed = false

function syncControls() {
  canPrev.value = embla.value?.canScrollPrev() ?? false
  canNext.value = embla.value?.canScrollNext() ?? false
}
watch(embla, (api, _, onCleanup) => {
  if (!api) return
  syncControls()
  api.on('select', syncControls).on('reInit', syncControls)
  onCleanup(() => { api.off('select', syncControls).off('reInit', syncControls) })
}, { immediate: true })
function scroll(direction: 'prev' | 'next') {
  const jump = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (direction === 'prev') embla.value?.scrollPrev(jump)
  else embla.value?.scrollNext(jump)
}
function refreshIfStale() {
  if (!props.active || document.hidden || status.value === 'pending' || !data.value) return
  if (data.value.asOf !== endingSoonToday() || Date.now() - data.value.fetchedAt >= 180_000) void refresh()
}
function onVenueImageError(src: string) {
  failedImages.value.add(src)
  if (!props.active || status.value === 'pending' || !data.value || Date.now() - data.value.fetchedAt < 60_000
    || Date.now() - lastRecovery < 60_000) return
  lastRecovery = Date.now()
  void refresh()
}
async function loadSelected() {
  const venue = selected.value
  if (!venue) return
  request?.abort()
  const version = ++requestVersion
  popupData.value = null
  popupState.value = 'loading'
  const cached = popupCache.get(venue.venueId)
  if (cached && cached.asOf === endingSoonToday() && Date.now() - cached.fetchedAt < 30_000) {
    popupData.value = cached
    popupState.value = 'ready'
    return
  }
  const controller = new AbortController()
  request = controller
  try {
    const result = await $fetch<VenuePopupsResponse>('/api/places/venues', {
      query: { venueId: venue.venueId }, signal: controller.signal, timeout: 15_000, retry: 0, credentials: 'omit',
    })
    if (disposed || controller.signal.aborted || version !== requestVersion) return
    popupCache.set(venue.venueId, result)
    popupData.value = result
    popupState.value = 'ready'
  } catch {
    if (!disposed && !controller.signal.aborted && version === requestVersion) popupState.value = 'error'
  }
}
async function openVenue(venue: PopupVenue, event: MouseEvent) {
  trigger = event.currentTarget as HTMLElement
  selected.value = venue
  await nextTick()
  if (disposed) return
  dialog.value?.showModal()
  void loadSelected()
}
function closeVenue() { dialog.value?.close() }
function onDialogClose() {
  request?.abort()
  ++requestVersion
  selected.value = null
  popupData.value = null
  popupState.value = 'idle'
  if (!disposed && trigger?.isConnected) trigger.focus({ preventScroll: true })
}
watch(() => props.active, async active => {
  if (!active) { closeVenue(); return }
  refreshIfStale()
  await nextTick()
  embla.value?.reInit()
  syncControls()
})
onMounted(() => {
  refreshIfStale()
  timer = setInterval(refreshIfStale, 30_000)
  document.addEventListener('visibilitychange', refreshIfStale)
  window.addEventListener('pageshow', refreshIfStale)
})
onBeforeUnmount(() => {
  disposed = true
  request?.abort()
  dialog.value?.close()
  clearInterval(timer)
  document.removeEventListener('visibilitychange', refreshIfStale)
  window.removeEventListener('pageshow', refreshIfStale)
})
</script>

<template>
  <section class="places-venues" aria-labelledby="places-venues-title">
    <h2 id="places-venues-title">여기서 열리는 팝업</h2>
    <p v-if="error && !venues.length" class="places-venues__state" role="alert">장소 정보를 불러오지 못했습니다.</p>
    <div v-else-if="status === 'pending' && !data" class="places-venues__loading" role="status">
      <span class="sr-only">장소 정보를 불러오는 중입니다.</span>
      <div v-for="index in 3" :key="index" class="places-venues__skeleton" />
    </div>
    <p v-else-if="!venues.length" class="places-venues__state" role="status">현재 팝업이 열리는 등록 장소가 없습니다.</p>
    <div v-else class="places-venues__carousel">
      <div ref="viewport" class="places-venues__viewport" tabindex="0" role="region" aria-label="팝업이 열리는 장소 목록, 좌우 방향키로 탐색" @keydown.left.prevent="scroll('prev')" @keydown.right.prevent="scroll('next')">
        <ul class="places-venues__track">
          <li v-for="venue in venues" :key="venue.venueId" class="places-venues__slide">
            <button type="button" class="places-venues__card" aria-haspopup="dialog" :aria-label="`${venue.name}, 팝업 ${venue.popupCount}개 보기`" @click="openVenue(venue, $event)">
              <span class="places-venues__image">
                <img v-if="venue.imageUrl && !failedImages.has(venue.imageUrl)" :src="venue.imageUrl" alt="" width="620" height="400" loading="lazy" decoding="async" draggable="false" @error="onVenueImageError(venue.imageUrl)">
                <span v-else class="places-venues__image-state">{{ venue.imageUrl ? '이미지를 불러올 수 없습니다.' : '등록된 대표 이미지가 없습니다.' }}</span>
                <span class="places-venues__badge">팝업 {{ venue.popupCount }}개</span>
              </span>
              <span class="places-venues__name">{{ venue.name }}</span>
              <span class="places-venues__address">{{ venue.address }}</span>
            </button>
          </li>
        </ul>
      </div>
      <div v-show="canPrev || canNext">
        <button type="button" class="places-venues__arrow places-venues__arrow--prev" :disabled="!canPrev" aria-label="이전 장소 보기" @click="scroll('prev')"><ChevronLeft :size="20" aria-hidden="true" /></button>
        <button type="button" class="places-venues__arrow places-venues__arrow--next" :disabled="!canNext" aria-label="다음 장소 보기" @click="scroll('next')"><ChevronRight :size="20" aria-hidden="true" /></button>
      </div>
    </div>

    <dialog ref="dialog" class="venue-dialog" aria-labelledby="venue-dialog-title" @close="onDialogClose" @click.self="closeVenue">
      <header class="venue-dialog__header">
        <div><h2 id="venue-dialog-title">{{ selected?.name }}</h2><p>{{ selected?.address }}</p></div>
        <button type="button" class="venue-dialog__close" aria-label="장소 팝업 목록 닫기" @click="closeVenue"><X :size="20" aria-hidden="true" /></button>
      </header>
      <p v-if="popupState === 'loading'" class="venue-dialog__state" role="status">팝업을 불러오는 중입니다.</p>
      <div v-else-if="popupState === 'error'" class="venue-dialog__state" role="alert"><p>이 장소의 팝업을 불러오지 못했습니다.</p><button type="button" class="venue-dialog__retry" @click="loadSelected">다시 시도</button></div>
      <template v-else-if="popupState === 'ready' && popupData">
        <p class="venue-dialog__count">팝업 {{ popupData.popupCount }}개</p>
        <p v-if="!popupData.popups.length" class="venue-dialog__state" role="status">현재 이 장소에서 열리는 팝업이 없습니다.</p>
        <ul v-else class="venue-dialog__list">
          <li v-for="popup in popupData.popups" :key="popup.publicId">
            <NuxtLink :to="`/places/${encodeURIComponent(popup.publicId)}`" class="venue-dialog__popup" @click="closeVenue">
              <span class="venue-dialog__poster"><img v-if="popup.coverImageUrl && !failedImages.has(popup.coverImageUrl)" :src="popup.coverImageUrl" alt="" width="80" height="100" loading="lazy" draggable="false" @error="failedImages.add(popup.coverImageUrl)"><span v-else>이미지 없음</span></span>
              <span><strong>{{ popup.name }}</strong><span class="venue-dialog__period">{{ formatPopupCardPeriod(`${popup.startDate} ~ ${popup.endDate ?? '종료일 미정'}`) }}</span></span>
            </NuxtLink>
          </li>
        </ul>
      </template>
    </dialog>
  </section>
</template>

<style scoped>
.places-venues { width: 100%; min-width: 0; margin-top: 40px; color: var(--ds-text); }
.places-venues > h2 { margin-bottom: 20px; font-size: 20px; font-weight: 700; line-height: 28px; }
.places-venues__carousel { position: relative; }
.places-venues__viewport { overflow: hidden; touch-action: pan-y pinch-zoom; outline-offset: -3px; }
.places-venues__track { display: flex; gap: 16px; margin: 0; padding: 0; list-style: none; }
.places-venues__slide { flex: 0 0 100%; min-width: 0; }
.places-venues__card { display: block; width: 100%; border: 0; background: transparent; text-align: left; color: inherit; cursor: pointer; }
.places-venues__card:focus-visible { outline: 2px solid var(--ds-text); outline-offset: -3px; border-radius: 12px; }
.places-venues__image { position: relative; display: block; overflow: hidden; width: 100%; aspect-ratio: 1.55; border-radius: 12px; background: var(--ds-tag); }
.places-venues__image img { display: block; width: 100%; height: 100%; object-fit: cover; user-select: none; }
.places-venues__image-state { position: absolute; inset: 0; display: grid; place-items: center; padding: 20px; color: var(--ds-secondary); font-size: 13px; text-align: center; }
.places-venues__badge { position: absolute; top: 12px; right: 12px; padding: 4px 10px; border-radius: 999px; background: rgb(17 24 39 / 75%); color: #fff; font-size: 13px; line-height: 20px; }
.places-venues__name { display: block; overflow: hidden; margin-top: 12px; font-size: 16px; font-weight: 600; line-height: 24px; text-overflow: ellipsis; white-space: nowrap; }
.places-venues__address { display: block; overflow: hidden; margin-top: 4px; color: var(--ds-secondary); font-size: 13px; font-weight: 400; line-height: 20px; text-overflow: ellipsis; white-space: nowrap; }
.places-venues__arrow { position: absolute; top: calc((100% - 60px) / 2); display: grid; place-items: center; width: 36px; height: 36px; transform: translateY(-50%); border-radius: 50%; background: rgb(255 255 255 / 90%); color: var(--ds-text); box-shadow: 0 1px 4px #0003; }
.places-venues__arrow:disabled { opacity: 0.4; cursor: default; }
.places-venues__arrow--prev { left: 8px; }
.places-venues__arrow--next { right: 8px; }
.places-venues__state { padding-block: 24px; color: var(--ds-secondary); font-size: 14px; }
.places-venues__loading { display: flex; gap: 16px; }
.places-venues__skeleton { flex: 1; aspect-ratio: 1.55; border-radius: 12px; background: var(--ds-tag); }
.places-venues__skeleton:not(:first-of-type) { display: none; }
.venue-dialog { width: min(840px, calc(100vw - 32px)); max-height: 85dvh; margin: auto; padding: 24px; overflow: auto; border: 0; border-radius: 16px; background: var(--ds-background); color: var(--ds-text); }
.venue-dialog::backdrop { background: rgb(0 0 0 / 40%); }
.venue-dialog__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.venue-dialog__header h2 { font-size: 20px; font-weight: 700; line-height: 28px; }
.venue-dialog__header p { margin-top: 6px; color: var(--ds-secondary); font-size: 13px; line-height: 20px; }
.venue-dialog__close { display: grid; place-items: center; flex: 0 0 36px; width: 36px; height: 36px; border-radius: 50%; background: var(--ds-tag); }
.venue-dialog__state { padding-block: 24px; color: var(--ds-secondary); font-size: 14px; }
.venue-dialog__retry { margin-top: 12px; padding: 8px 12px; border: 1px solid var(--ds-border); border-radius: 8px; color: var(--ds-text); }
.venue-dialog__count { margin-bottom: 16px; font-size: 14px; }
.venue-dialog__list { display: grid; gap: 20px; margin: 0; padding: 0; list-style: none; }
.venue-dialog__popup { display: flex; align-items: center; gap: 12px; min-width: 0; }
.venue-dialog__popup > span:last-child { min-width: 0; }
.venue-dialog__popup strong { display: block; font-size: 16px; font-weight: 600; line-height: 24px; overflow-wrap: anywhere; }
.venue-dialog__poster { display: grid; place-items: center; flex: 0 0 80px; width: 80px; height: 100px; overflow: hidden; border-radius: 8px; background: var(--ds-tag); color: var(--ds-secondary); font-size: 12px; }
.venue-dialog__poster img { width: 100%; height: 100%; object-fit: cover; }
.venue-dialog__period { display: block; margin-top: 6px; color: var(--ds-secondary); font-size: 13px; line-height: 20px; }
@media (width >= 768px) {
  .places-venues__slide { flex-basis: calc((100% - 32px) / 3); }
  .places-venues__skeleton:not(:first-of-type) { display: block; }
  .venue-dialog__list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
