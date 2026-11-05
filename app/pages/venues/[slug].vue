<script setup lang="ts">
import { ChevronRight, MapPin } from "@lucide/vue";
import type {
  PopupVenuesResponse,
  VenuePopupsResponse,
} from "../../../shared/types/venues";
import {
  publicVenueId,
  venueIdFromSlug,
  venuePath,
} from "#shared/utils/venueRoutes";
import { canonicalUrl } from "#shared/utils/seo";
import { endingSoonToday } from "#shared/utils/endingSoon";
import { formatPopupCardPeriod } from "~/utils/formatPopupCardPeriod";
import TagChip from "~/components/ui/TagChip.vue";

definePageMeta({ layout: "default", key: (route) => route.path });
const route = useRoute();
const slug = String(route.params.slug);
const validSlug = publicVenueId(slug);
const venueId = venueIdFromSlug(slug) ?? slug;
const hasMonthlyIntro = [
  "venue-36bf5330-7454-4ebc-9038-ff5448fb414f",
  "venue-495cfe1a-a735-4ec0-8c42-81ad6923a816",
].includes(venueId);
// Serialize the Seoul month in the SSR payload to keep hydration on the same date.
const introMonth = useState(`venue-intro-month:${venueId}`, () =>
  hasMonthlyIntro ? endingSoonToday().slice(0, 7) : "",
);
const introMonthLabel = computed(() => {
  const [year, month] = introMonth.value.split("-");
  return `${year}년 ${Number(month)}월`;
});
function syncIntroMonth() {
  if (hasMonthlyIntro) introMonth.value = endingSoonToday().slice(0, 7);
}
let introMonthTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  if (!hasMonthlyIntro) return;
  syncIntroMonth();
  introMonthTimer = setInterval(syncIntroMonth, 60_000);
  document.addEventListener("visibilitychange", syncIntroMonth);
  window.addEventListener("pageshow", syncIntroMonth);
});
onBeforeUnmount(() => {
  clearInterval(introMonthTimer);
  document.removeEventListener("visibilitychange", syncIntroMonth);
  window.removeEventListener("pageshow", syncIntroMonth);
});
const heroObjectPositions: Readonly<Record<string, string>> = {
  "venue-36bf5330-7454-4ebc-9038-ff5448fb414f": "center 60%",
  "venue-495cfe1a-a735-4ec0-8c42-81ad6923a816": "center 30%",
};
// Reuse the existing public endpoints, response shapes and 30-second Nitro caches.
// Both results enter the SSR payload; hydration does not fetch them again.
const [venuesRequest, popupsRequest] = await Promise.all([
  useFetch<PopupVenuesResponse>("/api/places/venues", {
    key: "places:venues:ko",
    server: true,
    dedupe: "defer",
    retry: 0,
    immediate: validSlug,
  }),
  useFetch<VenuePopupsResponse>("/api/places/venues", {
    key: `venue-popups:${venueId}:ko`,
    query: { venueId },
    server: true,
    dedupe: "defer",
    retry: 0,
    immediate: validSlug,
  }),
]);
const venue = computed(() =>
  venuesRequest.data.value?.venues.find((item) => item.venueId === venueId),
);
const popupList = computed(() => popupsRequest.data.value);
const failure = computed(() => {
  if (!validSlug) return "missing";
  if (venuesRequest.error.value) return "unavailable";
  // Only venues exposed by the public list are eligible for a public detail page.
  if (!venue.value || popupsRequest.error.value?.statusCode === 404)
    return "missing";
  if (popupsRequest.error.value || !popupList.value) return "unavailable";
  return null;
});
// Validate both existing API results before redirecting: missing stays 404, outages stay 503.
// Nuxt navigateTo on the server emits the HTTP redirect with this status code.
if (!failure.value && route.path !== venuePath(venueId)) {
  await navigateTo(venuePath(venueId), { redirectCode: 301, replace: true });
}
const event = useRequestEvent();
if (event) {
  event.node.res.setHeader("Cache-Control", "no-store");
  if (failure.value) {
    setResponseStatus(event, failure.value === "missing" ? 404 : 503);
    event.node.res.setHeader("X-Robots-Tag", "noindex, nofollow");
    if (failure.value === "unavailable")
      event.node.res.setHeader("Retry-After", "60");
  }
}
usePopchiveSeo({
  title: () =>
    failure.value
      ? "장소 정보를 확인할 수 없습니다 | THE PLAVE"
      : hasMonthlyIntro
        ? `${venue.value!.name} 팝업스토어 ${introMonthLabel.value} 일정 | THE PLAVE`
        : `${venue.value!.name} 팝업스토어 일정·위치 | THE PLAVE`,
  description: () =>
    failure.value
      ? "요청한 장소 정보를 확인할 수 없습니다."
      : hasMonthlyIntro
        ? `${introMonthLabel.value} ${venue.value!.name} 팝업스토어 정보를 확인하세요. 등록된 팝업의 운영 기간과 브랜드 정보를 살펴보세요.`
        : `${venue.value!.name}에서 열리는 팝업스토어의 운영 기간과 위치, 브랜드별 팝업 정보를 한눈에 확인하세요.`,
  image: () => (failure.value ? undefined : venue.value?.imageUrl),
  noindex: () => !!failure.value,
});
useHead(() => ({
  script:
    failure.value || !venue.value
      ? []
      : [
          {
            key: "venue-breadcrumb-schema",
            type: "application/ld+json",
            textContent: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "플레이스",
                  item: canonicalUrl("/places"),
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: venue.value.name,
                  item: canonicalUrl(venuePath(venueId)),
                },
              ],
            }).replaceAll("<", "\\u003c"),
          },
        ],
}));

