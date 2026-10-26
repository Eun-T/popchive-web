<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import useEmblaCarousel from 'embla-carousel-vue'
import Autoplay from 'embla-carousel-autoplay'
import { MapPin } from '@lucide/vue'
import type { HomePopupCard } from '../../../shared/types/home'

const props = defineProps<{ posters: readonly HomePopupCard[] }>()
const emit = defineEmits<{ 'image-error': [] }>()
// Two display cycles provide enough track length to loop at an 826px viewport.
// The parent/API data stays untouched; indicators and labels use logical indexes.
const displaySlides = computed(() => Array.from(
  { length: props.posters.length > 1 ? 2 : 1 },
  (_, copy) => props.posters.map((poster, logicalIndex) => ({
    poster, logicalIndex, key: `${poster.id}:${copy}`
  }))
).flat())
const initialIndex = computed(() => props.posters.length > 1 ? props.posters.length : 0)
const selectedPhysicalIndex = ref(initialIndex.value)
const selectedIndex = computed(() => displaySlides.value[selectedPhysicalIndex.value]?.logicalIndex ?? 0)
const pageIndexes = computed(() => props.posters.map((_, index) => index))
const segmentWidths: Record<number, number> = { 4: 26, 5: 24, 6: 22, 7: 20, 8: 18, 9: 15 }
const segmentWidth = computed(() => props.posters.length <= 3 ? 28 : (segmentWidths[props.posters.length] ?? 12))
const ready = ref(false)
const reducedMotion = ref(false)
const failedSources = ref(new Set<string>())
function onImageError(src: string | null) {
  if (!src) return
  failedSources.value.add(src)
  emit('image-error')
}
// Reuse the logical active index for every navigation path; background failures never request API refreshes.
const loadedAmbientSources = ref(new Set<string>())
const failedAmbientSources = ref(new Set<string>())
const ambientSrc = computed(() => {
  const src = props.posters[selectedIndex.value]?.src
  return src && !failedSources.value.has(src) && !failedAmbientSources.value.has(src) ? src : null
})
const ambientImage = useTemplateRef<HTMLImageElement>('ambientImage')
function syncAmbientImage(image: HTMLImageElement | null) {
  if (!image?.complete) return
  const src = image.getAttribute('src')
  if (!src) return
  if (image.naturalWidth > 0) loadedAmbientSources.value.add(src)
  else failedAmbientSources.value.add(src)
}
function onAmbientImageEvent(event: Event) {
  syncAmbientImage(event.currentTarget as HTMLImageElement)
}
// Also handle cached SSR images whose load/error event happened before hydration.
watch(ambientImage, syncAmbientImage, { flush: 'post' })

const posterImages = useTemplateRef<HTMLImageElement[]>('posterImages')
const carouselRoot = useTemplateRef<HTMLElement>('carouselRoot')
const autoplay = Autoplay({
  delay: 3000,
  playOnInit: false,
  stopOnInteraction: true,
  stopOnMouseEnter: false,
  stopOnFocusIn: false
})
let mounted = false
let mouseInside = false
let dragging = false

// Keep all pause reasons together so one interaction cannot undo another pause.
function syncAutoplay(restart = false) {
  if (!mounted || !emblaApi.value) return
  const focused = carouselRoot.value?.contains(document.activeElement)
  if (reducedMotion.value || document.hidden || mouseInside || dragging || focused || props.posters.length < 2) {
    autoplay.stop()
  } else if (restart || !autoplay.isPlaying()) {
    autoplay.play()
  }
}

function onPointerEnter(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  mouseInside = true
  syncAutoplay()
}

function onPointerLeave(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return
  mouseInside = false
  syncAutoplay()
}

function onFocusOut() {
  // Wait until focus reaches its next target before checking the entire region.
  queueMicrotask(() => syncAutoplay())
}

const [emblaRef, emblaApi] = useEmblaCarousel({
  align: 'center',
  containScroll: false,
  slidesToScroll: 1,
  dragFree: false,
  skipSnaps: false,
  loop: true,
  startIndex: initialIndex.value
}, [autoplay])

watch(emblaApi, (api, _, onCleanup) => {
  if (!api) return
  const syncSelection = () => {
    selectedPhysicalIndex.value = api.selectedScrollSnap()
  }
  const onReInit = () => {
    syncSelection()
    syncAutoplay()
  }
  const onPointerDown = () => {
    dragging = true
    syncAutoplay()
  }
  const onPointerUp = () => {
    dragging = false
    syncAutoplay(true)
  }
  // Run after the plugin's own visibility handler, including after reInit.
  const onVisibilityChange = () => queueMicrotask(() => syncAutoplay())
  syncSelection()
  api.on('select', syncSelection).on('reInit', onReInit)
    .on('pointerDown', onPointerDown).on('pointerUp', onPointerUp)
  document.addEventListener('visibilitychange', onVisibilityChange)
  ready.value = true
  syncAutoplay()
  onCleanup(() => {
    api.off('select', syncSelection).off('reInit', onReInit)
      .off('pointerDown', onPointerDown).off('pointerUp', onPointerUp)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })
}, { immediate: true })

