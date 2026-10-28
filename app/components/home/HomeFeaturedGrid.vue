<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import useEmblaCarousel from 'embla-carousel-vue'
import type { HomePopupCard } from '../../../shared/types/home'
import { featuredPopupDateLabel, featuredPopupToday } from '~/utils/featuredPopupDate'

const props = defineProps<{ posters: readonly HomePopupCard[] }>()
const emit = defineEmits<{ 'image-error': [] }>()
const today = useState('featured-popup-today', () => featuredPopupToday())
const cards = computed(() => props.posters.slice(0, 3).map(poster => ({
  ...poster, dateLabel: featuredPopupDateLabel(poster.period, today.value),
})))
// Three cycles keep both neighbours available even with only two banners.
// Desktop hides the copies and retains the original grid.
const slides = computed(() => Array.from(
  { length: cards.value.length > 1 ? 3 : 1 },
  (_, copy) => cards.value.map(poster => ({ poster, copy, key: `${poster.id}:${copy}` }))
).flat())
const initialIndex = computed(() => cards.value.length > 1 ? cards.value.length : 0)
const carouselOptions = computed(() => ({
  align: 'center' as const,
  containScroll: false as const,
  loop: cards.value.length > 1,
  startIndex: initialIndex.value,
  slidesToScroll: 1,
  dragFree: false,
  skipSnaps: false,
  breakpoints: {
    '(min-width: 768px)': { active: false },
    '(prefers-reduced-motion: reduce)': { duration: 0 },
  },
}))
const [emblaRef] = useEmblaCarousel(carouselOptions)
let dateTimer: ReturnType<typeof setInterval> | undefined
const failedSources = ref(new Set<string>())
const posterImages = useTemplateRef<HTMLImageElement[]>('posterImages')

function onImageError(src: string | null) {
  if (!src || failedSources.value.has(src)) return
  failedSources.value.add(src)
  emit('image-error')
}

onMounted(() => {
  const updateToday = () => { today.value = featuredPopupToday() }
  updateToday()
  dateTimer = setInterval(updateToday, 60_000)
  // Preserve image recovery when an SSR image fails before hydration.
  for (const image of posterImages.value ?? []) {
    if (image.complete && image.naturalWidth === 0) onImageError(image.getAttribute('src'))
  }
})
onBeforeUnmount(() => clearInterval(dateTimer))
</script>

<template>
  <section ref="emblaRef" class="home-featured-viewport" aria-label="주목할 팝업" :style="{ '--initial-index': initialIndex }">
    <div class="home-featured-grid">
    <article v-for="{ poster, copy, key } in slides" :key="key" class="home-featured-grid__card" :class="{ 'is-copy': copy > 0 }">
      <img
        v-if="poster.src && !failedSources.has(poster.src)"
        ref="posterImages"
        :src="poster.src"
        :alt="poster.alt"
        :width="poster.width"
        :height="poster.height"
        decoding="async"
        draggable="false"
        class="home-featured-grid__image"
        @error="onImageError(poster.src)"
      >
      <p v-else class="home-featured-grid__fallback" role="status">이미지를 불러오지 못했습니다.</p>
      <div class="home-featured-grid__gradient" aria-hidden="true" />
      <div class="home-featured-grid__info">
        <p v-if="poster.dateLabel" class="home-featured-grid__date">{{ poster.dateLabel }}</p>
        <h2 class="home-featured-grid__title">{{ poster.heroTitle?.trim() ? poster.heroTitle : poster.title }}</h2>
      </div>
      <NuxtLink :to="`/places/${encodeURIComponent(poster.publicId)}`" class="home-featured-grid__link" :aria-label="`${poster.title} 상세 보기`" draggable="false" />
    </article>
    </div>
  </section>
</template>

<style scoped>
.home-featured-viewport { min-width: 0; width: 100%; flex-shrink: 0; }
.home-featured-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  width: 100%;
  max-width: 826px;
  min-width: 0;
  margin-inline: auto;
  background: #ffffff;
}
.home-featured-grid__card {
  position: relative;
  min-width: 0;
  aspect-ratio: 4 / 5;
  overflow: hidden;
  border-radius: 8px;
  background: #374151;
  color: #ffffff;
}
.home-featured-grid__card.is-copy { display: none; }
.home-featured-grid__image {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
.home-featured-grid__link { position: absolute; inset: 0; border-radius: inherit; }
.home-featured-grid__link:focus-visible { outline-offset: -3px; }
.home-featured-grid__fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 40px 16px 120px;
  font-size: 13px;
  text-align: center;
}
.home-featured-grid__gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 25%, rgba(0, 0, 0, 0.45) 58%, rgba(0, 0, 0, 0.9) 100%);
  pointer-events: none;
}
.home-featured-grid__info {
  position: absolute;
  inset: auto 0 0;
  padding: clamp(16px, 2vw, 24px);
  padding-bottom: 24px;
  overflow-wrap: anywhere;
}
.home-featured-grid__date {
  margin-bottom: 2px;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  color: rgba(255, 255, 255, 0.85);
}
.home-featured-grid__title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  white-space: pre-wrap;
  font-size: clamp(18px, 2vw, 22px);
  font-weight: 700;
  line-height: 1.35;
}
@media (width < 768px) {
  .home-featured-viewport {
    /* Reveal neighbours in the existing 20px page gutters without resizing cards. */
    width: calc(100% + 40px);
    margin-inline: -20px;
    overflow: hidden;
    touch-action: pan-y pinch-zoom;
  }
  .home-featured-grid {
    --card-width: calc((100% - 56px) / 2);
    display: flex;
    gap: 12px;
    max-width: none;
    touch-action: pan-y pinch-zoom;
    user-select: none;
    /* SSR alignment; Embla's inline transform takes over after mounting. */
    transform: translateX(calc(50% - var(--card-width) / 2 - (var(--card-width) + 12px) * var(--initial-index)));
  }
  .home-featured-grid__card,
  .home-featured-grid__card.is-copy {
    display: block;
    flex: 0 0 var(--card-width);
  }
  .home-featured-grid__card:last-child { margin-inline-end: 12px; }
  .home-featured-grid__image { -webkit-user-drag: none; }
}
@media (width < 480px) {
  .home-featured-grid { --card-width: calc(100% - 40px); }
}
</style>
