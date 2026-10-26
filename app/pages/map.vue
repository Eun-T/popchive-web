<script setup lang="ts">
import PopupMap from '~/components/map/PopupMap.client.vue'
import { PAGE_SEO } from '#shared/utils/seo'

usePopchiveSeo(PAGE_SEO['/map'])
</script>

<template>
  <section aria-label="팝업 지도">
    <ClientOnly>
      <PopupMap />
      <template #fallback>
        <div class="map-placeholder" role="status">지도를 불러오는 중입니다.</div>
      </template>
    </ClientOnly>
  </section>
</template>

<style scoped>
.map-placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  height: 650px;
  background: var(--ds-surface);
  color: var(--ds-secondary);
  border: 1px solid var(--ds-border);
  border-radius: var(--ds-radius-8);
}
@media (width < 768px) {
  .map-placeholder { height: clamp(360px, 65dvh, 650px); }
}
</style>
