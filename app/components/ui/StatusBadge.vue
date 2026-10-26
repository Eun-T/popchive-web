<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ status: 'ongoing' | 'upcoming' | 'ended' }>()
const statusStyles = {
  ongoing: { label: '운영 중', class: 'bg-brand-soft text-brand-strong' },
  upcoming: { label: '오픈 예정', class: 'bg-info-soft text-info-strong' },
  // Web adjustment: RN secondary-on-tag is 4.39:1; tag-text exceeds 4.5:1.
  ended: { label: '종료', class: 'bg-tag text-tag-text' }
} as const
const current = computed(() => statusStyles[props.status])
</script>

<template>
  <span class="inline-flex items-center rounded-rn-4 px-rn-8 py-rn-4 text-caption font-semibold" :class="current.class">{{ current.label }}</span>
</template>
