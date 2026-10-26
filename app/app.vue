<script setup lang="ts">
import { canonicalUrl, PAGE_SEO } from '#shared/utils/seo'

const route = useRoute()
useState('seo:production', () => useRequestEvent()?.context.seoProduction === true)
useHead({ htmlAttrs: { lang: 'ko' }, link: [{ key: 'canonical', rel: 'canonical', href: () => canonicalUrl(route.path) }] })
usePopchiveSeo(PAGE_SEO['/'])
</script>

<template>
  <div lang="ko">
    <NuxtRouteAnnouncer />
    <a href="#preview-content" class="type-label fixed left-4 top-4 z-50 -translate-y-24 rounded-rn-8 bg-filter-selected px-rn-16 py-rn-12 text-filter-on-selected focus:translate-y-0">본문으로 이동</a>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
