<script setup lang="ts">
import { ArrowUpRight, CalendarDays, Clock, MapPin, X } from "@lucide/vue";
import type { PopupDetail } from "../../shared/types/popup";
import { popupSeoDescription } from "#shared/utils/seo";
import PopupRecommendations from "~/components/places/PopupRecommendations.vue";
import {
  formatPopupDetailPeriod,
  popupCalendarDate,
  popupDayStatus,
} from "~/utils/popupDates";

// Keep the existing /places list page independent from this detail route.
definePageMeta({
  layout: "default",
  path: "/places/:id",
  key: (route) => route.path,
});
const route = useRoute();
const id = String(route.params.id);
const isMock = /^(place-mock-|japan-mock-)/.test(id);
const {
  data: popup,
  error,
  status,
  refresh,
} = await useFetch<PopupDetail>(`/api/popups/${encodeURIComponent(id)}`, {
  key: `popup-detail:${id}:ko`,
  immediate: !isMock,
  watch: false,
  retry: 0,
});
// Reuse the SSR clock during hydration, then keep the local calendar date current.
const detailNow = useState("popup-detail-now", () => Date.now());
let dateClock: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  detailNow.value = Date.now();
  dateClock = setInterval(() => {
    detailNow.value = Date.now();
  }, 60_000);
});
onBeforeUnmount(() => {
  if (dateClock) clearInterval(dateClock);
});
const today = computed(() =>
  popupCalendarDate(detailNow.value, popup.value?.countryCode ?? null),
);
const dDay = computed(() =>
  popup.value
    ? popupDayStatus(popup.value, today.value, {
        open: "오픈 D-day",
        end: "종료 D-day",
      })
    : null,
);
const dDayHint = computed(() => {
  const label = dDay.value?.label;
  if (!label || dDay.value?.state === "ended") return null;
  const remaining = label.match(/^(?:오픈|종료) D-(\d+)$/)?.[1];
  if (remaining) return `(${remaining}일 남음)`;
  if (label === "오픈 D-day") return "(오늘 오픈)";
  if (label === "종료 D-day") return "(오늘 종료)";
  return null;
});
const period = computed(() =>
  formatPopupDetailPeriod(
    popup.value?.startDate ?? null,
    popup.value?.endDate ?? null,
  ),
);
const metadata = computed(() =>
  [
    ...(popup.value?.tags ?? []).map((tag) => tag.name),
    popup.value?.regionName,
  ].filter((label): label is string => !!label),
);
const imagesExpanded = ref(false);
const visibleImages = computed(() => {
  const images = popup.value?.contentImageUrls ?? [];
  return imagesExpanded.value ? images : images.slice(0, 2);
});
const hiddenImageCount = computed(() =>
  Math.max(0, (popup.value?.contentImageUrls.length ?? 0) - 2),
);
const selectedTab = ref<"info" | "reviews">("info");
const tabs = [
  { id: "info", label: "팝업 정보" },
  { id: "reviews", label: "방문 리뷰" },
] as const;
function onTabKeydown(event: KeyboardEvent, index: number) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const next =
    event.key === "Home" ? 0 : event.key === "End" ? 1 : (index + 1) % 2;
  selectedTab.value = tabs[next]!.id;
  const tabList = (event.currentTarget as HTMLElement).parentElement;
  tabList?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
}
const failedImages = ref(new Set<string>());
const posterDialog = ref<HTMLDialogElement | null>(null);
let previousOverflow: string | undefined;
function openPoster() {
  if (!posterDialog.value || posterDialog.value.open) return;
  previousOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";
  posterDialog.value.showModal();
}
function restoreScroll() {
  if (previousOverflow === undefined) return;
  document.documentElement.style.overflow = previousOverflow;
  previousOverflow = undefined;
}
function closePoster() {
  posterDialog.value?.close();
  restoreScroll();
}
onBeforeUnmount(() => {
  posterDialog.value?.close();
  restoreScroll();
});
const unavailable = computed(() => isMock || !!error.value || !popup.value);
if (import.meta.server && unavailable.value) {
  const event = useRequestEvent();
  if (event) {
    const missing =
      isMock ||
      error.value?.statusCode === 404 ||
      error.value?.statusCode === 400;
    setResponseStatus(event, missing ? 404 : 503);
    event.node.res.setHeader("X-Robots-Tag", "noindex, nofollow");
    if (!missing) event.node.res.setHeader("Retry-After", "60");
  }
}
usePopchiveSeo({
  title: () =>
    popup.value
      ? `${popup.value.name} | 팝카이브`
      : "팝업 정보를 찾을 수 없습니다 | 팝카이브",
  description: () =>
    popup.value
      ? popupSeoDescription(popup.value)
      : "요청한 팝업 정보를 확인할 수 없습니다.",
  image: () => popup.value?.coverImageUrl,
  noindex: unavailable,
});
</script>

