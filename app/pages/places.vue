<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { ChevronDown, Heart, SlidersHorizontal, X } from "@lucide/vue";
import PlacesEndingSoon from "~/components/places/PlacesEndingSoon.vue";
import PlacesVenues from "~/components/places/PlacesVenues.vue";
import PlacesRegions from "~/components/places/PlacesRegions.vue";
import PlacesWeekly from "~/components/places/PlacesWeekly.vue";
import PlacesInterests from "~/components/places/PlacesInterests.vue";
import { PLACE_INTERESTS } from '#shared/utils/placeInterests';
import { usePlacesBrowse, emptyPlaceFilters, copyPlaceFilters } from '~/composables/usePlacesBrowse';
import type { PlaceFilterKey, PlaceFilters } from '~/composables/usePlacesBrowse';
import type { PlacePopup, PlaceCountry } from '../../shared/types/places';
import { PAGE_SEO } from '#shared/utils/seo';

usePopchiveSeo(PAGE_SEO['/places']);

definePageMeta({ layout: "default" });

const tabs = [
  { id: "explore", label: "탐색" },
  { id: "all", label: "전체" },
] as const;
const route = useRoute();
const router = useRouter();
const selectedTab = ref<"explore" | "all">(route.query.tab === 'explore' ? 'explore' : 'all');
function categoryFromRoute() {
  const value = route.query.tagId;
  return route.query.tab === 'all' && typeof value === 'string'
    ? PLACE_INTERESTS.find(category => String(category.tagId) === value)?.tagId : undefined;
}
function selectTab(tab: 'explore' | 'all') {
  selectedTab.value = tab;
  if (route.query.tagId !== undefined || route.query.tab !== undefined) {
    const { tagId: _, tab: __, ...query } = route.query;
    void router.replace({ query: { ...query, tab } });
  }
}

function onTabKeydown(event: KeyboardEvent, index: number) {
  let nextIndex: number;
  switch (event.key) {
    case "ArrowRight":
      nextIndex = (index + 1) % tabs.length;
      break;
    case "ArrowLeft":
      nextIndex = (index - 1 + tabs.length) % tabs.length;
      break;
    case "Home":
      nextIndex = 0;
      break;
    case "End":
      nextIndex = tabs.length - 1;
      break;
    default:
      return;
  }
  const nextTab = tabs[nextIndex];
  if (!nextTab) return;
  event.preventDefault();
  selectTab(nextTab.id);
  const tabList = (event.currentTarget as HTMLButtonElement).parentElement;
  tabList
    ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    [nextIndex]?.focus();
}

type FilterKey = PlaceFilterKey;
type FilterGroup = { key: FilterKey; label: string; multiple: boolean; options: { value: string; label: string }[] };
const emptyFilters = emptyPlaceFilters;
const copyFilters = copyPlaceFilters;
const browse = usePlacesBrowse(categoryFromRoute());
await browse.ready;
const {
  options, optionsError, refreshOptions, appliedFilters, draftFilters, filterGroups, activeChips, appliedCount,
  filteredPopups, listStatus, listError, refreshList, nextCursor, moreLoading, moreError, loadMore, removeFilter, selectRegion, selectCategory,
} = browse;
function toggleDraft(group: FilterGroup, value: string) { browse.toggleDraft(group.key, value); }
async function onSelectRegion(countryCode: PlaceCountry, regionId: number) {
  if (!selectRegion(countryCode, regionId)) return;
  selectTab('all');
  await nextTick();
  document.getElementById('places-panel-all')?.focus({ preventScroll: true });
  document.querySelector('.places-tabs')?.scrollIntoView({ block: 'start', behavior: 'instant' });
}
let interestOrigin: PlaceFilters | undefined;
let interestNavigation = false;
watch(() => [route.query.tab, route.query.tagId], () => {
  const category = categoryFromRoute();
  if (category !== undefined && selectCategory(category)) selectedTab.value = 'all';
  else if (route.query.tab === 'explore') {
    selectedTab.value = 'explore';
    if (interestOrigin) {
      appliedFilters.value = copyFilters(interestOrigin);
      draftFilters.value = copyFilters(interestOrigin);
    }
  } else if (route.query.tab === 'all') selectedTab.value = 'all';
});
async function onSelectCategory(tagId: number) {
  if (interestNavigation || !PLACE_INTERESTS.some(category => category.tagId === tagId
    && options.value?.tags.some(tag => tag.id === tagId && tag.name === category.name))) return;
  interestNavigation = true;
  interestOrigin = copyFilters(appliedFilters.value);
  try {
    // Record Explore as the origin so browser Back returns to the category section.
    const { tagId: _, tab: __, ...query } = route.query;
    await router.replace({ query: { ...query, tab: 'explore' } });
    await router.push({ query: { ...query, tab: 'all', tagId: String(tagId) } });
    await nextTick();
    document.getElementById('places-panel-all')?.focus({ preventScroll: true });
    document.querySelector('.places-tabs')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  } finally { interestNavigation = false; }
}

