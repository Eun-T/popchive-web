<script setup lang="ts">
import { naverMapLink } from '~/utils/naverMapLink'

const props = defineProps<{
  destination: string; placeName: string; address: string | null
  latitude: number | null; longitude: number | null; countryCode: string | null
}>()
const android = ref(false)
const appname = ref('https://popchive.com')
const naverUrl = computed(() => naverMapLink({
  latitude: props.latitude, longitude: props.longitude, name: props.placeName,
  address: props.address, countryCode: props.countryCode,
}, android.value, appname.value))
const options = computed(() => [
  { id: 'google', label: '구글 지도', href: `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination: props.destination })}` },
  { id: 'naver', label: '네이버 지도', href: naverUrl.value },
  { id: 'apple', label: '애플 지도', href: `https://maps.apple.com/directions?${new URLSearchParams({ destination: props.destination })}` },
])
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const open = ref(false)
const activeIndex = ref(0)
const id = useId()
const triggerId = `popup-directions-trigger-${id}`
const menuId = `popup-directions-menu-${id}`
const navigationError = ref('')
let disposed = false
function focusOption(index: number) {
  if (disposed || !open.value || !root.value?.isConnected) return
  activeIndex.value = (index + options.value.length) % options.value.length
  root.value?.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]')[activeIndex.value]?.focus({ preventScroll: true })
}
async function openMenu() {
  activeIndex.value = 0
  navigationError.value = ''
  open.value = true
  await nextTick()
  if (!disposed && open.value && root.value?.isConnected) focusOption(0)
}
function closeMenu(restoreFocus = false) {
  open.value = false
  if (restoreFocus && !disposed && trigger.value?.isConnected) trigger.value.focus({ preventScroll: true })
}
function selectMap(event: MouseEvent, href: string | null) {
  if (!href) {
    event.preventDefault()
    navigationError.value = '네이버 지도에서 검색할 장소명이나 주소가 없습니다.'
  }
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
    focusOption(event.key === 'Home' ? 0 : options.value.length - 1)
  } else if (open.value && event.key === ' ' && event.target instanceof HTMLAnchorElement) {
    event.preventDefault()
    event.target.click()
  }
}
function onOutside(event: PointerEvent) {
  if (event.target instanceof Node && !root.value?.contains(event.target)) closeMenu()
}
function onFocusout(event: FocusEvent) {
  if (!(event.relatedTarget instanceof Node) || !root.value?.contains(event.relatedTarget)) closeMenu()
}
onMounted(() => {
  android.value = /Android/i.test(navigator.userAgent)
  appname.value = window.location.origin
  document.addEventListener('pointerdown', onOutside)
})
onBeforeUnmount(() => {
  disposed = true
  document.removeEventListener('pointerdown', onOutside)
})
</script>

<template>
  <div ref="root" class="popup-directions" @keydown="onKeydown" @focusout="onFocusout">
    <button
      :id="triggerId" ref="trigger" type="button" class="popup-directions__trigger"
      aria-haspopup="menu" :aria-expanded="open" :aria-controls="menuId"
      @click="open ? closeMenu() : openMenu()"
    >길찾기</button>
    <div v-show="open" :id="menuId" class="popup-directions__menu" role="menu" :aria-labelledby="triggerId" :aria-hidden="!open" :inert="!open">
      <a
        v-for="(option, index) in options" :key="option.id" :href="option.href ?? undefined" class="popup-directions__option"
        target="_blank" rel="noopener noreferrer" role="menuitem" :tabindex="open && activeIndex === index ? 0 : -1"
        @focus="activeIndex = index" @click="selectMap($event, option.href)"
      >{{ option.label }}</a>
    </div>
    <p v-if="navigationError" role="alert" class="popup-directions__error">{{ navigationError }}</p>
  </div>
</template>

<style scoped>
.popup-directions { position: relative; display: flex; min-width: 0; }
.popup-directions__trigger {
  display: flex; align-items: center; justify-content: center; width: 100%; min-width: 0;
  min-height: 44px; padding: 10px 16px; border: 1px solid #E5E7EB; border-radius: 5px;
  background: #FFFFFF; color: #111111; font-size: 14px; font-weight: 600;
}
.popup-directions__trigger:hover { background: #F5F5F7; }
/* Match PlacesSortMenu's menu/option styles; keep the sort component unchanged. */
.popup-directions__menu {
  position: absolute; top: calc(100% + 6px); left: 0; z-index: 30;
  box-sizing: border-box; width: 100%; padding: 8px;
  border: 1px solid #E5E7EB; border-radius: 12px; background: #FFFFFF;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}
.popup-directions__option {
  display: flex; align-items: center; width: 100%; height: 40px; padding: 0 12px;
  border: 0; border-radius: 8px; color: #374151; font-size: 14px; font-weight: 400;
  text-decoration: none; white-space: nowrap; text-align: left;
}
.popup-directions__option:hover { background: #F5F5F7; }
.popup-directions__option:focus-visible { outline: 2px solid #D1D5DB; outline-offset: -2px; }
.popup-directions__trigger:focus-visible { outline: 2px solid #D1D5DB; outline-offset: 2px; }
.popup-directions__error { position: absolute; top: calc(100% + 6px); left: 0; z-index: 30; width: 100%; padding: 8px; border: 1px solid #E5E7EB; border-radius: 8px; background: white; color: #374151; font-size: 13px; }
</style>