const failedImages = ref(new Set<string>());
const refreshing = computed(
  () =>
    venuesRequest.status.value === "pending" ||
    popupsRequest.status.value === "pending",
);
let timer: ReturnType<typeof setInterval> | undefined;
let lastRecovery = 0;
async function refreshData() {
  if (!validSlug || refreshing.value) return;
  await Promise.all([venuesRequest.refresh(), popupsRequest.refresh()]);
}
function refreshIfStale() {
  if (document.hidden || refreshing.value) return;
  const today = endingSoonToday();
  const snapshots = [venuesRequest.data.value, popupList.value];
  if (
    snapshots.some(
      (item) =>
        item && (item.asOf !== today || Date.now() - item.fetchedAt >= 180_000),
    )
  )
    void refreshData();
}
function onImageError(src: string, fetchedAt?: number) {
  failedImages.value.add(src);
  // Keep the existing image recovery thresholds: stale >= 60s, at most once per minute.
  const now = Date.now();
  if (
    refreshing.value ||
    !fetchedAt ||
    now - fetchedAt < 60_000 ||
    now - lastRecovery < 60_000
  )
    return;
  lastRecovery = now;
  void refreshData();
}
onMounted(() => {
  refreshIfStale();
  timer = setInterval(refreshIfStale, 30_000);
  document.addEventListener("visibilitychange", refreshIfStale);
  window.addEventListener("pageshow", refreshIfStale);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  document.removeEventListener("visibilitychange", refreshIfStale);
  window.removeEventListener("pageshow", refreshIfStale);
});
</script>

