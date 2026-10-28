<script setup lang="ts">
import { Menu, Search, X } from '@lucide/vue'
import HomeQuickSearch from '~/components/home/HomeQuickSearch.vue'
import { webFeatures } from '~/config/features'

// Set a destination only when the corresponding real page is implemented.
const items: { label: string; to: string | null; visible?: boolean }[] = [
  { label: '홈', to: '/' },
  { label: '플레이스', to: '/places' },
  { label: '지도', to: '/map' },
  { label: '커뮤니티', to: null, visible: webFeatures.communityNavigation }
]
const visibleItems = items.filter(item => item.visible !== false)
const route = useRoute()
function isActive(to: string) {
  return route.path === to || (to === '/places' && route.path.startsWith('/places/'))
}
const mobileItems = items.filter(item => item.to && item.to !== '/community')
const searchOpen = ref(false)
const drawerOpen = ref(false)
const drawerVisible = ref(false)
let drawerFrame: number | undefined
let drawerCloseTimer: ReturnType<typeof setTimeout> | undefined
const searchId = useId()
const drawerId = useId()
const quickSearch = ref<InstanceType<typeof HomeQuickSearch> | null>(null)
const searchButton = ref<HTMLButtonElement | null>(null)
const drawer = ref<HTMLDialogElement | null>(null)
let mobileQuery: MediaQueryList | undefined
let previousOverflow: string | undefined

function toggleSearch() {
  searchOpen.value = !searchOpen.value
}
function focusSearch() {
  if (searchOpen.value && mobileQuery?.matches) quickSearch.value?.focus()
}
function closeSearch() {
  searchOpen.value = false
  searchButton.value?.focus()
}
function openDrawer() {
  if (!mobileQuery?.matches || !drawer.value || drawer.value.open) return
  searchOpen.value = false
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  drawer.value.showModal()
  drawerOpen.value = true
  // Commit the off-screen position before transitioning, including in Safari.
  void drawer.value.offsetWidth
  // Flush the newly created backdrop's transparent state before the shared toggle.
  void window.getComputedStyle(drawer.value, '::backdrop').opacity
  drawerFrame = requestAnimationFrame(() => { drawerVisible.value = true })
}
function closeDrawer() {
  if (!drawer.value?.open || drawerCloseTimer !== undefined) return
  if (drawerFrame !== undefined) cancelAnimationFrame(drawerFrame)
  drawerVisible.value = false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finishDrawerClose()
  else drawerCloseTimer = setTimeout(finishDrawerClose, 350)
}
function finishDrawerClose() {
  clearTimeout(drawerCloseTimer)
  drawerCloseTimer = undefined
  if (drawerFrame !== undefined) cancelAnimationFrame(drawerFrame)
  drawerVisible.value = false
  drawerOpen.value = false
  drawer.value?.close()
  if (previousOverflow !== undefined) {
    document.body.style.overflow = previousOverflow
    previousOverflow = undefined
  }
}
function onDrawerTransitionEnd(event: TransitionEvent) {
  if (event.target === drawer.value && event.propertyName === 'transform' && !drawerVisible.value) finishDrawerClose()
}
function onBackdropClick(event: MouseEvent) {
  if (event.target !== drawer.value || !drawer.value) return
  const bounds = drawer.value.getBoundingClientRect()
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDrawer()
}
function onViewportChange() {
  if (mobileQuery?.matches) return
  searchOpen.value = false
  finishDrawerClose()
}
watch(() => route.fullPath, () => {
  searchOpen.value = false
  closeDrawer()
})
onMounted(() => {
  mobileQuery = window.matchMedia('(width < 768px)')
  mobileQuery.addEventListener('change', onViewportChange)
})
onBeforeUnmount(() => {
  mobileQuery?.removeEventListener('change', onViewportChange)
  finishDrawerClose()
})
</script>

