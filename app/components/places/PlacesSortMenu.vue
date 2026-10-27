<script setup lang="ts">
import { Check, ChevronDown, ChevronUp } from '@lucide/vue'
import type { PlaceSort } from '../../../shared/types/places'

const props = defineProps<{ modelValue: PlaceSort }>()
const emit = defineEmits<{ 'update:modelValue': [value: PlaceSort] }>()
const options: { value: PlaceSort; label: string }[] = [
  { value: 'LATEST', label: '최신 등록순' },
  { value: 'START_DATE_ASC', label: '시작일순' },
  { value: 'END_DATE_ASC', label: '종료일순' },
]
const selectedLabel = computed(() => options.find(option => option.value === props.modelValue)?.label)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const open = ref(false)
const activeIndex = ref(0)
const id = useId()
const triggerId = `places-sort-trigger-${id}`
const menuId = `places-sort-menu-${id}`

function focusOption(index: number) {
  activeIndex.value = (index + options.length) % options.length
  root.value?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')[activeIndex.value]?.focus()
}
async function openMenu() {
  activeIndex.value = Math.max(0, options.findIndex(option => option.value === props.modelValue))
  open.value = true
  await nextTick()
  if (open.value) focusOption(activeIndex.value)
}
function closeMenu(restoreFocus = false) {
  open.value = false
  if (restoreFocus) trigger.value?.focus()
}
function select(value: PlaceSort) {
  emit('update:modelValue', value)
  closeMenu(true)
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    event.stopPropagation()
    closeMenu(true)
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!open.value) void openMenu()
    else focusOption(activeIndex.value + (event.key === 'ArrowDown' ? 1 : -1))
  } else if (open.value && (event.key === 'Home' || event.key === 'End')) {
    event.preventDefault()
    focusOption(event.key === 'Home' ? 0 : options.length - 1)
  }
  // Enter/Space use native button activation; Tab moves out and focusout closes.
}
function onOutside(event: PointerEvent) {
  if (event.target instanceof Node && !root.value?.contains(event.target)) closeMenu()
}
function onFocusout(event: FocusEvent) {
  if (!(event.relatedTarget instanceof Node) || !root.value?.contains(event.relatedTarget)) closeMenu()
}
onMounted(() => document.addEventListener('pointerdown', onOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))
</script>

<template>
  <div ref="root" class="places-sort" @keydown="onKeydown" @focusout="onFocusout">
    <button
      :id="triggerId" ref="trigger" type="button" class="places-sort__trigger"
      aria-haspopup="menu" :aria-expanded="open" :aria-controls="open ? menuId : undefined"
      :aria-label="`팝업 정렬: ${selectedLabel}`" @click="open ? closeMenu() : openMenu()"
    >
      <span>{{ selectedLabel }}</span>
      <ChevronUp v-if="open" :size="14" aria-hidden="true" />
      <ChevronDown v-else :size="14" aria-hidden="true" />
    </button>
    <div v-if="open" :id="menuId" class="places-sort__menu" role="menu" :aria-labelledby="triggerId">
      <button
        v-for="(option, index) in options" :key="option.value" type="button"
        class="places-sort__option" :class="{ 'is-selected': modelValue === option.value }"
        role="menuitemradio" :aria-checked="modelValue === option.value"
        :tabindex="activeIndex === index ? 0 : -1" @focus="activeIndex = index" @click="select(option.value)"
      >
        <span>{{ option.label }}</span>
        <Check v-if="modelValue === option.value" :size="16" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.places-sort { position: relative; flex-shrink: 0; }
.places-sort__trigger {
  display: inline-flex; align-items: center; justify-content: space-between; gap: 8px;
  min-height: 32px; padding: 0 10px; border: 1px solid #E5E7EB; border-radius: 8px;
  background: #FFFFFF; color: var(--ds-secondary); font-size: 14px; line-height: 20px; white-space: nowrap;
}
.places-sort__menu {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 30;
  box-sizing: border-box; width: 190px; max-width: calc(100vw - 40px); padding: 8px;
  border: 1px solid #E5E7EB; border-radius: 12px; background: #FFFFFF;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}
.places-sort__option {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  width: 100%; height: 40px; padding: 0 12px; border: 0; border-radius: 8px;
  background: transparent; color: #374151; font-size: 14px; text-align: left; white-space: nowrap;
}
.places-sort__option:hover, .places-sort__option.is-selected { background: #F3F4F6; }
.places-sort__option.is-selected { color: #111827; font-weight: 600; }
.places-sort__trigger:focus-visible, .places-sort__option:focus-visible { outline: 2px solid #D1D5DB; outline-offset: 2px; }
.places-sort__option:focus-visible { outline-offset: -2px; }
.places-sort svg { flex-shrink: 0; }
</style>