<template>
  <article class="venue-detail" :class="{ 'venue-detail--monthly': hasMonthlyIntro }">
    <nav class="venue-detail__breadcrumb" aria-label="현재 위치">
      <ol>
        <li><NuxtLink to="/places?tab=explore">플레이스</NuxtLink></li>
        <li>
          <ChevronRight :size="14" aria-hidden="true" /><span
            aria-current="page"
            >{{ venue?.name ?? "장소 상세" }}</span
          >
        </li>
      </ol>
    </nav>

    <div
      v-if="failure"
      class="venue-detail__state"
      :role="failure === 'unavailable' ? 'alert' : undefined"
    >
      <h1>
        {{
          failure === "missing"
            ? "장소를 찾을 수 없습니다."
            : "장소 정보를 불러오지 못했습니다."
        }}
      </h1>
      <p>
        {{
          failure === "missing"
            ? "현재 공개된 장소가 아닙니다. 플레이스에서 다른 장소를 확인해 주세요."
            : "잠시 후 다시 시도해 주세요."
        }}
      </p>
      <button
        v-if="failure === 'unavailable'"
        type="button"
        class="venue-detail__retry"
        :disabled="refreshing"
        @click="refreshData"
      >
        {{ refreshing ? "불러오는 중" : "다시 시도" }}
      </button>
      <NuxtLink v-else to="/places?tab=explore" class="venue-detail__retry"
        >플레이스로 이동</NuxtLink
      >
    </div>

    <template v-else-if="venue && popupList">
      <div class="venue-detail__banner">
        <img
          v-if="venue.imageUrl && !failedImages.has(venue.imageUrl)"
          :src="venue.imageUrl"
          :alt="`${venue.name} 대표 이미지`"
          width="1000"
          height="400"
          decoding="async"
          :style="{ objectPosition: heroObjectPositions[venueId] ?? 'center 50%' }"
          @error="
            onImageError(venue.imageUrl, venuesRequest.data.value?.fetchedAt)
          "
        />
        <p v-else>
          {{
            venue.imageUrl
              ? "이미지를 불러올 수 없습니다."
              : "등록된 대표 이미지가 없습니다."
          }}
        </p>
        <header class="venue-detail__heading" :class="{ 'venue-detail__heading--inline': hasMonthlyIntro }">
          <h1>{{ venue.name }}</h1>
          <p>
            <!-- <MapPin :size="16" aria-hidden="true" /> -->
            <span>{{
              venue.address
            }}</span>
          </p>
          <div v-if="hasMonthlyIntro" class="venue-detail__hero-intro">
            <p>{{ introMonthLabel }} {{ venue.name }}의 팝업스토어 정보를 확인해 보세요.</p>
            <!-- <p>현재 등록된 팝업의 운영 기간과 브랜드 정보를 한눈에 살펴볼 수 있습니다.</p> -->
          </div>
        </header>
      </div>

      <section
        class="venue-detail__popups"
        aria-labelledby="venue-popups-title"
      >
        <div class="venue-detail__section-heading">
          <h2 id="venue-popups-title">여기서 열리는 팝업</h2>
          <span>팝업 {{ popupList.popupCount }}개</span>
        </div>
        <p
          v-if="!popupList.popups.length"
          class="venue-detail__empty"
          role="status"
        >
          현재 이 장소에서 열리는 팝업이 없습니다.
        </p>
        <ul v-else class="venue-detail__grid">
          <li v-for="popup in popupList.popups" :key="popup.publicId">
            <NuxtLink
              :to="`/places/${encodeURIComponent(popup.publicId)}`"
              :prefetch="false"
              class="venue-popup"
            >
              <span class="venue-popup__poster">
                <img
                  v-if="
                    popup.coverImageUrl &&
                    !failedImages.has(popup.coverImageUrl)
                  "
                  :src="popup.coverImageUrl"
                  :alt="`${popup.name} 포스터`"
                  width="96"
                  height="128"
                  loading="lazy"
                  decoding="async"
                  draggable="false"
                  @error="
                    onImageError(popup.coverImageUrl, popupList.fetchedAt)
                  "
                />
                <span v-else>{{
                  popup.coverImageUrl
                    ? "이미지를 불러올 수 없습니다."
                    : "이미지 없음"
                }}</span>
              </span>
              <span class="venue-popup__copy">
                <strong class="venue-popup__name" :title="popup.name">{{
                  popup.name
                }}</strong>
                <span class="venue-popup__period">{{
                  formatPopupCardPeriod(
                    `${popup.startDate} ~ ${popup.endDate ?? "종료일 미정"}`,
                  )
                }}</span>
                <span
                  v-if="popup.tags?.length"
                  class="venue-popup__tags"
                  aria-label="팝업 태그"
                >
                  <TagChip
                    v-for="tag in popup.tags"
                    :key="tag.id"
                    :title="tag.name"
                    >{{ tag.name }}</TagChip
                  >
                </span>
              </span>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </template>
  </article>
</template>

