<script setup lang="ts">
import { formatPopupCardPeriod } from '~/utils/formatPopupCardPeriod'
import { ref, watch } from 'vue'
import useEmblaCarousel from 'embla-carousel-vue'
import { ChevronLeft, ChevronRight, Heart } from '@lucide/vue'
import { webFeatures } from '~/config/features'
import type { HomePopupCard } from '../../../shared/types/home'

withDefaults(defineProps<{ items: readonly HomePopupCard[]; loading?: boolean; error?: boolean; showFavorite?: boolean }>(), { showFavorite: true })
const emit = defineEmits<{ 'image-error': [] }>()
const failedSources = ref(new Set<string>())
function onImageError(src: string | null) {
  if (!src) return
  failedSources.value.add(src)
  emit('image-error')
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
  <section class="hot-ranking" aria-labelledby="hot-ranking-title">
    <div class="hot-ranking__header">
      <div class="hot-ranking__heading">
        <h2 id="hot-ranking-title">지금 핫한 팝업</h2>
        <span class="hot-ranking__badge">TOP 10</span>
      </div>
    </div>

    <p v-if="error" class="hot-ranking__state" role="alert">지금 핫한 팝업을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
    <p v-else-if="loading" class="hot-ranking__state" role="status">팝업을 불러오는 중입니다.</p>
    <p v-else-if="!items.length" class="hot-ranking__state" role="status">현재 선정된 팝업이 없습니다.</p>
    <div v-else class="hot-ranking__carousel">
      <div
        ref="emblaRef"
        class="hot-ranking__viewport"
        tabindex="0"
        role="region"
        aria-label="관리자 선정 인기 팝업 목록, 좌우 방향키로 탐색"
        @keydown.left.prevent="emblaApi?.scrollPrev()"
        @keydown.right.prevent="emblaApi?.scrollNext()"
      >
        <ol class="hot-ranking__track">
          <li v-for="(item, index) in items" :key="item.id" class="hot-ranking__card">
            <div class="hot-ranking__poster">
              <img v-if="item.src && !failedSources.has(item.src)" :src="item.src" :alt="item.alt" width="300" height="400" loading="lazy" draggable="false" @error="onImageError(item.src)">
              <p v-else class="hot-ranking__image-state">이미지를 불러올 수 없습니다.</p>
              <NuxtLink :to="`/places/${encodeURIComponent(item.publicId)}`" class="hot-ranking__detail-link" :aria-label="`${item.title} 상세 보기`" draggable="false" />
              <span class="hot-ranking__rank" :aria-label="`${index + 1}위`">{{ index + 1 }}</span>
              <!-- HomeNewPopups와 같은 비활성 하트 UI. 찜 저장/토글은 추후 구현. -->
              <button v-if="webFeatures.favorites && showFavorite" type="button" disabled class="hot-ranking__favorite" aria-label="찜하기 (준비 중)" title="찜 기능 준비 중">
                <Heart :size="24" :stroke-width="2" fill="#6B7280" aria-hidden="true" />
              </button>
            </div>
            <h3 class="hot-ranking__title"><NuxtLink :to="`/places/${encodeURIComponent(item.publicId)}`" draggable="false">{{ item.title }}</NuxtLink></h3>
            <p class="hot-ranking__period">{{ formatPopupCardPeriod(item.period) }}</p>
          </li>
        </ol>
      </div>
      <button
        v-show="canScrollPrev"
        type="button"
        class="hot-ranking__arrow hot-ranking__arrow--prev"
        aria-label="이전 순위 보기"
        @click="emblaApi?.scrollPrev()"
      >
        <ChevronLeft :size="20" aria-hidden="true" />
      </button>
      <button
        v-show="canScrollNext"
        type="button"
        class="hot-ranking__arrow hot-ranking__arrow--next"
        aria-label="다음 순위 보기"
        @click="emblaApi?.scrollNext()"
      >
        <ChevronRight :size="20" aria-hidden="true" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.hot-ranking__detail-link { position: absolute; inset: 0; border-radius: inherit; }
.hot-ranking__detail-link:focus-visible { outline-offset: -3px; }
.hot-ranking {
  width: 100%;
  max-width: 826px;
  min-width: 0;
  margin-top: 48px;
  color: #111827;
}
.hot-ranking__header,
.hot-ranking__heading {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hot-ranking__header { justify-content: space-between; }
.hot-ranking__heading h2 {
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;
}
.hot-ranking__badge {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--ds-accent-purple-soft);
  color: var(--ds-accent-purple);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}
.hot-ranking__carousel {
  position: relative;
  margin-top: 20px;
}
.hot-ranking__viewport {
  overflow: hidden;
  touch-action: pan-y pinch-zoom;
  outline-offset: -2px;
}
.hot-ranking__track {
  display: flex;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.hot-ranking__card {
  flex: 0 0 calc((100% - 12px) / 2);
  min-width: 0;
}
.hot-ranking__poster {
  position: relative;
  overflow: hidden;
  aspect-ratio: 3 / 4;
  border-radius: 6px;
  background: #f3f4f6;
}
.hot-ranking__poster img {
  display: block;
  width: 100%;
  height: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  user-select: none;
}
.hot-ranking__rank {
  position: absolute;
  top: 12px;
  left: 12px;
  color: #FFFFFF;
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
  text-shadow:
    0 4px 12px rgba(0, 0, 0, 0.8);
  pointer-events: none;
}
.hot-ranking__favorite {
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
.hot-ranking__favorite :deep(svg) { filter: drop-shadow(0 1px 2px rgb(0 0 0 / 25%)); }
.hot-ranking__favorite[aria-pressed='true'] {
  color: var(--ds-accent-purple);
}
.hot-ranking__favorite[aria-pressed='true'] :deep(svg) { fill: currentColor; }
.hot-ranking__title {
  overflow: hidden;
  min-width: 0;
  margin-top: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}
.hot-ranking__period {
  margin-top: 2px;
  color: #6b7280;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
}
.hot-ranking__arrow {
  position: absolute;
  /* 제목/기간 영역 62px을 제외한 포스터의 세로 중앙. */
  top: calc((100% - 62px) / 2);
  transform: translateY(-50%);
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: rgba(25, 28, 35, 0.75);
  color: #fff;
  box-shadow: none;
  transition: opacity 200ms ease;
  cursor: pointer;
}
.hot-ranking__arrow--prev { left: 4px; }
.hot-ranking__arrow--next { right: 4px; }
.hot-ranking__state {
  margin-top: 20px;
  color: #6b7280;
  font-size: 14px;
}
.hot-ranking__image-state {
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
.hot-ranking__viewport:focus-visible,
.hot-ranking__arrow:focus-visible {
  outline: 2px solid #111827;
}
@media (min-width: 768px) {
  .hot-ranking__card { flex-basis: calc((100% - 24px) / 3); }
  .hot-ranking__arrow { display: flex; }
}
@media (min-width: 768px) and (hover: hover) and (pointer: fine) {
  .hot-ranking__arrow { opacity: 0; pointer-events: none; }
  .hot-ranking__carousel:hover .hot-ranking__arrow,
  .hot-ranking__carousel:focus-within .hot-ranking__arrow {
    opacity: 1;
    pointer-events: auto;
  }
}
@media (min-width: 1120px) {
  .hot-ranking__card { flex-basis: calc((100% - 36px) / 4); }
}
@media (prefers-reduced-motion: reduce) {
  .hot-ranking__arrow { transition: none; }
}
</style>
