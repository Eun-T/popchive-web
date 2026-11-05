<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import useEmblaCarousel from 'embla-carousel-vue'
import type { PopupVenuesResponse } from '../../../shared/types/venues'
import { endingSoonToday } from '#shared/utils/endingSoon'
import { venuePath } from '#shared/utils/venueRoutes'

const props = defineProps<{ active: boolean }>()
const { data, status, error, refresh } = await useFetch<PopupVenuesResponse>('/api/places/venues', {
  key: 'places:venues:ko', server: true, dedupe: 'defer', retry: 0,
})
const venues = computed(() => data.value?.venues ?? [])
const failedImages = ref(new Set<string>())
const [viewport, embla] = useEmblaCarousel({ align: 'start', slidesToScroll: 1, loop: false, containScroll: 'trimSnaps' })
const canPrev = ref(false)
const canNext = ref(false)
let timer: ReturnType<typeof setInterval> | undefined
let lastRecovery = 0

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
watch(() => props.active, async active => {
  if (!active) return
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
            <NuxtLink :to="venuePath(venue.venueId)" :prefetch="false" class="places-venues__card" :aria-label="`${venue.name}, 팝업 ${venue.popupCount}개 보기`" draggable="false">
              <span class="places-venues__image">
                <img v-if="venue.imageUrl && !failedImages.has(venue.imageUrl)" :src="venue.imageUrl" alt="" width="620" height="400" loading="lazy" decoding="async" draggable="false" @error="onVenueImageError(venue.imageUrl)">
                <span v-else class="places-venues__image-state">{{ venue.imageUrl ? '이미지를 불러올 수 없습니다.' : '등록된 대표 이미지가 없습니다.' }}</span>
                <span class="places-venues__badge">팝업 {{ venue.popupCount }}개</span>
              </span>
              <span class="places-venues__name">{{ venue.name }}</span>
              <span class="places-venues__address">{{ venue.address }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
      <div v-show="canPrev || canNext">
        <button type="button" class="places-venues__arrow places-venues__arrow--prev" :disabled="!canPrev" aria-label="이전 장소 보기" @click="scroll('prev')"><ChevronLeft :size="20" aria-hidden="true" /></button>
        <button type="button" class="places-venues__arrow places-venues__arrow--next" :disabled="!canNext" aria-label="다음 장소 보기" @click="scroll('next')"><ChevronRight :size="20" aria-hidden="true" /></button>
      </div>
    </div>
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
@media (width >= 768px) {
  .places-venues__slide { flex-basis: calc((100% - 32px) / 3); }
  .places-venues__skeleton:not(:first-of-type) { display: block; }
}
</style>
