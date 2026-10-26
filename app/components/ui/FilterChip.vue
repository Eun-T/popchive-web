<script setup lang="ts">
withDefaults(defineProps<{ disabled?: boolean }>(), { disabled: false })
const selected = defineModel<boolean>('selected', { default: false })
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    :aria-pressed="selected"
    class="ds-control type-label inline-flex min-h-11 items-center justify-center gap-rn-6 rounded-pill border px-rn-16 py-rn-8 disabled:cursor-not-allowed disabled:border-border disabled:bg-disabled-bg disabled:text-disabled-text"
    :class="selected
      ? 'border-filter-selected bg-filter-selected text-filter-on-selected enabled:hover:underline'
      : 'border-secondary bg-background text-foreground enabled:hover:bg-surface'"
    @click="selected = !selected"
  >
    <slot />
  </button>
</template>