<template>
  <div class="popup-detail">
    <p v-if="isMock" class="detail-state" role="status">
      목업 팝업은 아직 상세 정보를 제공하지 않습니다.
    </p>
    <div v-else-if="error" class="detail-state" role="alert">
      <p>
        {{
          error.statusCode === 404
            ? "팝업 정보를 찾을 수 없습니다."
            : "팝업 정보를 불러오지 못했습니다."
        }}
      </p>
      <button
        v-if="error.statusCode !== 404"
        type="button"
        class="detail-retry"
        @click="refresh()"
      >
        다시 시도
      </button>
    </div>
    <p
      v-else-if="status === 'pending' || !popup"
      class="detail-state"
      role="status"
    >
      팝업 정보를 불러오는 중입니다.
    </p>
    <template v-else>
      <div class="detail-top">
        <div class="detail-poster">
          <button
            v-if="popup.coverImageUrl && !failedImages.has(popup.coverImageUrl)"
            type="button"
            class="detail-poster__trigger"
            aria-label="포스터 확대 보기"
            @click="openPoster"
          >
            <img
              :src="popup.coverImageUrl"
              :alt="`${popup.name} 포스터`"
              @error="failedImages.add(popup.coverImageUrl!)"
            />
          </button>
          <p v-else class="detail-poster__empty" role="status">
            포스터 이미지가 없습니다.
          </p>
        </div>
        <div class="detail-info">
          <div v-if="metadata.length" class="detail-meta">
            <span v-for="(label, index) in metadata" :key="index">{{
              label
            }}</span>
          </div>
          <h1 class="detail-title" :title="popup.name">{{ popup.name }}</h1>
          <div
            v-if="dDay"
            class="detail-status"
            :class="`detail-status--${dDay.state}`"
          >
            <span>{{ dDay.label }}</span>
            <span v-if="dDayHint" class="detail-status__hint">{{ dDayHint }}</span>
          </div>
          <section
            v-if="period || popup.operatingHours || popup.address"
            class="detail-section"
            aria-labelledby="basic-info-title"
          >
            <h2 id="basic-info-title">기본 정보</h2>
            <dl class="detail-facts">
              <div v-if="period">
                <dt><CalendarDays :size="16" aria-hidden="true" />기간</dt>
                <dd>{{ period }}</dd>
              </div>
              <div v-if="popup.operatingHours">
                <dt><Clock :size="16" aria-hidden="true" />운영시간</dt>
                <dd>{{ popup.operatingHours }}</dd>
              </div>
              <div v-if="popup.address">
                <dt><MapPin :size="16" aria-hidden="true" />주소</dt>
                <dd>
                  {{ popup.address
                  }}<span
                    v-if="popup.locationDetail"
                    class="detail-address-extra"
                    >{{ popup.locationDetail }}</span
                  >
                </dd>
              </div>
            </dl>
          </section>
          <a
            v-if="popup.officialChannelUrl"
            :href="popup.officialChannelUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="detail-official"
            >공식 채널 보기 <ArrowUpRight :size="18" aria-hidden="true"
          /></a>
        </div>
      </div>
      <div class="detail-tabs" role="tablist" aria-label="팝업 상세 콘텐츠">
        <button
          v-for="(tab, index) in tabs"
          :id="`detail-tab-${tab.id}`"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-selected="selectedTab === tab.id"
          :aria-controls="`detail-panel-${tab.id}`"
          :tabindex="selectedTab === tab.id ? 0 : -1"
          :class="{ 'is-selected': selectedTab === tab.id }"
          @click="selectedTab = tab.id"
          @keydown="onTabKeydown($event, index)"
        >
          {{ tab.label }}
        </button>
      </div>
      <div
        v-show="selectedTab === 'info'"
        id="detail-panel-info"
        role="tabpanel"
        aria-labelledby="detail-tab-info"
        tabindex="0"
        class="detail-panel"
      >
        <section
          v-if="popup.notice?.trim() || popup.reservationUrl?.trim()"
          aria-labelledby="notice-title"
        >
          <h2 id="notice-title">공지사항</h2>
          <div class="detail-notice">
            <p v-if="popup.notice?.trim()" class="detail-copy">
              {{ popup.notice }}
            </p>
            <a
              v-if="popup.reservationUrl?.trim()"
              :href="popup.reservationUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="detail-reservation"
              >예약 페이지 보기</a
            >
          </div>
        </section>
        <section v-if="popup.benefits?.trim()" aria-labelledby="benefits-title">
          <h2 id="benefits-title">혜택</h2>
          <div class="detail-benefits">
            <p class="detail-copy">{{ popup.benefits }}</p>
          </div>
        </section>
        <section aria-labelledby="introduction-title">
          <h2 id="introduction-title">팝업 소개</h2>
          <p class="detail-copy" :class="{ 'detail-muted': !popup.summary }">
            {{ popup.summary || "등록된 소개가 없습니다." }}
          </p>
        </section>
        <div
          v-if="popup.contentImageUrls.length"
          class="detail-images"
          aria-label="팝업 소개 이미지"
        >
          <div id="detail-image-grid" class="detail-image-grid">
            <template v-for="(image, index) in visibleImages" :key="image">
              <img
                v-if="!failedImages.has(image)"
                :src="image"
                :alt="`${popup.name} 소개 이미지 ${index + 1}`"
                loading="lazy"
                @error="failedImages.add(image)"
              />
              <p v-else class="detail-muted">
                소개 이미지를 불러올 수 없습니다.
              </p>
            </template>
          </div>
          <button
            v-if="hiddenImageCount"
            type="button"
            class="detail-images__toggle"
            :aria-expanded="imagesExpanded"
            aria-controls="detail-image-grid"
            @click="imagesExpanded = !imagesExpanded"
          >
            {{ imagesExpanded ? "접기" : "더보기" }}
          </button>
        </div>
      </div>
      <section
        v-show="selectedTab === 'reviews'"
        id="detail-panel-reviews"
        role="tabpanel"
        aria-labelledby="detail-tab-reviews"
        tabindex="0"
        class="detail-panel"
      >
        <h2>방문 리뷰</h2>
        <p class="detail-state">아직 등록된 방문 리뷰가 없어요.</p>
      </section>
      <PopupRecommendations
        :key="`${id}:nearby`"
        :public-id="id"
        kind="nearby"
        :country-code="popup.countryCode"
      />
      <PopupRecommendations
        :key="`${id}:similar`"
        :public-id="id"
        kind="similar"
        :country-code="popup.countryCode"
      />
      <dialog
        ref="posterDialog"
        class="poster-dialog"
        aria-label="팝업 포스터 확대 보기"
        @click.self="closePoster"
        @cancel.prevent="closePoster"
        @close="restoreScroll"
      >
        <button
          type="button"
          class="poster-dialog__close"
          aria-label="확대 보기 닫기"
          autofocus
          @click="closePoster"
        >
          <X :size="24" aria-hidden="true" />
        </button>
        <img
          v-if="popup.coverImageUrl"
          :src="popup.coverImageUrl"
          :alt="`${popup.name} 확대 포스터`"
        />
      </dialog>
    </template>
  </div>