const filterDialog = ref<HTMLDialogElement | null>(null);
const filterSheet = ref<HTMLElement | null>(null);
const filterTrigger = ref<HTMLButtonElement | null>(null);
const filterCloseButton = ref<HTMLButtonElement | null>(null);
const isFilterOpen = ref(false);
const isSheetVisible = ref(false);
const isSheetClosing = ref(false);
const isSheetDragging = ref(false);
const sheetDragOffset = ref(0);
const sheetTransitionMs = 280;
let openFrame: number | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let isUnmounting = false;
let sheetDrag: {
  pointerId: number;
  startY: number;
  handle: HTMLElement;
} | null = null;
let scrollLock: {
  overflow: string;
  paddingRight: string;
  bodyOverflow: string;
  x: number;
  y: number;
} | null = null;

function lockPageScroll() {
  if (scrollLock) return;
  const root = document.documentElement;
  const scrollbarWidth = window.innerWidth - root.clientWidth;
  const currentPadding =
    Number.parseFloat(window.getComputedStyle(root).paddingRight) || 0;
  scrollLock = {
    overflow: root.style.overflow,
    paddingRight: root.style.paddingRight,
    bodyOverflow: document.body.style.overflow,
    x: window.scrollX,
    y: window.scrollY,
  };
  root.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  if (scrollbarWidth > 0)
    root.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
}
function restorePageScroll() {
  if (!scrollLock) return;
  const previous = scrollLock;
  scrollLock = null;
  document.documentElement.style.overflow = previous.overflow;
  document.documentElement.style.paddingRight = previous.paddingRight;
  document.body.style.overflow = previous.bodyOverflow;
  window.scrollTo({ left: previous.x, top: previous.y, behavior: "instant" });
}
function clearSheetAnimation() {
  if (openFrame !== null) cancelAnimationFrame(openFrame);
  if (closeTimer !== null) clearTimeout(closeTimer);
  openFrame = null;
  closeTimer = null;
}
function releaseSheetDrag() {
  const drag = sheetDrag;
  sheetDrag = null;
  isSheetDragging.value = false;
  if (drag?.handle.hasPointerCapture(drag.pointerId))
    drag.handle.releasePointerCapture(drag.pointerId);
}
function openFilters() {
  const dialog = filterDialog.value;
  if (!dialog || dialog.open) return;
  clearSheetAnimation();
  draftFilters.value = copyFilters(appliedFilters.value);
  isSheetClosing.value = false;
  isSheetVisible.value = false;
  sheetDragOffset.value = 0;
  lockPageScroll();
  dialog.showModal();
  isFilterOpen.value = true;
  filterCloseButton.value?.focus({ preventScroll: true });
  // Paint the off-screen position before starting the entrance transition.
  openFrame = requestAnimationFrame(() => {
    openFrame = requestAnimationFrame(() => {
      openFrame = null;
      if (dialog.open && !isSheetClosing.value) isSheetVisible.value = true;
    });
  });
}
function onDialogClosed() {
  const wasOpen = isFilterOpen.value;
  clearSheetAnimation();
  releaseSheetDrag();
  isFilterOpen.value = false;
  isSheetVisible.value = false;
  isSheetClosing.value = false;
  sheetDragOffset.value = 0;
  draftFilters.value = copyFilters(appliedFilters.value);
  restorePageScroll();
  if (wasOpen && !isUnmounting)
    filterTrigger.value?.focus({ preventScroll: true });
}
function finishSheetClose() {
  filterDialog.value?.close();
  onDialogClosed();
}
function closeFilters() {
  if (!filterDialog.value?.open || isSheetClosing.value) return;
  const wasVisible = isSheetVisible.value;
  clearSheetAnimation();
  releaseSheetDrag();
  isSheetClosing.value = true;
  isSheetVisible.value = false;
  if (
    !wasVisible ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    finishSheetClose();
    return;
  }
  // Keep the native dialog and scroll lock until the exit transition finishes.
  closeTimer = setTimeout(finishSheetClose, sheetTransitionMs + 80);
}
function onSheetTransitionEnd(event: TransitionEvent) {
  if (
    event.target === filterSheet.value &&
    event.propertyName === "transform" &&
    isSheetClosing.value
  ) {
    finishSheetClose();
  }
}
function applyFilters() {
  appliedFilters.value = copyFilters(draftFilters.value);
  closeFilters();
}
function startSheetDrag(event: PointerEvent) {
  if (
    !event.isPrimary ||
    event.button !== 0 ||
    !isSheetVisible.value ||
    isSheetClosing.value
  )
    return;
  event.preventDefault();
  const handle = event.currentTarget as HTMLElement;
  handle.setPointerCapture(event.pointerId);
  sheetDrag = { pointerId: event.pointerId, startY: event.clientY, handle };
  sheetDragOffset.value = 0;
  isSheetDragging.value = true;
}
function moveSheetDrag(event: PointerEvent) {
  if (!sheetDrag || event.pointerId !== sheetDrag.pointerId) return;
  sheetDragOffset.value = Math.max(0, event.clientY - sheetDrag.startY);
}
function endSheetDrag(event: PointerEvent) {
  if (!sheetDrag || event.pointerId !== sheetDrag.pointerId) return;
  const shouldClose = sheetDragOffset.value >= 96;
  releaseSheetDrag();
  if (shouldClose) closeFilters();
  else sheetDragOffset.value = 0;
}
function cancelSheetDrag(event: PointerEvent) {
  if (!sheetDrag || event.pointerId !== sheetDrag.pointerId) return;
  releaseSheetDrag();
  sheetDragOffset.value = 0;
}
function onHandleClick(event: MouseEvent) {
  // Keyboard/assistive activation closes; a short pointer drag only snaps back.
  if (event.detail === 0) closeFilters();
}
onBeforeUnmount(() => {
  isUnmounting = true;
  clearSheetAnimation();
  releaseSheetDrag();
  filterDialog.value?.close();
  restorePageScroll();
});

