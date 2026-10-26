<script setup lang="ts">
import { formatPopupCardPeriod } from '~/utils/formatPopupCardPeriod'
import { ref, watch } from 'vue'
import useEmblaCarousel from 'embla-carousel-vue'
import { ChevronLeft, ChevronRight, Heart } from '@lucide/vue'

type JapanPopupItem = {
  id: string
  title: string
  image: string | null
  startDate: string
  endDate: string
}

// UI-only fixtures, not real events. Replace this array with API data later.
// No verified Japan posters are available locally, so use explicit placeholders.
const japanPopupItems: readonly JapanPopupItem[] = [
  { id: 'japan-mock-1', title: '[목업] 도쿄 문구 팝업', image: null, startDate: '2026-11-01', endDate: '2026-11-15' },
  { id: 'japan-mock-2', title: '[목업] 오사카 디저트 팝업', image: null, startDate: '2026-11-03', endDate: '2026-11-17' },
  { id: 'japan-mock-3', title: '[목업] 교토 공예 팝업', image: null, startDate: '2026-11-05', endDate: '2026-11-19' },
  { id: 'japan-mock-4', title: '[목업] 후쿠오카 라이프스타일 팝업', image: null, startDate: '2026-11-07', endDate: '2026-11-21' },
  { id: 'japan-mock-5', title: '[목업] 요코하마 캐릭터 팝업', image: null, startDate: '2026-11-09', endDate: '2026-11-23' },
  { id: 'japan-mock-6', title: '[목업] 나고야 패션 팝업', image: null, startDate: '2026-11-11', endDate: '2026-11-25' },
  { id: 'japan-mock-7', title: '[목업] 고베 커피 팝업', image: null, startDate: '2026-11-13', endDate: '2026-11-27' },
  { id: 'japan-mock-8', title: '[목업] 삿포로 윈터 마켓', image: null, startDate: '2026-11-15', endDate: '2026-11-30' },
]

function formatPeriod(item: JapanPopupItem) {
  return formatPopupCardPeriod(`${item.startDate} ~ ${item.endDate}`)
}

const failedSources = ref(new Set<string>())
function onImageError(image: string | null) {
  if (image) failedSources.value.add(image)
}

const [emblaRef, emblaApi] = useEmblaCarousel({
  align: 'start',
  slidesToScroll: 1,
  loop: false,
  dragFree: false,
  skipSnaps: true,
  containScroll: 'trimSnaps',
})
const canScrollPrev = ref(false)
const canScrollNext = ref(false)

watch(emblaApi, (api, _, onCleanup) => {
  if (!api) return
  const syncArrows = () => {
    canScrollPrev.value = api.canScrollPrev()
    canScrollNext.value = api.canScrollNext()
  }
  syncArrows()
  api.on('select', syncArrows).on('reInit', syncArrows)
  onCleanup(() => {
    api.off('select', syncArrows).off('reInit', syncArrows)
  })
}, { immediate: true })
</script>

