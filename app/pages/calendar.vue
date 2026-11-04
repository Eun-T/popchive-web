<script setup lang="ts">
import { ChevronLeft, ChevronRight, X } from "@lucide/vue";

definePageMeta({ layout: "default" });
useSeoMeta({ title: "마이 캘린더 | 더플레이브", robots: "noindex, nofollow" });

const { events, loading, error: favoritesError, authChecking, authFailure, refresh: refreshFavorites } = useCalendarFavorites();
const auth = useAuth();
function retryFavorites() {
  if (authFailure.value) void auth.restore();
  else refreshFavorites();
}
const today = useState("calendar-prototype-today", () => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
});
const monthOffset = ref(0);
const month = computed(
  () =>
    new Date(
      Date.UTC(today.value.year, today.value.month + monthOffset.value, 1),
    ),
);
const year = computed(() => month.value.getUTCFullYear());
const monthIndex = computed(() => month.value.getUTCMonth());
const monthLabel = computed(
  () => `${year.value}. ${String(monthIndex.value + 1).padStart(2, "0")}`,
);
const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const dayMs = 86_400_000;
const isMobile = ref(false);
const visibleLaneCount = computed(() => (isMobile.value ? 2 : 3));
let mobileQuery: MediaQueryList | undefined;
function syncMobileLayout() {
  isMobile.value = mobileQuery?.matches ?? false;
}
onMounted(() => {
  mobileQuery = window.matchMedia("(width < 768px)");
  syncMobileLayout();
  mobileQuery.addEventListener("change", syncMobileLayout);
});
onBeforeUnmount(() => {
  mobileQuery?.removeEventListener("change", syncMobileLayout);
});
const weeks = computed(() => {
  const first = month.value.getTime();
  const last = Date.UTC(year.value, monthIndex.value + 1, 0);
  const gridStart = first - month.value.getUTCDay() * dayMs;
  const count = Math.ceil(
    (month.value.getUTCDay() + new Date(last).getUTCDate()) / 7,
  );
  return Array.from({ length: count }, (_, index) => {
    const start = gridStart + index * 7 * dayMs;
    const end = start + 6 * dayMs;
    const occupied = [-1, -1, -1];
    const segments = events.value
      .filter(
        (event) =>
          event.start <= Math.min(end, last) &&
          event.end >= Math.max(start, first),
      )
      .map((event) => {
        const from = Math.max(event.start, start, first);
        const to = Math.min(event.end, end, last);
        const column = Math.round((from - start) / dayMs);
        const endColumn = Math.round((to - start) / dayMs);
        const lane = occupied.findIndex((value) => value < column);
        if (lane >= 0) occupied[lane] = endColumn;
        return {
          ...event,
          column,
          endColumn,
          lane,
          continuesBefore: event.start < from,
          continuesAfter: event.end > to,
        };
      });
    return {
      start,
      days: Array.from({ length: 7 }, (_, day) => {
        const time = start + day * dayMs;
        return {
          time,
          number: new Date(time).getUTCDate(),
          inMonth: time >= first && time <= last,
          isToday:
            time ===
            Date.UTC(today.value.year, today.value.month, today.value.day),
        };
      }),
      segments: segments.filter(
        (event) => event.lane >= 0 && event.lane < visibleLaneCount.value,
      ),
      hidden: segments.filter(
        (event) => event.lane < 0 || event.lane >= visibleLaneCount.value,
      ),
    };
  });
});
const openWeek = ref<number | null>(null);
const overflowWeek = computed(() =>
  weeks.value.find(
    (week) => week.start === openWeek.value && week.hidden.length > 0,
  ),
);
function moveMonth(offset: number) {
  openWeek.value = null;
  monthOffset.value += offset;
}
function goToday() {
  openWeek.value = null;
  monthOffset.value = 0;
}
function period(start: number, end: number) {
  const label = (value: number) => {
    const date = new Date(value);
    return `${date.getUTCMonth() + 1}.${date.getUTCDate()}`;
  };
  return `${label(start)} ~ ${label(end)}`;
}
</script>