const failedImages = ref(new Set<string>());
function formatPeriod(popup: PlacePopup) {
  return `${popup.startDate?.replaceAll("-", ".") ?? "시작일 미정"} ~ ${popup.endDate?.replaceAll("-", ".") ?? "종료일 미정"}`;
}
</script>

<template>
  <div class="places-page">
    <h1 class="sr-only">플레이스</h1>

    <div class="places-tabs" role="tablist" aria-label="플레이스 보기">
      <button
        v-for="(tab, index) in tabs"
        :id="`places-tab-${tab.id}`"
        :key="tab.id"
        type="button"
        role="tab"
        class="places-tabs__tab"
        :class="{ 'places-tabs__tab--selected': selectedTab === tab.id }"
        :aria-selected="selectedTab === tab.id"
        :aria-controls="`places-panel-${tab.id}`"
        :tabindex="selectedTab === tab.id ? 0 : -1"
        @click="selectTab(tab.id)"
        @keydown="onTabKeydown($event, index)"
      >
        {{ tab.label }}
      </button>
    </div>

    <section
      v-show="selectedTab === 'all'"
      id="places-panel-all"
      class="places-panel"
      role="tabpanel"
      aria-labelledby="places-tab-all"
      tabindex="0"
    >
      <h2 class="sr-only">팝업 목록</h2>
      <div class="places-filter-toolbar">
        <div class="places-filter-toolbar__conditions">
          <button
            type="button"
            class="places-filter-button"
            ref="filterTrigger"
            aria-haspopup="dialog"
            aria-controls="places-filter-dialog"
            :aria-expanded="isFilterOpen"
            :aria-label="`조건 설정, ${appliedCount}개 적용`"
            @click="openFilters"
          >
            <SlidersHorizontal :size="16" aria-hidden="true" />
            <span>조건 설정</span>
            <span aria-live="polite" aria-atomic="true">{{
              appliedCount
            }}</span>
          </button>
          <button
            v-for="chip in activeChips"
            :key="`${chip.group}-${chip.value}`"
            type="button"
            class="places-applied-chip"
            :aria-label="`${chip.label} 조건 삭제`"
            @click="removeFilter(chip.group, chip.value)"
          >
            <span>{{ chip.label }}</span>
            <X :size="12" aria-hidden="true" />
          </button>
        </div>
        <span class="places-sort">
          최신 등록순 <ChevronDown :size="14" aria-hidden="true" />
        </span>
      </div>
      <p v-if="optionsError" class="places-empty" role="alert">필터 정보를 불러오지 못했습니다. <button type="button" class="places-list-action" @click="refreshOptions()">다시 시도</button></p>
      <p v-if="listStatus === 'pending'" class="places-empty" role="status">팝업을 불러오는 중입니다.</p>
      <p v-else-if="listError" class="places-empty" role="alert">팝업을 불러오지 못했습니다. <button type="button" class="places-list-action" @click="refreshList()">다시 시도</button></p>
      <p v-else-if="!filteredPopups.length" class="places-empty" role="status">
        선택한 조건에 맞는 팝업이 없습니다.
      </p>
      <ul v-else class="places-grid">
        <li v-for="popup in filteredPopups" :key="popup.id" class="places-card">
          <div class="places-card__poster">
            <img
              v-if="popup.image && !failedImages.has(popup.image)"
              :src="popup.image"
              :alt="`${popup.title} 포스터`"
              width="300"
              height="400"
              loading="lazy"
              draggable="false"
              @error="failedImages.add(popup.image)"
            />
            <p v-else class="places-card__image-state">
              {{ popup.image ? "이미지를 불러올 수 없습니다." : "등록된 이미지가 없습니다." }}
            </p>
            <NuxtLink :to="`/places/${encodeURIComponent(popup.id)}`" class="places-card__detail-link" :aria-label="`${popup.title} 상세 보기`" draggable="false" />
            <button
              type="button"
              disabled
              class="places-card__favorite"
              aria-label="찜하기 (준비 중)"
              title="찜 기능 준비 중"
            >
              <Heart :size="24" :stroke-width="2" fill="#6B7280" aria-hidden="true" />
            </button>
          </div>
          <h3 class="places-card__title" :title="popup.title">
            <NuxtLink :to="`/places/${encodeURIComponent(popup.id)}`" draggable="false">{{ popup.title }}</NuxtLink>
          </h3>
          <p class="places-card__period">{{ formatPeriod(popup) }}</p>
        </li>
      </ul>
      <div v-if="nextCursor && !listError && listStatus === 'success'" class="places-pagination">
        <p v-if="moreError" role="alert">다음 팝업을 불러오지 못했습니다.</p>
        <button type="button" class="places-list-action" :disabled="moreLoading" @click="loadMore">{{ moreLoading ? '불러오는 중…' : moreError ? '다시 시도' : '더 보기' }}</button>
      </div>
    </section>

    <section
      v-show="selectedTab === 'explore'"
      id="places-panel-explore"
      class="places-panel"
      role="tabpanel"
      aria-labelledby="places-tab-explore"
      tabindex="0"
    >
      <PlacesEndingSoon :active="selectedTab === 'explore'" />
      <PlacesVenues :active="selectedTab === 'explore'" />
      <PlacesRegions :active="selectedTab === 'explore'" :regions="options?.regions ?? []" @select="onSelectRegion" />
      <PlacesWeekly :active="selectedTab === 'explore'" />
      <PlacesInterests :tags="options?.tags ?? []" @select="onSelectCategory" />
    </section>
    <dialog
      id="places-filter-dialog"
      ref="filterDialog"
      class="places-filter-dialog"
      :class="{
        'places-filter-dialog--visible': isSheetVisible,
        'places-filter-dialog--dragging': isSheetDragging,
      }"
      aria-labelledby="places-filter-title"
      aria-modal="true"
      @cancel.prevent="closeFilters"
      @close="onDialogClosed"
      @click.self="closeFilters"
    >
      <div
        class="places-filter-overlay"
        aria-hidden="true"
        @click="closeFilters"
      />
      <div
        ref="filterSheet"
        class="places-filter-sheet"
        :style="{ '--places-sheet-offset': `${sheetDragOffset}px` }"
        :inert="isSheetClosing"
        @transitionend="onSheetTransitionEnd"
      >
        <button
          type="button"
          class="places-filter-sheet__handle"
          aria-label="필터 시트 닫기, 아래로 드래그 가능"
          @pointerdown="startSheetDrag"
          @pointermove="moveSheetDrag"
          @pointerup="endSheetDrag"
          @pointercancel="cancelSheetDrag"
          @lostpointercapture="cancelSheetDrag"
          @click="onHandleClick"
        >
          <span aria-hidden="true" />
        </button>
        <header class="places-filter-dialog__header">
          <h2 id="places-filter-title" class="type-title-m">조건 설정</h2>
          <button
            type="button"
            ref="filterCloseButton"
            class="places-filter-dialog__close"
            aria-label="조건 설정 닫기"
            autofocus
            @click="closeFilters"
          >
            <X :size="20" aria-hidden="true" />
          </button>
        </header>
        <div class="places-filter-dialog__body">
          <fieldset
            v-for="group in filterGroups"
            :key="group.key"
            class="places-filter-group"
          >
            <legend>{{ group.label }}</legend>
            <div class="places-filter-group__options">
              <button
                v-if="!group.multiple"
                type="button"
                class="places-filter-option"
                :class="{
                  'places-filter-option--selected':
                    !draftFilters[group.key].length,
                }"
                :aria-pressed="!draftFilters[group.key].length"
                @click="draftFilters[group.key] = []"
              >
                전체
              </button>
              <button
                v-for="option in group.options"
                :key="option.value"
                type="button"
                class="places-filter-option"
                :class="{
                  'places-filter-option--selected': draftFilters[
                    group.key
                  ].includes(option.value),
                }"
                :aria-pressed="draftFilters[group.key].includes(option.value)"
                @click="toggleDraft(group, option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </fieldset>
        </div>
        <footer class="places-filter-dialog__footer">
          <button
            type="button"
            class="places-filter-dialog__reset"
            @click="draftFilters = emptyFilters()"
          >
            초기화
          </button>
          <button
            type="button"
            class="places-filter-dialog__apply"
            @click="applyFilters"
          >
            결과 보기
          </button>
        </footer>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.places-pagination { display: grid; justify-items: center; gap: 12px; margin-top: 28px; color: var(--ds-secondary); font-size: 14px; }