<template>
  <header class="app-header border-b border-border bg-background">
    <div class="app-header__container">
      <div class="app-header__start">
        <slot name="brand">
          <NuxtLink to="/" class="app-header__brand ds-control">
            <img src="/logo.png" alt="POPCHIVE" class="app-header__logo" />
          </NuxtLink>
        </slot>
      </div>

      <nav class="app-header__nav" aria-label="주요 메뉴">
        <ul class="app-header__menu">
          <li
            v-for="item in visibleItems"
            :key="item.label"
            :class="{ 'app-header__pending-item': !item.to }"
          >
            <NuxtLink
              v-if="item.to"
              :to="item.to"
              :aria-current="isActive(item.to) ? 'page' : undefined"
              class="app-header__link ds-control"
              :class="{ 'app-header__link--current': isActive(item.to) }"
            >{{ item.label }}</NuxtLink>
            <a
              v-else
              role="link"
              aria-disabled="true"
              tabindex="-1"
              :aria-label="`${item.label} (준비 중)`"
              :title="`${item.label} 페이지 준비 중`"
              class="app-header__link app-header__placeholder"
            >{{ item.label }}</a>
          </li>
        </ul>
      </nav>

      <div class="app-header__actions" role="group" aria-label="검색 및 계정 (준비 중)">
        <button type="button" disabled aria-label="검색" title="검색 기능 준비 중" class="app-header__search app-header__placeholder text-secondary">
          <Search :size="20" aria-hidden="true" />
        </button>
        <button type="button" disabled title="로그인 기능 준비 중" class="app-header__login app-header__placeholder type-label text-secondary">로그인</button>
        <button type="button" disabled title="회원가입 기능 준비 중" class="app-header__signup app-header__placeholder type-label border border-border bg-background text-foreground">회원가입</button>
      </div>
      <div class="app-header__mobile-actions">
        <button ref="searchButton" type="button" class="app-header__mobile-button ds-control" aria-label="검색창 열기/닫기" :aria-expanded="searchOpen" :aria-controls="searchId" @click="toggleSearch">
          <Search :size="20" aria-hidden="true" />
        </button>
        <button type="button" class="app-header__mobile-button ds-control" aria-label="메뉴 열기" aria-haspopup="dialog" :aria-expanded="drawerOpen" :aria-controls="drawerId" @click="openDrawer">
          <Menu :size="24" aria-hidden="true" />
        </button>
      </div>
    </div>
    <Transition name="header-search" @after-enter="focusSearch">
      <div v-if="searchOpen" :id="searchId" class="app-header__mobile-search" :inert="!searchOpen" @keydown.esc="closeSearch">
        <div class="app-header__search-clip">
          <div class="app-header__search-content"><HomeQuickSearch ref="quickSearch" /></div>
        </div>
      </div>
    </Transition>
    <dialog :id="drawerId" ref="drawer" class="app-header__drawer" :class="{ 'is-visible': drawerVisible }" aria-label="주요 메뉴" @cancel.prevent="closeDrawer" @close="finishDrawerClose" @transitionend="onDrawerTransitionEnd" @click="onBackdropClick">
      <div class="app-header__drawer-heading">
        <span class="type-body font-semibold">메뉴</span>
        <button type="button" autofocus class="app-header__mobile-button ds-control" aria-label="메뉴 닫기" @click="closeDrawer"><X :size="24" aria-hidden="true" /></button>
      </div>
      <nav aria-label="모바일 주요 메뉴">
        <NuxtLink v-for="item in mobileItems" :key="item.to!" :to="item.to!" class="app-header__drawer-link ds-control" :class="{ 'is-active': isActive(item.to!) }" :aria-current="isActive(item.to!) ? 'page' : undefined" @click="closeDrawer">{{ item.label }}</NuxtLink>
      </nav>
    </dialog>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 40;
  width: 100%;
  height: 64px;
  box-shadow: none;
}

.app-header__container {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  column-gap: 16px;
  width: calc(100% - 40px);
  max-width: 1080px;
  height: 100%;
  margin-inline: auto;
}

