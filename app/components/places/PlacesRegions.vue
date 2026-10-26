<script setup lang="ts">
import useEmblaCarousel from 'embla-carousel-vue'
import type { PlaceCountry, PlaceRegion } from '../../../shared/types/places'
import { PLACE_REGION_PAGES } from '#shared/utils/placeRegions'

const props = defineProps<{ active: boolean; regions: PlaceRegion[] }>()
const emit = defineEmits<{ select: [countryCode: PlaceCountry, regionId: number] }>()
const [viewport, embla] = useEmblaCarousel({ align: 'start', loop: false, containScroll: 'trimSnaps' })
const activePage = ref(0)
function syncPage() { activePage.value = embla.value?.selectedScrollSnap() ?? 0 }
watch(embla, (api, _, cleanup) => {
  if (!api) return
  syncPage()
  api.on('select', syncPage).on('reInit', syncPage)
  cleanup(() => { api.off('select', syncPage).off('reInit', syncPage) })
})
watch(() => props.active, async active => {
  if (!active) return
  await nextTick()
  embla.value?.reInit()
  embla.value?.scrollTo(activePage.value, true)
})
function goToPage(index: number) {
  embla.value?.scrollTo(index, window.matchMedia('(prefers-reduced-motion: reduce)').matches)
}
function available(countryCode: PlaceCountry, id: number) {
  return props.regions.some(region => region.id === id && region.countryCode === countryCode)
}
</script>

<template>
  <section class="places-regions" aria-labelledby="places-regions-title">
    <h2 id="places-regions-title">어디로 놀러 갈까?</h2>
    <div ref="viewport" class="places-regions__viewport" tabindex="0" role="region" aria-label="한국·일본 지역 탐색" @keydown.left.prevent="goToPage(Math.max(0, activePage - 1))" @keydown.right.prevent="goToPage(Math.min(1, activePage + 1))">
      <div class="places-regions__track">
        <ul v-for="(page, index) in PLACE_REGION_PAGES" :key="page.countryCode" class="places-regions__page" :aria-label="`${page.label} 지역`" :inert="activePage !== index">
          <li v-for="region in page.items" :key="region.id">
            <button type="button" class="places-regions__card" :disabled="!available(page.countryCode, region.id)" :data-region-id="region.id" :aria-label="`${region.name} 팝업 보기`" @click="emit('select', page.countryCode, region.id)">
              <img v-if="region.image" :src="region.image" alt="" width="640" height="400" loading="lazy" decoding="async" draggable="false">
              <span class="places-regions__gradient" aria-hidden="true" />
              <span class="places-regions__name">{{ region.name }}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
    <div class="places-regions__pagination" aria-label="지역 페이지 선택">
      <button v-for="(page, index) in PLACE_REGION_PAGES" :key="page.countryCode" type="button" :aria-label="`${page.label} 지역 보기`" :aria-current="activePage === index ? 'true' : undefined" @click="goToPage(index)"><span :class="{ 'is-active': activePage === index }" /></button>
    </div>
  </section>
</template>

<style scoped>
.places-regions { min-width: 0; margin-top: 40px; }
.places-regions h2 { margin-bottom: 20px; color: var(--ds-text); font-size: 20px; font-weight: 700; line-height: 28px; }
.places-regions__viewport { overflow: hidden; touch-action: pan-y pinch-zoom; outline-offset: -3px; }
.places-regions__track { display: flex; gap: 16px; }
.places-regions__page { display: grid; flex: 0 0 100%; min-width: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }
.places-regions__card { position: relative; display: block; overflow: hidden; width: 100%; aspect-ratio: 1.6; border: 0; border-radius: 12px; background: #6b7280; color: #fff; text-align: left; cursor: pointer; }
.places-regions__card:disabled { cursor: default; }
.places-regions__card img { width: 100%; height: 100%; object-fit: cover; user-select: none; }
.places-regions__gradient { position: absolute; inset: 0; background: linear-gradient(transparent 20%, rgb(0 0 0 / 60%)); pointer-events: none; }
.places-regions__name { position: absolute; left: 16px; right: 12px; bottom: 16px; font-size: 18px; font-weight: 700; line-height: 26px; }
.places-regions__card:focus-visible { outline: 2px solid #fff; outline-offset: -4px; }
.places-regions__pagination { display: flex; justify-content: center; margin-top: 12px; }
.places-regions__pagination button { display: grid; place-items: center; width: 32px; height: 24px; }
.places-regions__pagination span { display: block; width: 6px; height: 6px; border-radius: 999px; background: #d1d5db; transition: width 200ms; }
.places-regions__pagination .is-active { width: 18px; background: var(--ds-text); }
@media (width >= 768px) { .places-regions__page { gap: 16px; } }
@media (width >= 1120px) { .places-regions__page { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (prefers-reduced-motion: reduce) { .places-regions__pagination span { transition: none; } }
</style>
