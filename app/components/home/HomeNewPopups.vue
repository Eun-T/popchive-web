<script setup lang="ts">
import { formatPopupCardPeriod } from '~/utils/formatPopupCardPeriod'
import { ref } from 'vue'
import useEmblaCarousel from 'embla-carousel-vue'
import { Heart } from '@lucide/vue'
import type { HomePopupCard } from '../../../shared/types/home'

defineProps<{ items: readonly HomePopupCard[]; loading?: boolean; error?: boolean }>()
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
  dragFree: false,
  loop: false,
  containScroll: 'trimSnaps',
})

// Handle horizontal trackpad gestures without intercepting vertical page scroll.
let wheelDistance = 0
let lastWheelSnap = 0
function onWheel(event: WheelEvent) {
  const api = emblaApi.value
  if (!api || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
  event.preventDefault()
  if (event.timeStamp - lastWheelSnap < 180) return
  wheelDistance += event.deltaX * (event.deltaMode === 1 ? 16 : 1)
  if (Math.abs(wheelDistance) < 40) return
  if (wheelDistance > 0) api.scrollNext()
  else api.scrollPrev()
  wheelDistance = 0
  lastWheelSnap = event.timeStamp
}
</script>

<template>
  <section class="new-popups" aria-labelledby="new-popups-title">
    <div class="new-popups__header">
      <h2 id="new-popups-title">새로 올라온 팝업</h2>
    </div>
    <p v-if="error" class="new-popups__state" role="alert">새로 올라온 팝업을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
    <p v-else-if="loading" class="new-popups__state" role="status">팝업을 불러오는 중입니다.</p>
    <p v-else-if="!items.length" class="new-popups__state" role="status">현재 새로 올라온 팝업이 없습니다.</p>
    <div
      v-else
      ref="emblaRef"
      class="new-popups__viewport"
      tabindex="0"
      role="region"
      aria-label="새로 올라온 팝업 목록, 좌우 방향키로 탐색"
      @keydown.left.prevent="emblaApi?.scrollPrev()"
      @keydown.right.prevent="emblaApi?.scrollNext()"
      @wheel="onWheel"
    >
      <ul class="new-popups__track">
        <li v-for="item in items" :key="item.id" class="new-popups__card">
          <div class="new-popups__image">
            <img v-if="item.src && !failedSources.has(item.src)" :src="item.src" :alt="item.alt" width="172" height="172" loading="lazy" draggable="false" @error="onImageError(item.src)">
            <p v-else class="new-popups__image-state">이미지를 불러올 수 없습니다.</p>
            <NuxtLink :to="`/places/${encodeURIComponent(item.publicId)}`" class="new-popups__detail-link" :aria-label="`${item.title} 상세 보기`" draggable="false" />
            <button type="button" disabled class="new-popups__favorite" aria-label="찜하기 (준비 중)" title="찜 기능 준비 중">
              <Heart :size="24" :stroke-width="2" fill="#6B7280" aria-hidden="true" />
            </button>
          </div>
          <h3 class="new-popups__title"><NuxtLink :to="`/places/${encodeURIComponent(item.publicId)}`" draggable="false">{{ item.title }}</NuxtLink></h3>
          <p class="new-popups__period">{{ formatPopupCardPeriod(item.period) }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.new-popups__detail-link { position: absolute; inset: 0; border-radius: inherit; }
.new-popups__detail-link:focus-visible { outline-offset: -3px; }
.new-popups {
  width: 100%;
  max-width: 826px;
  min-width: 0;
  margin-top: 52px;
}
.new-popups__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.new-popups__header h2 {
  color: #111827;
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;
}
.new-popups__viewport {
  margin-top: 20px;
  overflow: hidden;
  touch-action: pan-y pinch-zoom;
  outline-offset: -2px;
}
.new-popups__track {
  display: flex;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.new-popups__card {
  flex: 0 0 172px;
  min-width: 0;
}
.new-popups__image {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 8px;
  background: var(--ds-tag);
}
.new-popups__image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
}
.new-popups__favorite {
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
.new-popups__favorite :deep(svg) { filter: drop-shadow(0 1px 2px rgb(0 0 0 / 25%)); }
.new-popups__favorite[aria-pressed='true'] {
  color: var(--ds-accent-purple);
}
.new-popups__favorite[aria-pressed='true'] :deep(svg) { fill: currentColor; }
.new-popups__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  margin-top: 12px;
  color: #111827;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}
.new-popups__period {
  margin-top: 2px;
  color: #6b7280;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
}
.new-popups__state {
  margin-top: 20px;
  color: #6b7280;
  font-size: 14px;
}
.new-popups__image-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 12px;
  color: #6b7280;
  font-size: 13px;
  text-align: center;
}
</style>
