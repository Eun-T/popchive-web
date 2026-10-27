<script setup lang="ts">
import { Search } from '@lucide/vue'
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
              :aria-current="route.path === item.to ? 'page' : undefined"
              class="app-header__link ds-control"
              :class="{ 'app-header__link--current': route.path === item.to }"
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
    </div>
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
</style>