</template>

<style scoped>
.popup-detail {
  width: 100%;
  max-width: 826px;
  min-width: 0;
  color: #171717;
}
.detail-top {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.detail-poster {
  width: 300px;
  max-width: 100%;
}
.detail-poster__trigger {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  border-radius: 5px;
  overflow: hidden;
  background: transparent;
  cursor: zoom-in;
}
.detail-poster img {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
  border-radius: 5px;
}
.detail-poster__empty {
  display: grid;
  place-items: center;
  aspect-ratio: 3 / 4;
  border-radius: 5px;
  background: #f5f5f7;
  color: #6b7280;
  font-size: 14px;
}
.detail-info {
  min-width: 0;
  overflow-wrap: anywhere;
}
.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
}
.detail-title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  font-size: 24px;
  font-weight: 700;
  line-height: 34px;
}
.detail-status {
  display: flex;
  align-items: baseline;
  flex-wrap: nowrap;
  gap: 8px;
  margin-top: 12px;
  font-size: 24px;
  font-weight: 600;
}
.detail-status > span {
  white-space: nowrap;
}
.detail-status__hint {
  font-size: 13px;
  color: #888888;
  font-weight: 400;
}
.detail-status--upcoming {
  color: #2563eb;
}
.detail-status--ongoing {
  color: #16805d;
}
.detail-status--last-day {
  color: #c05621;
}
.detail-status--ended {
  color: #9ca3af;
}
.detail-meta span {
  padding: 4px 8px;
  border-radius: 5px;
  background: #f5f5f7;
}
.detail-section {
  margin-top: 28px;
}
.popup-detail h2 {
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}
.detail-facts {
  display: grid;
  gap: 12px;
  margin-top: 16px;
  font-size: 14px;
  line-height: 22px;
}
.detail-facts > div {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 12px;
}
.detail-facts dt {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: #6b7280;
}
.detail-facts svg {
  flex-shrink: 0;
  align-self: start;
  margin-top: 3px;
}
.detail-facts dd,
.detail-copy {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 14px;
  line-height: 22px;
}
.detail-address-extra {
  display: block;
  margin-top: 4px;
  color: #6b7280;
}
.detail-section .detail-copy,
.detail-panel section > .detail-copy {
  margin-top: 12px;
}
.detail-reservation {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  font-size: 14px;
  text-decoration: underline;
}
.detail-official {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  margin-top: 24px;
  padding: 10px 16px;
  border-radius: 5px;
  background: #171717;
  color: white;
  font-size: 14px;
  font-weight: 600;
}
.detail-tabs {
  display: flex;
  gap: 24px;
  margin-top: 32px;
  border-bottom: 1px solid #e5e7eb;
}
.detail-tabs button {
  min-height: 48px;
  border-bottom: 2px solid transparent;
  color: #6b7280;
  font-size: 15px;
  font-weight: 500;
}
.detail-tabs button.is-selected {
  border-bottom-color: #171717;
  color: #171717;
  font-weight: 700;
}
.detail-panel {
  padding-top: 24px;
}
.detail-panel > section + section,
.detail-images {
  margin-top: 32px;
}
.detail-benefits {
  padding: 16px;
  margin-top: 12px;
  border-radius: 5px;
  background: #f5f5f7;
}
.detail-notice {
  padding: 16px;
  margin-top: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 5px;
  background: #ffffff;
}
.detail-image-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 12px;
}
.detail-images img {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  object-fit: contain;
  border-radius: 5px;
}
.detail-images__toggle {
  display: block;
  width: 100%;
  min-height: 44px;
  margin-top: 12px;
  padding: 10px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 5px;
  background: #ffffff;
  color: #171717;
  font-size: 14px;
}
.detail-muted {
  color: #6b7280;
  font-size: 14px;
}
.detail-state {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 12px;
  min-height: 180px;
  padding: 24px;
  text-align: center;
  color: #6b7280;
  font-size: 14px;
}
.detail-retry {
  padding: 8px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 5px;
  color: #171717;
}
.poster-dialog {
  position: fixed;
  inset: 0;
  width: 100vw;
  max-width: none;
  height: 100dvh;
  max-height: none;
  margin: 0;
  padding: 48px 24px;
  border: 0;
  background: transparent;
  color: white;
}
.poster-dialog[open] {
  display: flex;
  align-items: center;
  justify-content: center;
}
.poster-dialog::backdrop {
  background: rgb(0 0 0 / 85%);
}
.poster-dialog img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
}
.poster-dialog__close {
  position: absolute;
  top: 12px;
  right: 12px;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 5px;
  background: #171717;
}
@media (width < 768px) {
  .detail-top {
    grid-template-columns: minmax(0, 1fr);
  }
  .detail-poster {
    margin-inline: auto;
  }
  .detail-image-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