<template>
  <section class="japan-new-popups" aria-labelledby="japan-new-popups-title">
    <div class="japan-new-popups__header">
      <div class="japan-new-popups__heading">
        <h2 id="japan-new-popups-title">일본 신상 팝업</h2>
      </div>
    </div>

    <div class="japan-new-popups__carousel">
      <div
        ref="emblaRef"
        class="japan-new-popups__viewport"
        tabindex="0"
        role="region"
        aria-label="일본 신상 팝업 목데이터 목록, 좌우 방향키로 탐색"
        @keydown.left.prevent="emblaApi?.scrollPrev()"
        @keydown.right.prevent="emblaApi?.scrollNext()"
      >
        <ul class="japan-new-popups__track">
          <li v-for="item in japanPopupItems" :key="item.id" class="japan-new-popups__card">
            <div class="japan-new-popups__poster">
              <img v-if="item.image && !failedSources.has(item.image)" :src="item.image" :alt="`${item.title} 임시 포스터`" width="300" height="400" loading="lazy" draggable="false" @error="onImageError(item.image)">
              <p v-else class="japan-new-popups__image-state">{{ item.image ? '이미지를 불러올 수 없습니다.' : '임시 이미지' }}</p>
              <NuxtLink :to="`/places/${encodeURIComponent(item.id)}`" class="japan-new-popups__detail-link" :aria-label="`${item.title} 상세 보기`" draggable="false" />
              <button type="button" disabled class="japan-new-popups__favorite" aria-label="찜하기 (준비 중)" title="찜 기능 준비 중">
                <Heart :size="24" :stroke-width="2" fill="#6B7280" aria-hidden="true" />
              </button>
            </div>
            <h3 class="japan-new-popups__title"><NuxtLink :to="`/places/${encodeURIComponent(item.id)}`" draggable="false">{{ item.title }}</NuxtLink></h3>
            <p class="japan-new-popups__period">{{ formatPeriod(item) }}</p>
          </li>
        </ul>
      </div>
      <button
        v-show="canScrollPrev"
        type="button"
        class="japan-new-popups__arrow japan-new-popups__arrow--prev"
        aria-label="이전 일본 팝업 보기"
        @click="emblaApi?.scrollPrev()"
      >
        <ChevronLeft :size="20" aria-hidden="true" />
      </button>
      <button
        v-show="canScrollNext"
        type="button"
        class="japan-new-popups__arrow japan-new-popups__arrow--next"
        aria-label="다음 일본 팝업 보기"
        @click="emblaApi?.scrollNext()"
      >
        <ChevronRight :size="20" aria-hidden="true" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.japan-new-popups__detail-link { position: absolute; inset: 0; border-radius: inherit; }
.japan-new-popups__detail-link:focus-visible { outline-offset: -3px; }
.japan-new-popups {
  width: 100%;
  max-width: 826px;
  min-width: 0;
  margin-top: 48px;
  color: #111827;
}
.japan-new-popups__header,
.japan-new-popups__heading {
  display: flex;
  align-items: center;
  gap: 8px;
}
.japan-new-popups__header { justify-content: space-between; }
.japan-new-popups__heading h2 {
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;
}
.japan-new-popups__carousel {
  position: relative;
  margin-top: 20px;
}
.japan-new-popups__viewport {
  overflow: hidden;
  touch-action: pan-y pinch-zoom;
  outline-offset: -2px;
}
.japan-new-popups__track {
  display: flex;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.japan-new-popups__card {
  flex: 0 0 calc((100% - 12px) / 2);
  min-width: 0;
}
.japan-new-popups__poster {
  position: relative;
  overflow: hidden;
  aspect-ratio: 3 / 4;
  border-radius: 6px;
  background: #f3f4f6;
}
.japan-new-popups__poster img {
  display: block;
  width: 100%;
  height: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  user-select: none;
}
.japan-new-popups__favorite {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #fff;
}
.japan-new-popups__favorite :deep(svg) { filter: drop-shadow(0 1px 2px rgb(0 0 0 / 25%)); }
.japan-new-popups__favorite[aria-pressed='true'] {
  color: var(--ds-accent-purple);
}
.japan-new-popups__favorite[aria-pressed='true'] :deep(svg) { fill: currentColor; }
.japan-new-popups__title {
  overflow: hidden;
  min-width: 0;
  margin-top: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}
.japan-new-popups__period {
  margin-top: 2px;
  color: #6b7280;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
}
.japan-new-popups__arrow {
  position: absolute;
  /* 제목/기간 영역 62px을 제외한 포스터의 세로 중앙. */
  top: calc((100% - 62px) / 2);
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid #e5e7eb;
  border-radius: 50%;
  background: #fff;
  color: #374151;
  cursor: pointer;
}
.japan-new-popups__arrow:hover {
  background: var(--ds-accent-purple);
  color: #fff;
}
.japan-new-popups__arrow--prev { left: 4px; }
.japan-new-popups__arrow--next { right: 4px; }
.japan-new-popups__image-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  color: #6b7280;
  font-size: 13px;
  text-align: center;
}
.japan-new-popups__viewport:focus-visible,
.japan-new-popups__arrow:focus-visible {
  outline: 2px solid #111827;
}
@media (min-width: 768px) {
  .japan-new-popups__card { flex-basis: calc((100% - 24px) / 3); }
}
@media (min-width: 1120px) {
  .japan-new-popups__card { flex-basis: calc((100% - 36px) / 4); }
}
</style>
