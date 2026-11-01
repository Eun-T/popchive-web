<script setup lang="ts">
withDefaults(defineProps<{ as?: 'span' | 'li' }>(), { as: 'span' })
</script>

<template>
  <component :is="as" class="tag-chip"><slot /></component>
</template>

<style scoped>
.tag-chip {
  display: inline-block;
  min-width: 0;
  max-width: 100%;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--ds-tag);
  color: var(--ds-tag-text);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
