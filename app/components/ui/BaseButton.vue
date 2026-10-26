<script setup lang="ts">
const {
  variant = 'primary',
  disabled = false,
  type = 'button'
} = defineProps<{
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}>()
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="ds-control type-label inline-flex min-h-rn-48 items-center justify-center gap-rn-8 rounded-rn-12 border px-rn-16 py-rn-12 disabled:cursor-not-allowed disabled:border-border disabled:bg-disabled-bg disabled:text-disabled-text"
    :class="variant === 'primary'
      ? 'border-transparent bg-brand text-on-brand enabled:hover:bg-brand-soft enabled:active:bg-brand-soft'
      : 'border-secondary bg-background text-foreground enabled:hover:bg-surface enabled:active:bg-tag'"
  >
    <slot />
  </button>
</template>
