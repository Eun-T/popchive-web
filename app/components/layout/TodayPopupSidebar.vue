<script setup lang="ts">
import type { TodayPopupsResponse } from "#shared/types/todayPopups";
import { endingSoonToday } from "#shared/utils/endingSoon";
import { popupDayStatus } from "~/utils/popupDates";

// Reuse the server calendar date and initial response during hydration.
const today = useState("today-popup-sidebar-day", () => endingSoonToday());
const key = computed(() => `sidebar:today:${today.value}:KR:ko`);
const { data, status, error, refresh } = await useFetch<TodayPopupsResponse>(
  "/api/sidebar/today",
  {
    key,
    server: true,
    dedupe: "defer",
    retry: 0,
  },
);
const todayLabel = computed(() =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(`${today.value}T00:00:00+09:00`)),
);

const failedImages = ref(new Set<string>());
const popups = computed(() =>
  data.value?.asOf === today.value
    ? data.value.items.map((popup) => ({
        ...popup,
        periodText:
          popup.endDate === today.value
            ? "오늘까지"
            : popupDayStatus(popup, today.value)?.label,
      }))
    : [],
);
let timer: ReturnType<typeof setInterval> | undefined;
let lastImageRefresh = 0;
function refreshIfNeeded() {
  if (document.hidden) return;
  const nextDay = endingSoonToday();
  if (today.value !== nextDay) {
    today.value = nextDay; // The reactive key starts one new request.
    failedImages.value.clear();
    return;
  }
  if (status.value === "pending") return;
  // Existing signed images expire after five minutes. This is not a random re-roll.
  if (data.value && Date.now() - data.value.fetchedAt >= 180_000)
    void refresh();
}
function onImageError(src: string) {
  failedImages.value.add(src);
  const now = Date.now();
  if (
    status.value !== "pending" &&
    data.value &&
    now - data.value.fetchedAt >= 180_000 &&
    now - lastImageRefresh >= 60_000
  ) {
    lastImageRefresh = now;
    void refresh();
  }
}
onMounted(() => {
  refreshIfNeeded(); // A fresh SSR payload does not trigger another fetch.
  timer = setInterval(refreshIfNeeded, 30_000);
  document.addEventListener("visibilitychange", refreshIfNeeded);
  window.addEventListener("pageshow", refreshIfNeeded);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  document.removeEventListener("visibilitychange", refreshIfNeeded);
  window.removeEventListener("pageshow", refreshIfNeeded);
});
</script>

<template>
  <aside aria-labelledby="today-popup-title" class="today-popup-sidebar">
    <header class="today-popup-sidebar__header">
      <h2 id="today-popup-title">TODAY.</h2>
      <time :datetime="today">{{ todayLabel }}</time>
    </header>
    <p class="today-popup-sidebar__caption">오늘 진행 중인 팝업</p>
    <p v-if="error" class="today-popup-sidebar__state" role="status">
      오늘의 팝업을 불러오지 못했습니다.
    </p>
    <p
      v-else-if="status === 'pending' && !popups.length"
      class="today-popup-sidebar__state"
      role="status"
    >
      오늘의 팝업을 불러오는 중입니다.
    </p>
    <p
      v-else-if="!popups.length"
      class="today-popup-sidebar__state"
      role="status"
    >
      오늘 진행 중인 팝업이 없습니다.
    </p>
    <ol v-else class="today-popup-sidebar__list">
      <li
        v-for="popup in popups"
        :key="popup.publicId"
        class="today-popup-sidebar__item"
      >
        <NuxtLink
          :to="`/places/${encodeURIComponent(popup.publicId)}`"
          :prefetch="false"
          class="today-popup-sidebar__link"
        >
          <div class="today-popup-sidebar__content">
            <h3 :title="popup.name">{{ popup.name }}</h3>
            <p class="today-popup-sidebar__details">
              <span class="today-popup-sidebar__status">진행 중</span>
              <span>{{ popup.periodText }}</span>
            </p>
            <p v-if="popup.regionName" class="today-popup-sidebar__location">
              {{ popup.regionName }}
            </p>
          </div>
          <span
            v-if="popup.coverImageUrl && !failedImages.has(popup.coverImageUrl)"
            class="today-popup-sidebar__thumbnail"
          >
            <img
              :src="popup.coverImageUrl"
              alt=""
              width="52"
              height="52"
              loading="lazy"
              decoding="async"
              @error="onImageError(popup.coverImageUrl)"
            />
          </span>
        </NuxtLink>
      </li>
    </ol>
  </aside>
</template>

<style scoped>
.today-popup-sidebar {
  position: sticky;
  top: 88px;
  align-self: start;
  width: 230px;
  min-width: 0;
  height: 400px;
  padding: 18px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  color: #111827;
}
.today-popup-sidebar__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--ds-accent-purple);
}
.today-popup-sidebar__header h2 {
  font-size: 30px;
  font-weight: 800;
  line-height: 34px;
  letter-spacing: -1.2px;
}
.today-popup-sidebar__header time {
  flex-shrink: 0;
  color: #4b5563;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}
.today-popup-sidebar__caption {
  margin-top: 12px;
  color: #6b7280;
  font-size: 12px;
  line-height: 18px;
}
.today-popup-sidebar__list {
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
}
.today-popup-sidebar__item {
  padding-block: 14px;
}
.today-popup-sidebar__link {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  color: inherit;
  text-decoration: none;
}
.today-popup-sidebar__state {
  margin-top: 16px;
  color: #6b7280;
  font-size: 12px;
  line-height: 20px;
}
.today-popup-sidebar__item + .today-popup-sidebar__item {
  border-top: 1px solid #f0f1f3;
}
.today-popup-sidebar__content {
  flex: 1;
  min-width: 0;
}
.today-popup-sidebar__thumbnail {
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  overflow: hidden;
  border-radius: 50%;
}
.today-popup-sidebar__thumbnail img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.today-popup-sidebar__content h3 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
  letter-spacing: -0.3px;
}
.today-popup-sidebar__details {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  color: #6b7280;
  font-size: 11px;
  line-height: 16px;
}
.today-popup-sidebar__status {
  color: #374151;
  font-weight: 600;
}
.today-popup-sidebar__location {
  margin-top: 4px;
  color: #6b7280;
  font-size: 12px;
  line-height: 16px;
}
@media (width < 1120px) {
  .today-popup-sidebar {
    display: none;
  }
}
</style>