.places-list-action { padding: 8px 16px; border: 1px solid var(--ds-border); border-radius: 8px; color: var(--ds-text); }
.places-list-action:disabled { opacity: 0.5; cursor: default; }
.places-tabs { scroll-margin-top: 80px; }
.places-card__detail-link { position: absolute; inset: 0; border-radius: inherit; }
.places-card__detail-link:focus-visible { outline-offset: -3px; }
.places-page {
  --places-filter-soft: #f3efff;
  --places-filter-accent: #6d28d9;
  --places-filter-border: #c4b5fd;
  width: 100%;
  max-width: 826px;
  min-width: 0;
  padding-bottom: 48px;
  color: #111827;
}
.places-tabs {
  display: flex;
  gap: 24px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}
.places-tabs__tab {
  margin-bottom: -1px;
  padding: 12px 0;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  color: #6b7280;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  cursor: pointer;
}
.places-tabs__tab--selected {
  border-bottom-color: #111827;
  color: #111827;
  font-weight: 600;
}
.places-panel {
  margin-top: 24px;
}
.places-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 12px;
  row-gap: 32px;
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
}
.places-card {
  min-width: 0;
}
.places-card__poster {
  position: relative;
  overflow: hidden;
  aspect-ratio: 3 / 4;
  border-radius: 6px;
  background: #f3f4f6;
}
.places-card__poster img {
  display: block;
  width: 100%;
  height: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  user-select: none;
}
.places-card__favorite {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #fff;
}
.places-card__favorite :deep(svg) {
  filter: drop-shadow(0 1px 2px rgb(0 0 0 / 25%));
}
.places-card__title {
  overflow: hidden;
  min-width: 0;
  margin-top: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}