<style scoped>
.venue-detail {
  min-width: 0;
  color: var(--ds-text);
}
.venue-detail__breadcrumb {
  margin-bottom: var(--ds-space-20);
  color: var(--ds-secondary);
  font-size: 13px;
  line-height: 20px;
}
.venue-detail__breadcrumb ol {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ds-space-8);
  margin: 0;
  padding: 0;
  list-style: none;
}
.venue-detail__breadcrumb li {
  display: inline-flex;
  align-items: center;
  gap: var(--ds-space-8);
  min-width: 0;
  overflow-wrap: anywhere;
}
.venue-detail__breadcrumb svg {
  flex-shrink: 0;
}
.venue-detail__breadcrumb a:hover {
  text-decoration: underline;
}
.venue-detail__banner {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 2.5;
  overflow: hidden;
  border-radius: var(--ds-radius-8);
  background: var(--ds-tag);
}
.venue-detail__banner::after {
  position: absolute;
  inset: 0;
  content: "";
  background: linear-gradient(
    to top,
    rgb(0 0 0 / 85%),
    rgb(0 0 0 / 50%) 35%,
    transparent 80%
  );
  pointer-events: none;
}
.venue-detail__banner img {
  /* Keep images out of Grid's intrinsic sizing so the Hero ratio defines the crop. */
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  min-width: 0;
  min-height: 0;
}
.venue-detail__banner > p {
  padding: var(--ds-space-20);
  color: var(--ds-secondary);
  font-size: 14px;
  text-align: center;
}
.venue-detail__heading {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1;
  min-width: 0;
  max-height: 100%;
  overflow: hidden;
  padding: var(--ds-space-24);
  color: #fff;
  text-shadow: 0 1px 4px rgb(0 0 0 / 60%);
}
.venue-detail__heading h1 {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: var(--ds-title-l-size);
  font-weight: 700;
  line-height: var(--ds-title-l-leading);
  overflow-wrap: anywhere;
}
.venue-detail__heading p {
  display: flex;
  align-items: flex-start;
  gap: var(--ds-space-6);
  margin-top: 8px;
  color: rgb(255 255 255 / 95%);
  font-size: 14px;
  line-height: 22px;
  overflow-wrap: anywhere;
}
.venue-detail__heading p span {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.venue-detail__heading svg {
  flex-shrink: 0;
  margin-top: 3px;
}
.venue-detail__heading--inline {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  column-gap: 16px;
  row-gap: 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.venue-detail__heading--inline h1 {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
}
.venue-detail__heading--inline > p {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  margin-top: 0;
  color: rgb(255 255 255 / 80%);
}
.venue-detail__hero-intro {
  flex: 0 0 100%;
  min-width: 0;
  margin-top: 4px; /* With the heading's 8px row gap, the total spacing is 12px. */
  text-align: left;
}
.venue-detail__hero-intro p {
  display: block;
  margin-top: 0;
  color: rgb(255 255 255 / 90%);
  font-size: 14px;
  line-height: 22px;
  overflow-wrap: anywhere;
}
.venue-detail__hero-intro p + p {
  /* margin-top: 8px; */
}
.venue-detail--monthly .venue-detail__popups h2 {
  font-size: 18px;
  font-weight: 600;
  line-height: 26px;
}
.venue-detail__popups {
  padding-block: var(--ds-space-28);
}
.venue-detail__section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--ds-space-12);
  margin-bottom: var(--ds-space-24);
}
.venue-detail h2 {
  font-size: var(--ds-title-m-size);
  font-weight: 700;
  line-height: var(--ds-title-m-leading);
}
.venue-detail__section-heading > span {
  color: var(--ds-secondary);
  font-size: 14px;
}
.venue-detail__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--ds-space-24);
  margin: 0;
  padding: 0;
  list-style: none;
}
.venue-detail__grid > li {
  min-width: 0;
}
.venue-popup {
  display: flex;
  align-items: center;
  gap: var(--ds-space-12);
  min-width: 0;
  border-radius: var(--ds-radius-8);
}
.venue-popup__poster {
  display: grid;
  place-items: center;
  flex: 0 0 96px;
  width: 96px;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border-radius: 6px;
  background: var(--ds-tag);
}
.venue-popup__poster img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.venue-popup__poster > span {
  padding: var(--ds-space-8);
  color: var(--ds-secondary);
  font-size: 12px;
  line-height: 18px;
  text-align: center;
}
.venue-popup__copy {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.venue-popup__name {
  display: block;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}
.venue-popup:hover .venue-popup__name {
  text-decoration: underline;
}
.venue-popup__period {
  display: block;
  /* margin-top: var(--ds-space-8); */
  color: var(--ds-secondary);
  font-size: 13px;
  line-height: 20px;
}
.venue-popup__tags {
  display: flex;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  margin-top: 2px;
}
.venue-popup__tags :deep(.tag-chip) {
  flex: 0 1 auto;
  border-radius: 999px;
}
.venue-detail__empty,
.venue-detail__state {
  padding-block: var(--ds-space-24);
  color: var(--ds-secondary);
  font-size: 14px;
  line-height: 22px;
}
.venue-detail__state h1 {
  color: var(--ds-text);
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;
}
.venue-detail__state p {
  margin-top: var(--ds-space-12);
}
.venue-detail__retry {
  display: inline-block;
  margin-top: var(--ds-space-16);
  padding: var(--ds-space-8) var(--ds-space-12);
  border: 1px solid var(--ds-border);
  border-radius: var(--ds-radius-8);
  color: var(--ds-text);
}
.venue-detail__retry:disabled {
  opacity: 0.5;
}
@media (width < 768px) {
  .venue-detail__banner {
    aspect-ratio: 16 / 9;
  }
  .venue-detail__heading {
    padding: var(--ds-space-16);
  }
  .venue-detail__grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .venue-popup__poster {
    flex-basis: 84px;
    width: 84px;
  }
}
</style>