function scrollTo(index: number) {
  const api = emblaApi.value
  if (!api) return
  const count = displaySlides.value.length
  const current = api.selectedScrollSnap()
  const candidates = displaySlides.value.flatMap((slide, physicalIndex) => slide.logicalIndex === index ? [physicalIndex] : [])
  const distance = (physicalIndex: number) => {
    const offset = Math.abs(physicalIndex - current)
    return Math.min(offset, count - offset)
  }
  candidates.sort((a, b) => distance(a) - distance(b))
  if (candidates[0] !== undefined) api.scrollTo(candidates[0], reducedMotion.value)
  syncAutoplay(true)
}

function move(direction: -1 | 1) {
  if (direction < 0) emblaApi.value?.scrollPrev(reducedMotion.value)
  else emblaApi.value?.scrollNext(reducedMotion.value)
  syncAutoplay(true)
}

let motionQuery: MediaQueryList | undefined
function syncMotionPreference() {
  reducedMotion.value = motionQuery?.matches ?? false
  emblaApi.value?.reInit({ duration: reducedMotion.value ? 0 : 25 })
  syncAutoplay()
}

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionQuery.addEventListener('change', syncMotionPreference)
  mounted = true
  mouseInside = carouselRoot.value?.matches(':hover') ?? false
  syncMotionPreference()

  // A server-rendered image can fail before hydration attaches its listener.
  for (const image of posterImages.value ?? []) {
    const src = image.getAttribute('src')
    if (src && image.complete && image.naturalWidth === 0) onImageError(src)
  }
})

onBeforeUnmount(() => {
  mounted = false
  autoplay.stop()
  motionQuery?.removeEventListener('change', syncMotionPreference)
  // The official Vue composable destroys the Embla instance on unmount.
})
</script>

<template>
  <section
    ref="carouselRoot"
    class="home-carousel"
    :class="{ 'is-ready': ready }"
    :style="{ '--initial-index': initialIndex }"
    role="region"
    aria-roledescription="캐러셀"
    aria-label="팝업 포스터"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
    @focusin="syncAutoplay()"
    @focusout="onFocusOut"
  >
    <div class="home-carousel__ambient" aria-hidden="true">
      <Transition name="ambient">
        <img
          v-if="ambientSrc"
          :key="ambientSrc"
          ref="ambientImage"
          :src="ambientSrc"
          alt=""
          draggable="false"
          decoding="async"
          class="home-carousel__ambient-image"
          :class="{ 'is-loaded': loadedAmbientSources.has(ambientSrc) }"
          @load="onAmbientImageEvent"
          @error="onAmbientImageEvent"
        >
      </Transition>
    </div>

    <div
      ref="emblaRef"
      class="home-carousel__viewport"
      tabindex="0"
      aria-label="팝업 포스터, 좌우 방향키로 이동"
      @keydown.left.prevent="move(-1)"
      @keydown.right.prevent="move(1)"
      @keydown.home.prevent="scrollTo(0)"
      @keydown.end.prevent="scrollTo(pageIndexes.length - 1)"
    >
      <div class="home-carousel__container">
        <div
          v-for="(slide, index) in displaySlides"
          :key="slide.key"
          class="home-carousel__slide"
          role="group"
          aria-roledescription="슬라이드"
          :aria-label="`${slide.logicalIndex + 1} / ${posters.length}`"
          :aria-hidden="index !== selectedPhysicalIndex ? 'true' : undefined"
        >
          <div class="home-carousel__card bg-tag" :class="{ 'is-selected': index === selectedPhysicalIndex }">
            <img
              v-if="slide.poster.src && !failedSources.has(slide.poster.src)"
              ref="posterImages"
              :src="slide.poster.src"
              :alt="slide.poster.alt"
              :width="slide.poster.width"
              :height="slide.poster.height"
              draggable="false"
              decoding="async"
              class="home-carousel__image"
              @dragstart.prevent
              @error="onImageError(slide.poster.src)"
            >
            <p v-else role="status" class="type-label px-rn-16 text-center text-secondary">이미지를 불러오지 못했습니다.</p>
            <div class="home-carousel__gradient" aria-hidden="true" />
            <div class="home-carousel__info">
              <h2 class="home-carousel__title">{{ slide.poster.title }}</h2>
              <div class="home-carousel__details">
                <p>{{ slide.poster.period }}</p>
                <p class="home-carousel__region"><MapPin :size="12" aria-hidden="true" />{{ slide.poster.region }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      class="home-carousel__indicators"
      :style="{ '--segment-width': `${segmentWidth}px` }"
      role="group"
      aria-label="포스터 페이지 선택"
    >
      <button
        v-for="index in pageIndexes"
        :key="index"
        type="button"
        class="home-carousel__page"
        :aria-label="`${index + 1}번째 포스터로 이동`"
        :aria-current="index === selectedIndex ? 'true' : undefined"
        @click="scrollTo(index)"
      >
        <span class="home-carousel__segment" :class="{ 'is-selected': index === selectedIndex }" aria-hidden="true" />
      </button>
    </div>
    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ selectedIndex + 1 }} / {{ posters.length }} 포스터</p>
  </section>
