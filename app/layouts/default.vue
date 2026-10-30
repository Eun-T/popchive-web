<script setup lang="ts">
import AppHeader from '~/components/layout/AppHeader.vue'
import TodayPopupSidebar from '~/components/layout/TodayPopupSidebar.vue'
import AppFooter from '~/components/layout/AppFooter.vue'
const route = useRoute()
</script>

<template>
  <div>
    <AppHeader />
    <main id="preview-content" tabindex="-1" class="site-layout scroll-mt-[80px]" :class="{ 'site-layout--single': route.meta.hideSidebar }">
      <div class="site-layout__content">
        <slot />
      </div>
      <TodayPopupSidebar v-if="!route.meta.hideSidebar" />
    </main>
    <AppFooter />
  </div>
</template>

<style scoped>
.site-layout {
  display: grid;
  grid-template-columns: 826px 230px;
  gap: 24px;
  width: 100%;
  max-width: 1080px;
  margin: 24px auto 0;
}
.site-layout__content {
  min-width: 0;
}
.site-layout--single { grid-template-columns: minmax(0, 1fr); max-width: 826px; }
@media (width < 1120px) {
  .site-layout {
    grid-template-columns: minmax(0, 1fr);
    padding-inline: 20px;
  }
}
</style>
