<script setup lang="ts">
import { Search } from '@lucide/vue'
import type { QuickSearchPopup } from '../../../shared/types/quickSearch'
import type { PopupDetail } from '../../../shared/types/popup'
import { popupCalendarDate, popupDayStatus } from '~/utils/popupDates'
const props = defineProps<{ popup: QuickSearchPopup; query: string; compact?: boolean; detail?: PopupDetail | null }>()
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
onMounted(() => { if (props.compact) clock = setInterval(() => { now.value = Date.now() }, 60_000) })
onBeforeUnmount(() => clearInterval(clock))
const status = computed(() => {
  if (!props.detail) return null
  const value = popupDayStatus(props.detail, popupCalendarDate(now.value, props.detail.countryCode))
  return value ? value.state === 'last-day' ? 'ongoing' : value.state as 'ongoing' | 'upcoming' | 'ended' : null
})
const parts = computed(() => {
  const index = props.popup.name.toLowerCase().indexOf(props.query.toLowerCase())
  return index < 0 ? [props.popup.name, '', ''] : [props.popup.name.slice(0, index), props.popup.name.slice(index, index + props.query.length), props.popup.name.slice(index + props.query.length)]
})
</script>
<template>
  <template v-if="compact">
    <StatusBadge v-if="status" :status="status" class="search-result-badge" />
    <span v-else class="search-result-pending">{{ detail === undefined ? '확인 중' : '일정 미정' }}</span>
    <span class="search-result-compact-name">{{ parts[0] }}<mark v-if="parts[1]">{{ parts[1] }}</mark>{{ parts[2] }}</span>
    <span class="search-result-region">{{ popup.regionName || '지역 미정' }}</span>
  </template>
  <template v-else>
  <Search :size="18" aria-hidden="true" class="search-result-icon" />
  <span class="search-result-copy"><span class="search-result-name">{{ parts[0] }}<mark v-if="parts[1]">{{ parts[1] }}</mark>{{ parts[2] }}</span><span class="search-result-address">{{ [popup.regionName, popup.address].filter(Boolean).join(' · ') }}</span></span>
  </template>
</template>
<style scoped>
.search-result-badge, .search-result-pending { flex-shrink: 0; white-space: nowrap; }
.search-result-pending { font-size: 12px; color: var(--ds-secondary); }
.search-result-compact-name { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: var(--ds-label-size); }
.search-result-compact-name mark { color: var(--ds-accent-purple); background: transparent; font-weight: 600; }
.search-result-region { flex: 0 1 auto; max-width: 25%; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--ds-caption-size); color: var(--ds-secondary); }
.search-result-icon { flex-shrink: 0; color: var(--ds-secondary); }
.search-result-copy { flex: 1; min-width: 0; }
.search-result-name, .search-result-address { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.search-result-name { font-size: 14px; line-height: 22px; }
.search-result-name mark { background: transparent; color: var(--ds-accent-purple); font-weight: 600; }
.search-result-address { margin-top: 2px; color: var(--ds-secondary); font-size: 12px; line-height: 18px; }
</style>
