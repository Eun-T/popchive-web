<script lang="ts">
// Client requests survive component remounts; promises never enter SSR payloads.
const pendingBlogReviews = new Map<string, Promise<import('../../../shared/types/blogReviews').BlogReviewsResponse>>()
</script>

<script setup lang="ts">
import type { BlogReviewsResponse } from '../../../shared/types/blogReviews'

const props = defineProps<{ publicId: string }>()
const headingId = `blog-reviews-${useId()}`
const cache = useState<Record<string, BlogReviewsResponse>>('blog-review-results', () => ({}))
const wrapper = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined
let mounted = false

async function load(publicId: string) {
  if (!mounted || publicId !== props.publicId || cache.value[publicId]) return
  let request = pendingBlogReviews.get(publicId)
  if (!request) {
    request = $fetch<BlogReviewsResponse>('/api/blog-reviews', {
      query: { publicId }, retry: 0, timeout: 18_000,
    }).catch(() => ({ items: [] })).finally(() => pendingBlogReviews.delete(publicId))
    pendingBlogReviews.set(publicId, request)
  }
  // Empty/error results count as completed too; scrolling does not retry them.
  cache.value[publicId] = await request
}

function observe() {
  observer?.disconnect()
  if (!mounted || !wrapper.value || cache.value[props.publicId]) return
  const publicId = props.publicId
  if (typeof IntersectionObserver === 'undefined') { void load(publicId); return }
  try {
    observer = new IntersectionObserver(entries => {
      if (!mounted || publicId !== props.publicId || !entries.some(entry => entry.isIntersecting)) return
      observer?.disconnect()
      void load(publicId)
    }, { rootMargin: '300px 0px' })
    observer.observe(wrapper.value)
  } catch { void load(publicId) }
}
onMounted(() => { mounted = true; observe() })
watch(() => props.publicId, () => { failedImages.value.clear(); observe() }, { flush: 'post' })
onBeforeUnmount(() => { mounted = false; observer?.disconnect() })
// Display-only cleanup: API descriptions and server relevance checks stay intact.
function displayDescription(value: string): string {
  return value
    .replace(/[\[(](?:(?:사진|이미지)\s*)?출처\s*[:：][^\])]*[\])]/gu, ' ')
    .replace(/(?:https?:\/\/|www\.)[^\s<>]+/giu, url => url.match(/[.,!?。！？，)\]]+$/u)?.[0] ?? ' ')
    .replace(/(^|\s)(?:(?:사진|이미지)\s*)?출처\s*[:：]\s*(?:네이버\s*블로그|네이버|공식\s*홈페이지|공식\s*사이트)(?=\s|$|[.,|·])/gu, '$1')
    .replace(/(^|\s|[（(])#[\p{L}\p{N}_]+/gu, '$1')
    .replace(/(^|\s)(?:(?:사진|이미지)\s*)?출처\s*[:：](?=\s*(?:$|[|·]))/gu, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,，。.!?])/gu, '$1')
    .replace(/^[\s|·]+|[\s|·]+$/gu, '')
    .replace(/^[\s.,…:;!?()（）\[\]|·-]+$/gu, '')
    .trim()
}
const items = computed(() => (cache.value[props.publicId]?.items ?? []).slice(0, 3)
  .map(item => ({ ...item, displayDescription: displayDescription(item.description) })))
const failedImages = ref(new Set<string>())
</script>

<template>
  <div ref="wrapper" class="blog-reviews-observer">
  <section v-if="items.length" class="blog-reviews" :aria-labelledby="headingId">
    <header class="blog-reviews__header">
      <h2 :id="headingId">블로그 후기</h2>
      <!-- <p>네이버 블로그 검색 결과입니다. 실제 방문 여부는 확인되지 않았습니다.</p> -->
    </header>
    <ul class="blog-reviews__list">
      <li v-for="item in items" :key="item.url">
        <a :href="item.url" target="_blank" rel="noopener noreferrer" class="blog-reviews__link">
          <div class="blog-reviews__text">
            <h3 :title="item.title">{{ item.title }}</h3>
            <p v-if="item.displayDescription" class="blog-reviews__summary">{{ item.displayDescription }}</p>
            <time :datetime="item.publishedAt">{{ item.publishedAt.replaceAll('-', '.') }}</time>
          </div>
          <img
            v-if="item.thumbnailUrl && !failedImages.has(item.thumbnailUrl)"
            :src="item.thumbnailUrl"
            alt=""
            class="blog-reviews__thumbnail"
            width="112"
            height="112"
            loading="lazy"
            @error="failedImages.add(item.thumbnailUrl!)"
          />
          <span class="sr-only">네이버 블로그 원문, 새 창에서 열기</span>
        </a>
      </li>
    </ul>
  </section>
  </div>
</template>

<style scoped>
.blog-reviews-observer { display: flow-root; min-width: 0; min-height: 1px; }
.blog-reviews { min-width: 0; margin-top: var(--ds-space-40); color: var(--ds-text); }
.blog-reviews__header h2 { font-size: 20px; line-height: 28px; font-weight: 700; }
.blog-reviews__header p { margin-top: 8px; color: var(--ds-secondary); font-size: 12px; line-height: 18px; }
.blog-reviews__list { display: grid; gap: var(--ds-space-10); margin-top: var(--ds-space-20); }
.blog-reviews__list li { min-width: 0; }
.blog-reviews__link { display: flex; align-items: center; gap: var(--ds-space-12); min-width: 0; padding: var(--ds-space-12) var(--ds-space-16); border: 1px solid var(--ds-border); border-radius: var(--ds-radius-8); background: var(--ds-background); }
.blog-reviews__text { flex: 1; min-width: 0; }
.blog-reviews__thumbnail { flex: 0 0 auto; width: clamp(64px, 20vw, 112px); height: auto; aspect-ratio: 1; object-fit: cover; border-radius: var(--ds-radius-8); }
.blog-reviews__link:hover { background: var(--ds-surface); }
.blog-reviews__link h3 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; font-size: var(--ds-body-size); line-height: var(--ds-body-leading); font-weight: 600; }
.blog-reviews__summary { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; margin-top: var(--ds-space-4); font-size: var(--ds-label-size); line-height: 22px; color: var(--ds-secondary); }
.blog-reviews__link time { display: block; margin-top: var(--ds-space-8); font-size: var(--ds-caption-size); line-height: var(--ds-caption-leading); color: var(--ds-secondary); }
</style>
