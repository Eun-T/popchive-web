<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import useEmblaCarousel from 'embla-carousel-vue'
import type { EndingSoonResponse } from '../../../shared/types/endingSoon'
import { endingSoonToday } from '#shared/utils/endingSoon'
import { formatPopupCardPeriod } from '~/utils/formatPopupCardPeriod'

const props = defineProps<{ active: boolean }>()
const { data, status, error, refresh } = await useFetch<EndingSoonResponse>('/api/places/ending-soon', {
  key: 'places:ending-soon:KR-JP:ko', server: true, dedupe: 'defer', retry: 0,
})
const items = computed(() => data.value?.items ?? [])
const failedImages = ref(new Set<string>())
const [viewport, embla] = useEmblaCarousel({
  align: 'start', slidesToScroll: 1, loop: false, dragFree: false, containScroll: 'trimSnaps',
})
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
function onImageError(src: string) {
  failedImages.value.add(src)
  // Existing signed poster URLs expire after 5 minutes. Recover once, not per card.
  if (!props.active || status.value === 'pending' || !data.value || Date.now() - data.value.fetchedAt < 60_000
    || Date.now() - lastRecovery < 60_000) return
  lastRecovery = Date.now()
  void refresh()
}
watch(() => props.active, async active => {
  if (!active) return
  refreshIfStale()
  // The parent uses v-show: remeasure after the previously hidden panel is visible.
  await nextTick()
  embla.value?.reInit()
  syncControls()
})
onMounted(() => {
  // No unconditional mount fetch: reuse the SSR payload, including an empty list.
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
  <section class="ending-soon" aria-labelledby="ending-soon-title">
    <header class="ending-soon__header">
      <h2 id="ending-soon-title">곧 끝나요</h2>
      <p>종료가 가까운 팝업을 모았어요!</p>
    </header>
    <p v-if="error && !items.length" class="ending-soon__state" role="alert">곧 끝나는 팝업을 불러오지 못했습니다.</p>
    <div v-else-if="status === 'pending' && !data" class="ending-soon__loading" role="status">
      <span class="sr-only">곧 끝나는 팝업을 불러오는 중입니다.</span>
      <div class="ending-soon__skeleton" /><div class="ending-soon__skeleton ending-soon__skeleton--second" />
    </div>
    <p v-else-if="!items.length" class="ending-soon__state" role="status">곧 종료되는 팝업이 없습니다.</p>
    <div v-else class="ending-soon__carousel">
      <div
        ref="viewport" class="ending-soon__viewport" tabindex="0" role="region"
        aria-label="곧 끝나는 팝업 목록, 좌우 방향키로 탐색"
        @keydown.left.prevent="scroll('prev')" @keydown.right.prevent="scroll('next')"
      >
        <ul class="ending-soon__track">
          <li v-for="popup in items" :key="popup.publicId" class="ending-soon__slide">
            <NuxtLink :to="`/places/${encodeURIComponent(popup.publicId)}`" class="ending-soon__card" draggable="false">
              <img
                v-if="popup.coverImageUrl && !failedImages.has(popup.coverImageUrl)"
                :src="popup.coverImageUrl" alt="" width="750" height="500" loading="lazy" decoding="async"
                draggable="false" @error="onImageError(popup.coverImageUrl)"
              >
              <span v-else class="ending-soon__image-state">{{ popup.coverImageUrl ? '이미지를 불러올 수 없습니다.' : '등록된 이미지가 없습니다.' }}</span>
              <div class="ending-soon__gradient" aria-hidden="true" />
              <div class="ending-soon__caption">
                <span class="ending-soon__badge">{{ popup.daysLeft === 0 ? 'D-DAY' : `D-${popup.daysLeft}` }}</span>
                <h3>{{ popup.name }}</h3>
                <p>{{ formatPopupCardPeriod(`${popup.startDate} ~ ${popup.endDate}`) }}</p>
              </div>
            </NuxtLink>
          </li>
        </ul>
      </div>
      <div v-show="canPrev || canNext">
        <button type="button" class="ending-soon__arrow ending-soon__arrow--prev" :disabled="!canPrev" aria-label="이전 팝업 보기" @click="scroll('prev')">
          <ChevronLeft :size="20" aria-hidden="true" />
        </button>
        <button type="button" class="ending-soon__arrow ending-soon__arrow--next" :disabled="!canNext" aria-label="다음 팝업 보기" @click="scroll('next')">
          <ChevronRight :size="20" aria-hidden="true" />
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ending-soon { width: 100%; min-width: 0; }
.ending-soon__header { margin-bottom: 20px; }
.ending-soon__header h2 { color: var(--ds-text); font-size: 20px; font-weight: 700; line-height: 28px; }
.ending-soon__header p { margin-top: 6px; color: var(--ds-secondary); font-size: 14px; line-height: 20px; }
.ending-soon__carousel { position: relative; }
.ending-soon__viewport { overflow: hidden; touch-action: pan-y pinch-zoom; outline-offset: -3px; }
.ending-soon__track { display: flex; gap: 16px; margin: 0; padding: 0; list-style: none; }
.ending-soon__slide { flex: 0 0 100%; min-width: 0; }
.ending-soon__card { position: relative; display: block; overflow: hidden; aspect-ratio: 5 / 4; border-radius: 16px; background: #374151; color: #fff; }
.ending-soon__card:focus-visible { outline: 2px solid #fff; outline-offset: -4px; }
.ending-soon__card img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; user-select: none; }
.ending-soon__gradient { position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 15%, rgb(0 0 0 / 15%) 35%, rgb(0 0 0 / 85%) 100%); pointer-events: none; }
.ending-soon__caption { position: absolute; right: 20px; bottom: 20px; left: 20px; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.ending-soon__badge { padding: 3px 8px; border: 1px solid rgb(255 255 255 / 50%); border-radius: 6px; background: rgb(255 255 255 / 16%); font-size: 12px; font-weight: 700; line-height: 18px; }
.ending-soon__caption h3 { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; font-size: 18px; font-weight: 700; line-height: 24px; overflow-wrap: anywhere; }
.ending-soon__caption p { font-size: 13px; line-height: 20px; color: rgb(255 255 255 / 90%); }
.ending-soon__arrow { position: absolute; top: 50%; display: grid; place-items: center; width: 36px; height: 36px; transform: translateY(-50%); border-radius: 50%; background: rgb(255 255 255 / 90%); color: #111827; box-shadow: 0 1px 4px #0003; }
.ending-soon__arrow:disabled { opacity: 0.4; cursor: default; }
.ending-soon__arrow--prev { left: 8px; }
.ending-soon__arrow--next { right: 8px; }
.ending-soon__arrow:focus-visible, .ending-soon__viewport:focus-visible { outline: 2px solid var(--ds-text); }
.ending-soon__state { padding-block: 32px; color: var(--ds-secondary); font-size: 14px; }
.ending-soon__image-state { position: absolute; inset: 0; display: grid; place-items: center; padding: 24px; color: #fff; font-size: 13px; text-align: center; }
.ending-soon__loading { display: flex; gap: 16px; }
.ending-soon__skeleton { flex: 1; aspect-ratio: 5 / 4; border-radius: 16px; background: var(--ds-tag); }
.ending-soon__skeleton--second { display: none; }
@media (width >= 768px) {
  .ending-soon__slide { flex-basis: calc((100% - 16px) / 2); }
  .ending-soon__card, .ending-soon__skeleton { aspect-ratio: 3 / 2; }
  .ending-soon__skeleton--second { display: block; }
}
</style>
