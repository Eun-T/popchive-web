<script setup lang="ts">
// Share the server's system date with hydration so the initial markup stays consistent.
const today = useState("today-popup-sidebar-date", () =>
  new Date().toISOString(),
);
const todayLabel = computed(() =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(today.value)),
);

// UI-only mock data. These are sample listings, not live popup information.
const popups = [
  {
    title: "아카이브 셀렉트 팝업",
    periodText: "오늘까지",
    location: "서울 성수",
    statusText: "진행 중",
  },
  {
    title: "라이프스타일 마켓",
    periodText: "20:00 종료",
    location: "서울 여의도",
    statusText: "진행 중",
  },
  {
    title: "커피 셀렉트 스토어",
    periodText: "19:00 종료",
    location: "서울 연남",
    statusText: "진행 중",
  },
];
</script>

<template>
  <aside aria-labelledby="today-popup-title" class="today-popup-sidebar">
    <header class="today-popup-sidebar__header">
      <h2 id="today-popup-title">TODAY.</h2>
      <time :datetime="today">{{ todayLabel }}</time>
    </header>
    <p class="today-popup-sidebar__caption">오늘 진행 중인 팝업</p>
    <ol class="today-popup-sidebar__list">
      <li
        v-for="(popup, index) in popups"
        :key="popup.title"
        class="today-popup-sidebar__item"
      >
        <span class="today-popup-sidebar__index" aria-hidden="true">{{
          String(index + 1).padStart(2, "0")
        }}</span>
        <div class="today-popup-sidebar__content">
          <h3 :title="popup.title">{{ popup.title }}</h3>
          <p class="today-popup-sidebar__details">
            <span class="today-popup-sidebar__status">{{
              popup.statusText
            }}</span>
            <span>{{ popup.periodText }}</span>
          </p>
          <p class="today-popup-sidebar__location">{{ popup.location }}</p>
        </div>
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
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 10px;
  padding-block: 14px;
}
.today-popup-sidebar__item + .today-popup-sidebar__item {
  border-top: 1px solid #f0f1f3;
}
.today-popup-sidebar__index {
  color: var(--ds-accent-purple);
  font-size: 11px;
  font-weight: 600;
  line-height: 20px;
  font-variant-numeric: tabular-nums;
}
.today-popup-sidebar__content {
  min-width: 0;
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
