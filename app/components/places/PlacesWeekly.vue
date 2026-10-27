<script setup lang="ts">
import { Heart } from '@lucide/vue'
import { webFeatures } from '~/config/features'
import useEmblaCarousel from 'embla-carousel-vue'
import type { WeeklyPopupsResponse } from '../../../shared/types/weekly'
import { endingSoonToday } from '#shared/utils/endingSoon'
import { weeklyAddDays, weeklyLabel, weeklyMonday } from '#shared/utils/weeklyPopups'

const props = defineProps<{ active: boolean }>()
// Payload-backed date keeps server and browser on the same calendar day at hydration.
const referenceDate = useState('places:weekly:today', () => endingSoonToday())
const selectedWeek = ref(weeklyMonday(referenceDate.value))
const query = computed(() => ({ weekStart: selectedWeek.value }))
const key = computed(() => `places:weekly:KR-JP:ko:${selectedWeek.value}`)
const { data, status, error, refresh } = await useFetch<WeeklyPopupsResponse>('/api/places/weekly', {
  key, query, server: true, dedupe: 'cancel', retry: 0,
})
const items = computed(() => data.value?.weekStart === selectedWeek.value ? data.value.items : [])
const pages = computed(() => Array.from({ length: Math.ceil(items.value.length / 3) }, (_, index) => items.value.slice(index * 3, index * 3 + 3)))
const weekChoices = computed(() => [-1, 0, 1].map(offset => ({ offset, start: weeklyAddDays(selectedWeek.value, offset * 7) })))
const labels = { ongoing: '진행 중', upcoming: '오픈 예정', ended: '종료' }
const failedImages = ref(new Set<string>())
const mobile = ref(false)
const pageIndex = ref(0)
const [viewport, embla] = useEmblaCarousel({
  align: 'start', slidesToScroll: 1, loop: false, containScroll: 'trimSnaps',
  breakpoints: { '(min-width: 768px)': { active: false } },
})
let media: MediaQueryList | undefined
let timer: ReturnType<typeof setInterval> | undefined
let lastRecovery = 0

function syncPage() { pageIndex.value = mobile.value ? embla.value?.selectedScrollSnap() ?? 0 : 0 }
watch(embla, (api, _, cleanup) => {
  if (!api) return
  syncPage()
  api.on('select', syncPage).on('reInit', syncPage)
  cleanup(() => { api.off('select', syncPage).off('reInit', syncPage) })
})
async function remeasure(reset = false) {
  await nextTick()
  embla.value?.reInit()
  if (reset) embla.value?.scrollTo(0, true)
  syncPage()
}
watch([selectedWeek, items], () => { pageIndex.value = 0; void remeasure(true) })
function selectWeek(offset: number) {
  if (offset) selectedWeek.value = weeklyAddDays(selectedWeek.value, offset * 7)
}
function goToPage(index: number) {
  embla.value?.scrollTo(index, window.matchMedia('(prefers-reduced-motion: reduce)').matches)
}
function syncMobile() { mobile.value = media?.matches ?? false }
function refreshIfStale() {
  if (!props.active || document.hidden || status.value === 'pending' || !data.value) return
  if (data.value.asOf !== endingSoonToday() || Date.now() - data.value.fetchedAt >= 180_000) void refresh()
}
function imageFailed(src: string) {
  failedImages.value.add(src)
  if (!props.active || status.value === 'pending' || !data.value || Date.now() - data.value.fetchedAt < 60_000
    || Date.now() - lastRecovery < 60_000) return
  lastRecovery = Date.now()
  void refresh()
}
watch(() => props.active, active => {
  if (active) { refreshIfStale(); void remeasure() }
})
onMounted(() => {
  media = window.matchMedia('(max-width: 767px)')
  syncMobile()
  media.addEventListener('change', syncMobile)
  refreshIfStale()
  timer = setInterval(refreshIfStale, 30_000)
  document.addEventListener('visibilitychange', refreshIfStale)
  window.addEventListener('pageshow', refreshIfStale)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  media?.removeEventListener('change', syncMobile)
  document.removeEventListener('visibilitychange', refreshIfStale)
  window.removeEventListener('pageshow', refreshIfStale)
})
function shortDate(value: string) { return `${Number(value.slice(5, 7))}.${Number(value.slice(8, 10))}` }
</script>