<template>
  <section
    class="popup-calendar"
    aria-labelledby="calendar-title"
    @keydown.esc="openWeek = null"
  >
    <div class="calendar-toolbar">
      <div class="calendar-controls">
        <button type="button" aria-label="이전 달" @click="moveMonth(-1)">
          <ChevronLeft :size="20" />
        </button>
        <h1 id="calendar-title" aria-live="polite">{{ monthLabel }}</h1>
        <button type="button" aria-label="다음 달" @click="moveMonth(1)">
          <ChevronRight :size="20" />
        </button>
      </div>
    </div>
    <p v-if="favoritesError || authFailure" class="calendar-status" role="alert">
      {{ favoritesError || authFailure }}
      <button type="button" :disabled="authChecking || loading" @click="retryFavorites">다시 불러오기</button>
    </p>
    <div class="calendar-grid" :aria-label="`${monthLabel} 월간 일정`" :aria-busy="loading || authChecking">
      <div class="calendar-weekdays">
        <span v-for="day in weekdays" :key="day">{{ day }}</span>
      </div>
      <div v-for="week in weeks" :key="week.start" class="calendar-week">
        <div class="calendar-days">
          <div
            v-for="day in week.days"
            :key="day.time"
            class="calendar-day"
            :class="{ 'is-outside': !day.inMonth }"
          >
            <span
              class="calendar-date"
              :class="{ 'is-today': day.isToday }"
              :aria-current="day.isToday ? 'date' : undefined"
              >{{ day.number }}</span
            >
          </div>
        </div>
        <div class="calendar-events">
          <NuxtLink
            v-for="event in week.segments"
            :key="event.id"
            :to="`/places/${encodeURIComponent(event.id)}`"
            :prefetch="false"
            :aria-label="`${event.title} · ${period(event.start, event.end)} 상세 보기`"
            class="calendar-event"
            :class="[
              event.tone,
              {
                'continues-before': event.continuesBefore,
                'continues-after': event.continuesAfter,
              },
            ]"
            :style="{
              gridColumn: `${event.column + 1} / ${event.endColumn + 2}`,
              gridRow: event.lane + 1,
            }"
            :title="`${event.title} · ${period(event.start, event.end)}`"
          >
            <span
              :class="{
                'sr-only': week.start > Math.max(event.start, month.getTime()),
              }"
              >{{ event.title }}</span
            >
          </NuxtLink>
        </div>
        <button
          v-if="week.hidden.length"
          type="button"
          class="calendar-more"
          :aria-expanded="openWeek === week.start"
          aria-controls="calendar-overflow"
          :aria-label="`이번 주 숨겨진 일정 ${week.hidden.length}개 더보기`"
          @click="openWeek = openWeek === week.start ? null : week.start"
        >
          +{{ week.hidden.length }}개 더보기
        </button>
      </div>
    </div>
    <div
      v-if="overflowWeek"
      id="calendar-overflow"
      class="calendar-popover"
      role="region"
      aria-label="더보기 목업 일정"
    >
      <div class="calendar-popover-heading">
        <strong>이번 주 더보기</strong
        ><button
          type="button"
          aria-label="더보기 닫기"
          @click="openWeek = null"
        >
          <X :size="18" />
        </button>
      </div>
      <ul>
        <li v-for="event in overflowWeek.hidden" :key="event.id">
          <NuxtLink :to="`/places/${encodeURIComponent(event.id)}`" :prefetch="false" :aria-label="`${event.title} 상세 보기`">{{ event.title }}</NuxtLink
          ><small>{{ period(event.start, event.end) }}</small>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.popup-calendar {
  --calendar-border: #d9dde3;
  position: relative;
  min-width: 0;
  color: var(--ds-text);
}
.calendar-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 0 4px;
}
h1 {
  font-size: 20px;
  line-height: var(--ds-title-m-leading);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.calendar-controls {
  display: flex;
  align-items: center;
  gap: 20px;
}
button {
  cursor: pointer;
}
.calendar-popover-heading button {
  display: grid;
  place-items: center;
  min-width: 36px;
  height: 36px;
  border: 1px solid var(--ds-border);
  border-radius: var(--ds-radius-4);
  background: var(--ds-background);
  color: var(--ds-text);
}
.calendar-controls button {
  display: grid;
  place-items: center;
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: #27272a;
}
button:hover {
  background: var(--ds-surface);
}
button:focus-visible {
  outline: 2px solid var(--ds-focus);
  outline-offset: 2px;
}
.calendar-status {
  margin-bottom: 12px;
  color: var(--ds-secondary);
  font-size: 13px;
}
.calendar-status button { margin-left: 8px; text-decoration: underline; }
.calendar-status button:disabled { cursor: default; opacity: 0.5; }
.calendar-event:focus-visible, .calendar-popover a:focus-visible {
  outline: 2px solid var(--ds-focus);
  outline-offset: -2px;
}
.calendar-controls button:hover {
  background: transparent;
  color: #71717a;
}
.calendar-grid {
  background: var(--ds-background);
}
.calendar-weekdays,
.calendar-days,
.calendar-events {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}
.calendar-weekdays {
  height: 42px;
}
.calendar-weekdays span {
  display: grid;
  place-items: center;
  color: #52525b;
  font-size: 13px;
  line-height: 20px;
  font-weight: 600;
}
.calendar-week {
  position: relative;
  height: 136px;
  border: 1px solid var(--calendar-border);
  border-bottom: 0;
}
.calendar-week:last-child {
  border-bottom: 1px solid var(--calendar-border);
}
.calendar-days {
  position: absolute;
  inset: 0;
}
.calendar-day {
  display: flex;
  align-items: flex-start;
  min-width: 0;
  padding: 10px 0 0 8px;
  background: #fff;
}
.calendar-day + .calendar-day {
  border-left: 1px solid var(--calendar-border);
}
.calendar-date {
  display: inline-grid;
  place-items: center;
  min-width: 20px;
  height: 16px;
  padding-inline: 3px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.is-outside {
  color: #9ca3af;
  background: var(--ds-surface);
}
.calendar-day:first-child,
.calendar-day:last-child {
  background: #f7f7f5;
}
.is-today {
  position: relative;
  isolation: isolate;
  color: #fff;
  font-weight: 600;
}
.is-today::before {
  content: "";
  position: absolute;
  z-index: -1;
  top: 50%;
  left: 50%;
  width: 24px;
  height: 24px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: #000;
}
/* Inner height 135px: date 10–26, gap 8, lanes 34–104, more 114–132, bottom 3. */
.calendar-events {
  position: absolute;
  top: 34px;
  inset-inline: 0;
  grid-template-rows: repeat(3, 22px);
  row-gap: 2px;
  pointer-events: none;
}
.calendar-event {
  pointer-events: auto;
  text-decoration: none;
  --start-inset: 12px;
  --end-inset: 12px;
  position: relative;
  left: var(--start-inset);
  width: calc(100% - var(--start-inset) - var(--end-inset));
  box-sizing: border-box;
  min-width: 0;
  height: 22px;
  margin-inline: 0;
  padding: 0 8px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  line-height: 22px;
}
.purple {
  background: #26a69a;
  color: #fff;
}
.blue {
  background: #4285f4;
  color: #fff;
}
.coral {
  background: #e67c73;
  color: #fff;
}
.green {
  background: #34a853;
  color: #fff;
}
.orange {
  background: #f6bf26;
  color: var(--ds-text);
}
.teal {
  background: #33b6a2;
  color: #fff;
}
.continues-before {
  --start-inset: 0px;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
.continues-after {
  --end-inset: 0px;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
.calendar-more {
  position: absolute;
  top: 114px;
  right: 8px;
  height: 18px;
  max-width: calc(100% - 16px);
  padding: 0 4px;
  background: var(--ds-background);
  color: var(--ds-secondary);
  border: 0;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
}
.calendar-popover {
  position: fixed;
  z-index: 60;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(320px, calc(100vw - 40px));
  max-height: 70dvh;
  overflow-y: auto;
  padding: 16px;
  border: 1px solid var(--ds-border);
  border-radius: var(--ds-radius-4);
  background: var(--ds-background);
}
.calendar-popover-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.calendar-popover ul {
  margin-top: 8px;
}
.calendar-popover li {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 0;
  border-top: 1px solid var(--ds-border);
  font-size: 14px;
}
.calendar-popover small,
.calendar-popover p {
  color: var(--ds-secondary);
  font-size: 12px;
}
@media (width < 768px) {
  /* Inner height 103px: date 10–26 (today circle 6–30), lanes 34–76, more 82–100. */
  .calendar-week {
    height: 104px;
  }
  .calendar-day {
    padding-left: 3px;
  }
  .calendar-events {
    grid-template-rows: repeat(2, 20px);
  }
  .calendar-event {
    height: 20px;
    font-size: 11px;
    line-height: 20px;
  }
  .calendar-more {
    top: 82px;
  }
}
</style>
