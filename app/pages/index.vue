<script setup lang="ts">
import HomeQuickSearch from '~/components/home/HomeQuickSearch.vue'
import HomeFeaturedGrid from '~/components/home/HomeFeaturedGrid.vue'
import HomeCategoryShortcuts from '~/components/home/HomeCategoryShortcuts.vue'
import HomeNewPopups from '~/components/home/HomeNewPopups.vue'
import HomeHotRanking from '~/components/home/HomeHotRanking.vue'
import HomeJapanNewPopups from '~/components/home/HomeJapanNewPopups.vue'
import HomeSeoulMap from '~/components/home/HomeSeoulMap.vue'
import { PAGE_SEO } from '#shared/utils/seo'

usePopchiveSeo(PAGE_SEO['/'])

const { result: bannersRequest, onImageError: onBannerImageError } = useHomePopups('main-banners')
const { result: newRequest, onImageError: onNewImageError } = useHomePopups('new-popups')
const { result: hotRequest, onImageError: onHotImageError } = useHomePopups('now-hot')

// Start all three during setup, then await together. SSR results, including empty
// lists, travel in the Nuxt payload and are reused rather than fetched on mount.
const [banners, newPopups, hotPopups] = await Promise.all([bannersRequest, newRequest, hotRequest])
const posters = computed(() => banners.data.value?.items ?? [])
const newPopupItems = computed(() => newPopups.data.value?.items ?? [])
const hotRankingItems = computed(() => hotPopups.data.value?.items ?? [])
</script>

<template>
  <div class="home-page">
    <div class="home-main-section">
      <HomeQuickSearch />
      <p v-if="banners.error.value" class="home-banner-state" role="alert">메인 팝업을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      <HomeFeaturedGrid v-else-if="posters.length" :posters="posters" @image-error="onBannerImageError" />
      <p v-else class="home-banner-state" role="status">현재 등록된 메인 팝업이 없습니다.</p>
    </div>
    <div class="home-categories-container">
      <!-- <HomeCategoryShortcuts /> -->
    </div>
    <HomeNewPopups
      :items="newPopupItems"
      :loading="newPopups.status.value === 'pending' && !newPopups.data.value"
      :error="!!newPopups.error.value"
      @image-error="onNewImageError"
    />
    <HomeHotRanking
      :items="hotRankingItems"
      :loading="hotPopups.status.value === 'pending' && !hotPopups.data.value"
      :error="!!hotPopups.error.value"
      @image-error="onHotImageError"
    />
    <HomeSeoulMap />
    <HomeJapanNewPopups />
  </div>
</template>

<style scoped>
.home-main-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 826px;
  margin-inline: auto;
}
@media (width >= 1120px) {
  .home-main-section {
    /* Match TODAY's 400px height; free space aligns the unchanged cards at the bottom. */
    height: 400px;
    justify-content: space-between;
  }
  .home-main-section :deep(.home-featured-grid) { flex-shrink: 0; }
}
/* Keep card rounding local to the home page, including reused components. */
.home-page :deep(:is(
  .home-featured-grid__card,
  .home-featured-grid__image,
  .new-popups__card,
  .new-popups__image,
  .hot-ranking__card,
  .hot-ranking__poster,
  .japan-new-popups__card,
  .japan-new-popups__poster
)) {
  border-radius: 5px;
}
.home-page :deep(:is(
  .new-popups__image,
  .hot-ranking__poster,
  .japan-new-popups__poster
) img) {
  border-radius: 5px;
}
.home-page :deep(:is(
  .home-featured-grid__card,
  .new-popups__image,
  .hot-ranking__poster,
  .japan-new-popups__poster
)) {
  overflow: hidden;
}
.home-categories-container {
  width: 100%;
  margin-top: 52px;
}
.home-banner-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 0;
  padding: 20px;
  color: #6b7280;
  font-size: 14px;
  text-align: center;
}
</style>