<template>
  <section class="places-weekly" aria-labelledby="places-weekly-title">
    <h2 id="places-weekly-title">이번 주 뭐가 뜰까?</h2>
    <div class="places-weekly__weeks" role="group" aria-label="팝업 주간 선택">
      <button v-for="week in weekChoices" :key="week.offset" type="button" :aria-pressed="week.offset === 0" :aria-label="`${weeklyLabel(week.start)}${week.offset === 0 ? ', 선택한 주' : ''}`" :class="{ 'is-selected': week.offset === 0 }" :data-week-start="week.start" @click="selectWeek(week.offset)">
        {{ weeklyLabel(week.start) }}<span aria-hidden="true" />
      </button>
    </div>
    <p v-if="status === 'pending'" class="places-weekly__state" role="status">팝업을 불러오는 중입니다.</p>
    <div v-else-if="error" class="places-weekly__state" role="alert"><p>주간 팝업을 불러오지 못했습니다.</p><button type="button" class="places-weekly__retry" @click="refresh()">다시 시도</button></div>
    <p v-else-if="!items.length" class="places-weekly__state" role="status">이번 주에 등록된 팝업이 없어요.</p>
    <template v-else>
      <div ref="viewport" class="places-weekly__viewport" tabindex="0" role="region" aria-label="주간 팝업 목록" @keydown.left.prevent="goToPage(Math.max(0, pageIndex - 1))" @keydown.right.prevent="goToPage(Math.min(pages.length - 1, pageIndex + 1))">
        <div class="places-weekly__track">
          <ul v-for="(page, index) in pages" :key="index" class="places-weekly__page" :aria-label="`주간 팝업 ${index + 1}페이지`" :inert="mobile && pageIndex !== index">
            <li v-for="popup in page" :key="popup.publicId" class="weekly-card">
              <NuxtLink class="weekly-card__link" :to="`/places/${encodeURIComponent(popup.publicId)}`" :aria-label="`${popup.name} 상세 보기`" draggable="false" />
              <div class="weekly-card__poster">
                <img v-if="popup.coverImageUrl && !failedImages.has(popup.coverImageUrl)" :src="popup.coverImageUrl" alt="" width="104" height="140" loading="lazy" decoding="async" draggable="false" @error="imageFailed(popup.coverImageUrl)">
                <span v-else>{{ popup.coverImageUrl ? '이미지를 불러올 수 없습니다.' : '이미지 없음' }}</span>
              </div>
              <div class="weekly-card__info">
                <div class="weekly-card__tags">
                  <span class="weekly-card__status" :class="`weekly-card__status--${popup.status}`">{{ labels[popup.status] }}</span>
                  <span v-for="tag in popup.tags" :key="tag.id" class="weekly-card__tag">{{ tag.name }}</span>
                </div>
                <div class="weekly-card__title-row">
                  <h3 :title="popup.name">{{ popup.name }}</h3>
                  <button v-if="webFeatures.favorites" type="button" class="weekly-card__favorite" disabled aria-label="찜하기 (준비 중)" title="찜 기능 준비 중"><Heart :size="24" :stroke-width="2" fill="#6B7280" aria-hidden="true" /></button>
                </div>
                <p class="weekly-card__meta"><span>{{ popup.regionName ?? '지역 미정' }}</span> · <span>{{ shortDate(popup.startDate) }} - {{ shortDate(popup.endDate) }}</span></p>
              </div>
            </li>
          </ul>
        </div>
      </div>
      <div v-if="pages.length > 1" class="places-weekly__pagination" aria-label="주간 팝업 페이지 선택">
        <button v-for="(_, index) in pages" :key="index" type="button" :aria-label="`주간 팝업 ${index + 1}페이지 보기`" :aria-current="pageIndex === index ? 'true' : undefined" @click="goToPage(index)"><span :class="{ 'is-active': pageIndex === index }" /></button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.places-weekly { min-width: 0; margin-top: 40px; color: var(--ds-text); }