.app-header__start { min-width: 0; }
.app-header__brand {
  display: flex;
  align-items: center;
  width: fit-content;
  max-width: 100%;
}
.app-header__logo {
  display: block;
  width: auto;
  height: 40px;
  max-width: 100%;
  object-fit: contain;
}
.app-header__nav { justify-self: center; }
.app-header__menu {
  display: flex;
  align-items: center;
  gap: 32px;
}
.app-header__link {
  display: inline-flex;
  min-width: 40px;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  color: var(--ds-secondary);
  font-size: var(--ds-body-size);
  font-weight: 500;
  line-height: var(--ds-body-leading);
  text-decoration: none;
  white-space: nowrap;
}
.app-header__link[href]:hover { color: var(--ds-text); }
.app-header__link--current,
.app-header__link--current[href]:hover {
  color: var(--ds-accent-purple);
  font-weight: 600;
}
.app-header__actions {
  display: flex;
  align-items: center;
  justify-self: end;
  gap: 18px;
  white-space: nowrap;
}
.app-header__search {
  display: inline-flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  background: none;
  border: 0;
}
.app-header__login {
  min-height: 40px;
  background: none;
  border: 0;
}
.app-header__signup {
  height: 36px;
  border-radius: 6px;
  padding-inline: 14px;
}
.app-header__placeholder { cursor: not-allowed; }
.app-header__mobile-actions,
.app-header__mobile-search { display: none; }
.app-header__mobile-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border: 0;
  border-radius: var(--ds-radius-8, 8px);
  background: transparent;
  color: var(--ds-text);
}
/* Native modal dialog supplies focus trapping, background inertness and Escape. */
.app-header__drawer {
  position: fixed;
  inset: 0 0 0 auto;
  width: 100vw;
  max-width: 100%;
  height: 100dvh;
  max-height: 100dvh;
  margin: 0;
  padding: 16px;
  border: 0;
  background: var(--ds-background);
  color: var(--ds-text);
  overflow-y: auto;
  overscroll-behavior: contain;
  transform: translateX(100%);
  transition: transform 300ms ease-in-out;
  will-change: transform;
}
.app-header__drawer.is-visible { transform: translateX(0); }
.app-header__drawer::backdrop {
  background: rgb(0 0 0 / 45%);
  opacity: 0;
  transition: opacity 300ms ease-in-out;
}
.app-header__drawer.is-visible::backdrop { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .app-header__drawer,
  .app-header__drawer::backdrop { transition: none; }
}
.app-header__drawer-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.app-header__drawer-link {
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: var(--ds-body-size);
  line-height: var(--ds-body-leading);
  font-weight: 500;
  color: var(--ds-secondary);
}
.app-header__drawer-link:hover { background: var(--ds-tag); }
.app-header__drawer-link.is-active { color: var(--ds-accent-purple); font-weight: 600; }

/* Temporary narrow-screen fallback, not a finalized mobile navigation. */
@media (width < 900px) {
  .app-header__container {
    grid-template-columns: auto minmax(0, 1fr);
    column-gap: 12px;
  }
  .app-header__menu { gap: 12px; }
  .app-header__pending-item,
  .app-header__actions { display: none; }
}
@media (width < 768px) {
  .app-header { height: auto; min-height: 64px; }
  .app-header__logo { height: 32px; }
  .app-header__container { height: 64px; grid-template-columns: minmax(0, 1fr) auto; }
  .app-header__nav { display: none; }
  .app-header__mobile-actions { display: flex; align-items: center; justify-self: end; gap: 4px; }
  .app-header__mobile-actions .app-header__mobile-button { padding: 0; margin: 0; }
  .app-header__mobile-search { display: grid; grid-template-rows: 1fr; }
  .app-header__search-clip { min-height: 0; }
  .app-header__search-content { padding: 12px 20px 16px; border-top: 1px solid var(--ds-border); opacity: 1; transform: translateY(0); }
  .header-search-enter-active,
  .header-search-leave-active { transition: grid-template-rows 280ms ease-out; }
  .header-search-enter-active .app-header__search-clip,
  .header-search-leave-active .app-header__search-clip { overflow: hidden; }
  .header-search-enter-active .app-header__search-content,
  .header-search-leave-active .app-header__search-content { transition: transform 280ms ease-out, opacity 280ms ease-out; }
  .header-search-enter-from,
  .header-search-leave-to { grid-template-rows: 0fr; }
  .header-search-enter-from .app-header__search-content,
  .header-search-leave-to .app-header__search-content { opacity: 0; transform: translateY(-8px); }
  .app-header__mobile-search :deep(.home-search__button) { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .app-header__mobile-search,
  .app-header__mobile-search .app-header__search-content { transition: none; }
}
</style>
