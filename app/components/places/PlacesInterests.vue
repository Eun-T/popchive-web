<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import type { PlaceOption } from '../../../shared/types/places'
import { PLACE_INTERESTS } from '#shared/utils/placeInterests'

defineProps<{ tags: PlaceOption[] }>()
const emit = defineEmits<{ select: [tagId: number] }>()
const failedImages = ref(new Set<string>())
</script>

<template>
  <section class="places-interests" aria-labelledby="places-interests-title">
    <h2 id="places-interests-title">취향 따라 찾아볼까요?</h2>
    <p class="places-interests__description">좋아하는 취향의 팝업을 골라 둘러보세요.</p>
    <ul class="places-interests__grid">
      <li v-for="category in PLACE_INTERESTS" :key="category.tagId">
        <button type="button" class="places-interests__card" :data-tag-id="category.tagId" :disabled="!tags.some(tag => tag.id === category.tagId && tag.name === category.name)" :aria-label="`${category.name} 팝업 보기`" @click="emit('select', category.tagId)">
          <img v-if="category.image && !failedImages.has(category.image)" :src="category.image" alt="" width="800" height="320" loading="lazy" decoding="async" draggable="false" @error="failedImages.add(category.image)">
          <span class="places-interests__shade" aria-hidden="true" />
          <span class="places-interests__label">{{ category.name }}<ArrowRight :size="20" aria-hidden="true" /></span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.places-interests { min-width: 0; margin-top: 40px; color: var(--ds-text); }
.places-interests h2 { font-size: 20px; font-weight: 700; line-height: 28px; }
.places-interests__description { margin-top: 6px; color: var(--ds-secondary); font-size: 14px; line-height: 20px; }
.places-interests__grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; margin: 20px 0 0; padding: 0; list-style: none; }
.places-interests__card { position: relative; display: flex; align-items: center; justify-content: flex-end; overflow: hidden; width: 100%; height: 140px; border: 0; border-radius: 12px; background: #6b7280; color: #fff; cursor: pointer; }
.places-interests__card:disabled { cursor: default; }
.places-interests__card:focus-visible { outline: 2px solid #fff; outline-offset: -4px; }
.places-interests__card img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; user-select: none; }
.places-interests__shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgb(0 0 0 / 25%), rgb(0 0 0 / 35%) 50%, rgb(0 0 0 / 60%)); pointer-events: none; }
.places-interests__label { position: relative; display: flex; align-items: center; gap: 8px; margin-inline: 16px; font-size: 18px; font-weight: 700; line-height: 26px; text-align: right; }
@media (width >= 768px) {
  .places-interests__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .places-interests__card { height: 160px; }
}
</style>