.places-weekly > h2 { margin-bottom: 20px; font-size: 20px; font-weight: 700; line-height: 28px; }
.places-weekly__weeks { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 20px; }
.places-weekly__weeks button { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 0; min-height: 48px; padding: 6px 2px; border: 1px solid transparent; border-radius: 12px; background: var(--ds-tag); color: var(--ds-secondary); font-size: 13px; line-height: 20px; white-space: nowrap; }
.places-weekly__weeks .is-selected { border-color: #7839ef; background: var(--ds-background); color: #7839ef; font-weight: 700; }
.places-weekly__weeks button span { width: 6px; height: 6px; margin-top: 4px; border-radius: 50%; }
.places-weekly__weeks .is-selected span { background: #7839ef; }
.places-weekly__viewport { overflow: hidden; touch-action: pan-y pinch-zoom; outline-offset: -3px; }
.places-weekly__track { display: flex; gap: 16px; }
.places-weekly__page { display: grid; align-content: start; flex: 0 0 100%; min-width: 0; gap: 16px; margin: 0; padding: 0; list-style: none; }
.weekly-card { position: relative; display: flex; align-items: center; gap: 12px; min-width: 0; min-height: 140px; background: var(--ds-background); }
.weekly-card__link { position: absolute; inset: 0; z-index: 1; border-radius: 8px; }
.weekly-card__link:focus-visible { outline: 2px solid var(--ds-text); outline-offset: -2px; }
.weekly-card__poster { display: grid; place-items: center; flex: 0 0 104px; width: 104px; height: 140px; overflow: hidden; border-radius: 8px; background: var(--ds-tag); color: var(--ds-secondary); font-size: 12px; text-align: center; }
.weekly-card__poster img { width: 100%; height: 100%; object-fit: cover; user-select: none; }
.weekly-card__poster span { padding: 8px; }
.weekly-card__info { flex: 1; min-width: 0; padding-block: 4px; }
.weekly-card__tags { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.weekly-card__status, .weekly-card__tag { max-width: 100%; padding: 2px 6px; border-radius: 4px; font-size: 11px; line-height: 18px; overflow-wrap: anywhere; }
.weekly-card__status { flex-shrink: 0; font-weight: 600; }
.weekly-card__status--ongoing { background: var(--ds-brand-soft); color: var(--ds-brand-strong); }
.weekly-card__status--upcoming { background: var(--ds-info-soft); color: var(--ds-info-strong); }
.weekly-card__status--ended, .weekly-card__tag { background: var(--ds-tag); color: var(--ds-tag-text); }
.weekly-card__title-row { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
.weekly-card h3 { flex: 1; min-width: 0; overflow: hidden; font-size: 15px; font-weight: 600; line-height: 22px; text-overflow: ellipsis; white-space: nowrap; }
.weekly-card__favorite { position: relative; z-index: 2; display: grid; place-items: center; flex: 0 0 24px; width: 24px; height: 24px; border: 0; border-radius: 0; background: transparent; color: #fff; }
.weekly-card__favorite :deep(svg) { filter: drop-shadow(0 1px 2px rgb(0 0 0 / 25%)); }
.weekly-card__meta { margin-top: 6px; color: var(--ds-secondary); font-size: 13px; line-height: 20px; overflow-wrap: anywhere; }
.weekly-card__meta span:last-child { display: inline-block; }
.places-weekly__pagination { display: flex; justify-content: center; margin-top: 12px; }
.places-weekly__pagination button { display: grid; place-items: center; width: 32px; height: 24px; }
.places-weekly__pagination span { display: block; width: 6px; height: 6px; border-radius: 999px; background: #d1d5db; }
.places-weekly__pagination .is-active { width: 18px; background: #7839ef; }
.places-weekly__state { min-height: 140px; padding-block: 24px; color: var(--ds-secondary); font-size: 14px; }
.places-weekly__retry { margin-top: 12px; padding: 8px 12px; border: 1px solid var(--ds-border); border-radius: 8px; color: var(--ds-text); }
@media (width >= 768px) {
  .places-weekly__track { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .places-weekly__page { display: contents; }
  .places-weekly__pagination { display: none; }
  .places-weekly__weeks button { font-size: 14px; }
}
@media (width >= 1120px) { .places-weekly__track { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