</template>

<style scoped>
.home-carousel {
  position: relative;
  isolation: isolate;
  --slide-size: min(340px, 100%);
  width: 100%;
  max-width: 826px;
  min-width: 0;
  margin-inline: auto;
  padding-block: 20px;
  overflow: hidden;
  border-radius: 12px;
  background: #F5F5F7;
}
.home-carousel__ambient {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.home-carousel__ambient-image {
  position: absolute;
  inset: -80px;
  width: calc(100% + 160px);
  height: calc(100% + 160px);
  max-width: none;
  object-fit: cover;
  filter: blur(40px) brightness(0.65);
  opacity: 0;
  transition: opacity 450ms ease-in-out;
}
.home-carousel__ambient-image.is-loaded { opacity: 1; }
.home-carousel__ambient-image.ambient-enter-from,
.home-carousel__ambient-image.ambient-leave-to { opacity: 0; }
.home-carousel__ambient-image.ambient-enter-active,
.home-carousel__ambient-image.ambient-leave-active { transition: opacity 450ms ease-in-out; }
.home-carousel__viewport {
  z-index: 1;
  position: relative;
  width: 100%;
  height: 400px;
  overflow: hidden;
  touch-action: pan-y pinch-zoom;
  cursor: grab;
}
.home-carousel__viewport:active { cursor: grabbing; }
.home-carousel__container {
  display: flex;
  gap: 12px;
  height: 400px;
  touch-action: pan-y pinch-zoom;
  user-select: none;
}
/* Center the initial slide during SSR without competing with Embla's inline transform. */
.home-carousel:not(.is-ready) .home-carousel__container {
  transform: translateX(calc(50% - var(--slide-size) / 2 - (var(--slide-size) + 12px) * var(--initial-index)));
}
.home-carousel__slide {
  flex: 0 0 var(--slide-size);
  min-width: 0;
  height: 400px;
}
/* Embla reads this edge margin to preserve the 12px gap at the loop seam. */
.home-carousel__slide:last-child { margin-inline-end: 12px; }
.home-carousel__card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 400px;
  overflow: hidden;
  border-radius: 8px;
  transform: scale(0.90);
  transform-origin: center;
  filter: brightness(0.88);
  opacity: 1;
  transition: transform 250ms ease, filter 250ms ease;
}
.home-carousel__card.is-selected {
  transform: scale(1);
  filter: brightness(1);
}
.home-carousel__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  user-select: none;
  -webkit-user-drag: none;
}
.home-carousel__gradient {
  position: absolute;
  inset: auto 0 0;
  height: 160px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.45) 45%, rgba(0, 0, 0, 0.85) 100%);
  pointer-events: none;
}
.home-carousel__info {
  position: absolute;
  inset: auto 0 0;
  padding: 0 16px 20px;
  color: #ffffff;
  text-align: left;
  pointer-events: none;
}
.home-carousel__title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 18px;
  font-weight: 700;
  line-height: 24px;
}
.home-carousel__details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}
.home-carousel__region {
  display: flex;
  align-items: center;
  gap: 4px;
}
.home-carousel__region svg { flex-shrink: 0; }
.home-carousel__indicators {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
}
.home-carousel__page {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 var(--segment-width);
  width: var(--segment-width);
  height: 32px;
  border: 0;
  border-radius: 4px;
  padding: 0;
  background: transparent;
}
.home-carousel__segment {
  width: 100%;
  height: 3px;
  border-radius: 999px;
  background: #d1d5db;
  transition: background-color 120ms ease;
}
.home-carousel__segment.is-selected {
  background: #111827;
}
@media (prefers-reduced-motion: reduce) {
  .home-carousel__ambient-image,
  .home-carousel__ambient-image.ambient-enter-active,
  .home-carousel__ambient-image.ambient-leave-active { transition: none; }
  .home-carousel__card,
  .home-carousel__segment { transition: none; }
}
</style>
