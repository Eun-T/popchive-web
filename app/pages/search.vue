<script setup lang="ts">
import { X } from '@lucide/vue'
import HomeQuickSearch from '~/components/home/HomeQuickSearch.vue'
import { normalizeSearchQuery, validQuickSearch } from '#shared/utils/quickSearch'

definePageMeta({ hideSidebar: false })
usePopchiveSeo({ title: '팝업 검색 | 팝카이브', description: '팝업 이름으로 검색하고 새로운 팝업을 찾아보세요.', noindex: true })
const route = useRoute()
const router = useRouter()
function back() {
  if (window.history.length > 1) router.back()
  else void navigateTo('/')
}
const query = computed(() => normalizeSearchQuery(typeof route.query.q === 'string' ? route.query.q : ''))
const searchBox = ref<InstanceType<typeof HomeQuickSearch> | null>(null)
function onInput(value: string) {
  if (!value && query.value) void router.replace('/search')
}
const { recent, add, remove, clear } = useRecentSearches()
const { result: hotRequest } = useHomePopups('now-hot')
const hot = computed(() => hotRequest.error.value ? [] : (hotRequest.data.value?.items ?? []).slice(0, 5))
function search(value: string) {
  const q = normalizeSearchQuery(value)
  if (!q) { void navigateTo('/search'); return }
  if (!validQuickSearch(q)) return
  add(q)
  searchBox.value?.setQuery(q)
  if (q === query.value) return
  void navigateTo({ path: '/search', query: { q } })
}
</script>

<template>
  <div class="search-page">
    <HomeQuickSearch ref="searchBox" page-mode :initial-query="query" @search="search" @back="back" @input-query="onInput" />
      <section v-if="recent.length" aria-labelledby="recent-search-title">
        <div class="search-page__heading"><h2 id="recent-search-title" class="type-title-s">최근 검색어</h2><button class="search-page__clear" type="button" @click="clear">전체 삭제</button></div>
        <ul class="search-page__chips"><li v-for="term in recent" :key="term" class="search-page__recent"><button type="button" @click="search(term)">{{ term }}</button><button type="button" :aria-label="`${term} 검색 기록 삭제`" @click="remove(term)"><X :size="14" aria-hidden="true" /></button></li></ul>
      </section>
      <section v-if="hot.length" aria-labelledby="hot-search-title">
        <h2 id="hot-search-title" class="type-title-s">지금 핫한 팝업</h2>
        <ol class="search-page__hot"><li v-for="(popup, index) in hot" :key="popup.publicId"><button type="button" @click="search(popup.title)"><span>{{ index + 1 }}</span>{{ popup.title }}</button></li></ol>
      </section>
  </div>
</template>

<style scoped>
.search-page { min-width: 0; color: var(--ds-text); }
.search-page > section { margin-top: var(--ds-space-32); }
.search-page__heading { display: flex; align-items: center; justify-content: space-between; gap: var(--ds-space-12); }
.search-page__clear { color: var(--ds-secondary); font-size: var(--ds-caption-size); }
.search-page__clear { min-height: 44px; }
.search-page__chips { display: flex; flex-wrap: wrap; gap: var(--ds-space-8); margin-top: var(--ds-space-12); }
.search-page__recent { display: flex; max-width: 100%; border: 1px solid var(--ds-border); border-radius: var(--ds-radius-full); overflow: hidden; }
.search-page__recent button { min-width: 0; min-height: 44px; padding: var(--ds-space-8) var(--ds-space-12); overflow-wrap: anywhere; font-size: var(--ds-label-size); }
.search-page__recent button + button { flex-shrink: 0; padding-left: var(--ds-space-4); }
.search-page__hot { margin-top: var(--ds-space-12); }
.search-page__hot button { display: flex; gap: var(--ds-space-12); min-height: 44px; padding-block: var(--ds-space-8); text-align: left; overflow-wrap: anywhere; }
.search-page__hot span { flex-shrink: 0; color: var(--ds-accent-purple); font-weight: 600; }
</style>