.places-card__period {
  margin-top: 6px;
  color: #6b7280;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
}
.places-card__image-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  color: #6b7280;
  font-size: 13px;
  text-align: center;
}
.places-page__pending {
  color: #6b7280;
  font-size: 14px;
  line-height: 20px;
}
.places-tabs__tab:focus-visible,
.places-panel:focus-visible {
  outline: 2px solid #111827;
  outline-offset: 4px;
}
@media (min-width: 768px) {
  .places-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (min-width: 1120px) {
  .places-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
.places-filter-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ds-space-12);
}
.places-filter-toolbar__conditions {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ds-space-8);
}
.places-filter-button {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--ds-space-6);
  min-height: 32px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ds-text);
  font-size: var(--ds-label-size);
  font-weight: 600;
  line-height: var(--ds-label-leading);
  cursor: pointer;
}
.places-filter-button:hover {
  color: var(--ds-tag-text);
}
.places-applied-chip {
  display: inline-flex;
  max-width: 100%;
  min-height: 28px;
  align-items: center;
  gap: var(--ds-space-6);
  padding: var(--ds-space-4) var(--ds-space-8);
  border: 0;
  border-radius: var(--ds-radius-4);
  background: var(--ds-tag);
  color: var(--ds-tag-text);
  font-size: var(--ds-caption-size);
  line-height: var(--ds-caption-leading);
  cursor: pointer;
}
.places-applied-chip span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.places-applied-chip svg {
  flex-shrink: 0;
}
.places-applied-chip:hover {
  background: var(--ds-border);
}
.places-sort {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--ds-space-4);
  min-height: 32px;
  color: var(--ds-secondary);
  font-size: var(--ds-label-size);
  line-height: var(--ds-label-leading);
}
.places-empty {
  padding-block: var(--ds-space-48);
  color: var(--ds-secondary);
  font-size: var(--ds-label-size);
  text-align: center;
}
.places-filter-dialog {
  position: fixed;
  inset: 0;
  width: 100%;
  max-width: none;
  height: 100vh;
  height: 100dvh;
  max-height: none;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  color: var(--ds-text);
}
.places-filter-dialog[open] {
  display: block;
}
.places-filter-dialog::backdrop {
  background: transparent;
}
.places-filter-overlay {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 45%);
  opacity: 0;
  transition: opacity 280ms ease-out;
}
.places-filter-sheet {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  width: calc(100% - 32px);
  max-width: 820px;
  max-height: 85vh;
  max-height: 85dvh;
  margin: 0 auto;
  overflow: hidden;
  border-radius: var(--ds-radius-16) var(--ds-radius-16) 0 0;
  background: var(--ds-background);
  transform: translateY(100%);
  transition: transform 280ms ease-out;
}
.places-filter-dialog--visible .places-filter-overlay {
  opacity: 1;
}
.places-filter-dialog--visible .places-filter-sheet {
  transform: translateY(var(--places-sheet-offset, 0px));
}
.places-filter-dialog--dragging .places-filter-sheet {
  transition: none;
}
.places-filter-sheet__handle {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.places-filter-sheet__handle:active {
  cursor: grabbing;
}
.places-filter-sheet__handle span {
  width: 40px;
  height: 4px;
  border-radius: var(--ds-radius-full);
  background: var(--ds-border);
}
.places-filter-dialog__header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: var(--ds-space-16);
  padding: var(--ds-space-16) var(--ds-space-24);
  border-bottom: 1px solid var(--ds-border);
}
.places-filter-dialog__close {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: var(--ds-radius-4);
  background: transparent;
  color: var(--ds-text);
  cursor: pointer;
}
.places-filter-dialog__close:hover {
  background: var(--ds-tag);
}
.places-filter-dialog__body {
  flex: 1 1 auto;
  min-height: 0;
  padding: var(--ds-space-24);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.places-filter-group {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.places-filter-group + .places-filter-group {
  margin-top: var(--ds-space-28);
}
.places-filter-group legend {
  padding: 0;
  font-size: var(--ds-body-size);
  font-weight: 600;
  line-height: var(--ds-body-leading);
}
.places-filter-group__options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ds-space-8);
  margin-top: var(--ds-space-12);
}
.places-filter-option {
  max-width: 100%;
  min-height: 44px;
  padding: var(--ds-space-8) var(--ds-space-16);
  overflow-wrap: anywhere;
  border: 1px solid var(--ds-border);
  border-radius: var(--ds-radius-8);
  background: var(--ds-background);
  color: var(--ds-tag-text);
  font-size: var(--ds-label-size);
  line-height: var(--ds-label-leading);
  cursor: pointer;
}
.places-filter-option:hover {
  border-color: var(--ds-secondary);
}
.places-filter-option--selected,
.places-filter-option--selected:hover {
  border-color: var(--places-filter-border);
  background: var(--places-filter-soft);
  color: var(--places-filter-accent);
  font-weight: 600;
}
.places-filter-dialog__footer {
  display: grid;
  flex-shrink: 0;
  grid-template-columns: 1fr 2fr;
  gap: var(--ds-space-12);
  padding: var(--ds-space-16) var(--ds-space-24);
  border-top: 1px solid var(--ds-border);
  background: var(--ds-background);
}
.places-filter-dialog__reset,
.places-filter-dialog__apply {
  min-width: 0;
  min-height: 48px;
  padding: var(--ds-space-12) var(--ds-space-16);
  border: 1px solid var(--ds-border);
  border-radius: var(--ds-radius-8);
  background: var(--ds-background);
  color: var(--ds-text);
  font-size: var(--ds-label-size);
  font-weight: 600;
  line-height: var(--ds-label-leading);
  cursor: pointer;
}
.places-filter-dialog__reset:hover {
  background: var(--ds-surface);
}
.places-filter-dialog__apply {
  border-color: var(--places-filter-accent);
  background: var(--places-filter-accent);
  color: #fff;
}
.places-filter-dialog__apply:hover {
  filter: brightness(0.94);
}
.places-filter-button:focus-visible,
.places-applied-chip:focus-visible,
.places-filter-dialog button:focus-visible {
  outline: 2px solid var(--ds-text);
  outline-offset: 2px;
}
@media (width < 768px) {
  .places-filter-sheet {
    width: 100%;
    max-width: none;
    max-height: 90vh;
    max-height: 90dvh;
  }
  .places-filter-dialog__header,
  .places-filter-dialog__body {
    padding: var(--ds-space-16);
  }
  .places-filter-dialog__footer {
    padding: var(--ds-space-16);
    padding-bottom: max(var(--ds-space-16), env(safe-area-inset-bottom));
  }
}
@media (prefers-reduced-motion: reduce) {
  .places-filter-sheet,
  .places-filter-overlay {
    transition-duration: 0.01ms;
  }
}
</style>
