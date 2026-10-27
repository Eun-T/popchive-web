<script setup lang="ts">
import { ChevronLeft, ChevronRight } from "@lucide/vue";
import useEmblaCarousel from "embla-carousel-vue";
import { formatPopupCardPeriod } from "~/utils/formatPopupCardPeriod";
import type {
  PopupRecommendationKind,
  PopupRecommendationsResponse,
} from "../../../shared/types/popupRecommendations";
import {
  recommendationDayStatus,
  recommendationDistance,
} from "#shared/utils/popupRecommendations";

const props = defineProps<{
  publicId: string;
  kind: PopupRecommendationKind;
  countryCode: string | null;
}>();
// The parent keys each instance by publicId + kind; requests never follow changing props.
const { publicId, kind } = props;
const title = kind === "nearby" ? "주변에서 열리는 팝업" : "비슷한 취향의 팝업";
const headingId = `recommendations-${kind}-${useId()}`;
const key = `popup-recommendations:${publicId}:${kind}:7:ko`;
// Keep successful empty results too. A repeated visit or Observer callback does not refetch.
const cache = useState<{
  response: PopupRecommendationsResponse | null;
  failed: boolean;
}>(key, () => ({ response: null, failed: false }));
const { data, status, error, execute, clear } = useAsyncData(
  key,
  async (_app, { signal }) => {
    if (cache.value.response) return cache.value.response;
    if (cache.value.failed)
      throw new Error("Popup recommendations unavailable");
    try {
      const response = await $fetch<PopupRecommendationsResponse>(
        `/api/popups/${encodeURIComponent(publicId)}/${kind}`,
        {
          query: { limit: 7, languageCode: "ko" },
          signal,
          retry: 0,
          timeout: 12_000,
        },
      );
      if (!signal.aborted) cache.value.response = response;
      return response;
    } catch (error) {
      if (!signal.aborted) cache.value.failed = true;
      throw error;
    }
  },
  { server: false, immediate: false, dedupe: "defer" },
);

const section = ref<HTMLElement | null>(null);
const visible = ref(false);
const observerUnavailable = ref(false);
let observer: IntersectionObserver | undefined;
let clock: ReturnType<typeof setInterval> | undefined;
const now = ref(Date.now());
const today = computed(() =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: props.countryCode === "JP" ? "Asia/Tokyo" : "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now.value),
);
const cards = computed(() =>
  (data.value?.popups ?? []).map((popup) => ({
    ...popup,
    dayStatus: recommendationDayStatus(popup, today.value),
  })),
);
const hidden = computed(
  () =>
    observerUnavailable.value ||
    (visible.value &&
      (!!error.value || (status.value === "success" && !cards.value.length))),
);
const failedImages = ref(new Set<string>());
const [viewport, embla] = useEmblaCarousel({
  align: "start",
  slidesToScroll: 1,
  loop: false,
  dragFree: false,
  skipSnaps: true,
  containScroll: "trimSnaps",
});
const canPrev = ref(false),
  canNext = ref(false);
watch(embla, (api, _, cleanup) => {
  if (!api) return;
  const sync = () => {
    canPrev.value = api.canScrollPrev();
    canNext.value = api.canScrollNext();
  };
  sync();
  api.on("select", sync).on("reInit", sync);
  cleanup(() => {
    api.off("select", sync).off("reInit", sync);
  });
});
function scroll(direction: "prev" | "next") {
  const jump = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (direction === "prev") embla.value?.scrollPrev(jump);
  else embla.value?.scrollNext(jump);
}
onMounted(() => {
  // No mount-time or SSR fetch. Each section independently observes its own placeholder.
  if (section.value && "IntersectionObserver" in window) {
    observer = new IntersectionObserver(
      (entries) => {
        if (visible.value || !entries.some((entry) => entry.isIntersecting))
          return;
        visible.value = true;
        observer?.disconnect();
        void execute({ dedupe: "defer" });
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(section.value);
  } else observerUnavailable.value = true;
  now.value = Date.now();
  clock = setInterval(() => {
    now.value = Date.now();
  }, 60_000);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  clearInterval(clock);
  // Cancels the request's signal. Cached results remain isolated by publicId/kind.
  clear();
});
</script>

<template>
  <section
    v-if="!hidden"
    ref="section"
    class="recommendations"
    :class="{ 'recommendations--similar': kind === 'similar' }"
    :aria-labelledby="headingId"
  >
    <hr class="recommendations__divider" />
    <header class="recommendations__header">
      <h2 :id="headingId" class="recommendations__title">{{ title }}</h2>
    </header>
    <div
      v-if="!visible || status === 'idle' || status === 'pending'"
      class="recommendations__loading"
      role="status"
      aria-label="추천 팝업을 불러오는 중입니다."
    >
      <div
        v-for="index in 4"
        :key="index"
        class="recommendations__skeleton"
        aria-hidden="true"
      >
        <div />
        <span />
      </div>
    </div>
    <div v-else-if="cards.length" class="recommendations__carousel">
      <div
        ref="viewport"
        class="recommendations__viewport"
        tabindex="0"
        role="region"
        :aria-label="`${title}, 좌우 방향키로 탐색`"
        @keydown.left.prevent="scroll('prev')"
        @keydown.right.prevent="scroll('next')"
      >
        <ul class="recommendations__track">
          <li
            v-for="popup in cards"
            :key="popup.publicId"
            class="recommendations__card"
          >
            <NuxtLink
              :to="`/places/${encodeURIComponent(popup.publicId)}`"
              :prefetch="false"
              class="recommendations__link"
              draggable="false"
            >
              <div class="recommendations__poster">
                <img
                  v-if="
                    popup.coverImageUrl &&
                    !failedImages.has(popup.coverImageUrl)
                  "
                  :src="popup.coverImageUrl"
                  :alt="`${popup.name} 포스터`"
                  width="300"
                  height="400"
                  loading="lazy"
                  decoding="async"
                  draggable="false"
                  @error="failedImages.add(popup.coverImageUrl)"
                />
                <span v-else>이미지가 없습니다.</span>
              </div>
              <p
                class="recommendations__dday"
                :class="
                  popup.dayStatus
                    ? `recommendations__dday--${popup.dayStatus.state}`
                    : undefined
                "
              >
                {{ popup.dayStatus?.label }}
              </p>
              <h3>{{ popup.name }}</h3>
              <p v-if="kind === 'similar'" class="recommendations__period">
                {{ formatPopupCardPeriod(`${popup.startDate ?? '시작일 미정'} ~ ${popup.endDate ?? '종료일 미정'}`) }}
              </p>
              <p
                v-if="kind === 'nearby' && popup.distanceMeters !== undefined"
                class="recommendations__location"
                :title="`${popup.regionName ? popup.regionName + ' · ' : ''}거리 ${recommendationDistance(popup.distanceMeters)} (직선거리)`"
              >
                {{ popup.regionName ? `${popup.regionName} · ` : "" }}거리
                {{ recommendationDistance(popup.distanceMeters) }}
              </p>
              <ul
                v-else-if="kind === 'similar' && popup.tags.length"
                class="recommendations__tags"
                aria-label="팝업 태그"
              >
                <li v-for="tag in popup.tags.slice(0, 2)" :key="tag.id">
                  {{ tag.name }}
                </li>
              </ul>
            </NuxtLink>
          </li>
        </ul>
      </div>
      <button
        v-show="canPrev"
        type="button"
        class="recommendations__arrow recommendations__arrow--prev"
        :aria-label="`${title} 이전 카드`"
        @click="scroll('prev')"
      >
        <ChevronLeft :size="20" aria-hidden="true" />
      </button>
      <button
        v-show="canNext"
        type="button"
        class="recommendations__arrow recommendations__arrow--next"
        :aria-label="`${title} 다음 카드`"
        @click="scroll('next')"
      >
        <ChevronRight :size="20" aria-hidden="true" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.recommendations {
  display: flow-root;
  min-width: 0;
  color: #111827;
}
.recommendations__divider {
  width: 100%;
  margin: 32px 0;
  border: 0;
  border-top: 1px solid #e5e7eb;
}
.recommendations__header {
  margin: 0 0 16px;
  padding: 0;
}
.recommendations__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;
}
.recommendations__carousel {
  position: relative;
}
.recommendations__viewport {
  overflow: hidden;
  touch-action: pan-y pinch-zoom;
  outline-offset: -2px;
}
.recommendations__track,
.recommendations__loading {
  display: flex;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.recommendations__loading {
  overflow: hidden;
}
.recommendations__card,
.recommendations__skeleton {
  flex: 0 0 calc((100% - 12px) / 2);
  min-width: 0;
}
.recommendations__link {
  display: block;
  width: 100%;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}
.recommendations__poster,
.recommendations__skeleton > div {
  display: grid;
  place-items: center;
  overflow: hidden;
  aspect-ratio: 3 / 4;
  border-radius: 5px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 13px;
}
.recommendations__poster img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
}
.recommendations__dday {
  min-height: 20px;
  margin-top: 12px;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}
.recommendations__dday--upcoming {
  color: #2563eb;
}
.recommendations__dday--ongoing {
  color: #16805d;
}
.recommendations__dday--last-day {
  color: #c05621;
}
.recommendations__dday--ended {
  color: #9ca3af;
}
.recommendations__card h3 {
  display: block;
  height: auto;
  min-height: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  margin: 2px 0 0;
  padding: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}
.recommendations__period,
.recommendations__location {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #6b7280;
  font-size: 13px;
  line-height: 20px;
}
.recommendations__period {
  margin: 4px 0 0;
  padding: 0;
}
.recommendations__period + .recommendations__tags {
  margin-top: 4px;
}
.recommendations__location,
.recommendations__tags {
  min-height: 22px;
  margin-top: 0px;
}
.recommendations__tags {
  display: flex;
  gap: 4px;
  padding: 0;
  list-style: none;
}
.recommendations__tags li {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 12px;
  line-height: 18px;
}
.recommendations__skeleton > span {
  display: block;
  height: 72px;
  margin-top: 12px;
  border-radius: 5px;
  background: #f3f4f6;
}
.recommendations__arrow {
  position: absolute;
  top: calc((100% - 84px) / 2);
  transform: translateY(-50%);
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: rgba(25, 28, 35, 0.75);
  color: white;
  transition: opacity 200ms ease;
  cursor: pointer;
}
.recommendations__arrow--prev {
  left: 4px;
}
.recommendations--similar .recommendations__skeleton > span {
  height: 100px;
}
.recommendations--similar .recommendations__arrow {
  top: calc((100% - 112px) / 2);
}
.recommendations__arrow--next {
  right: 4px;
}
.recommendations__viewport:focus-visible,
.recommendations__link:focus-visible,
.recommendations__arrow:focus-visible {
  outline: 2px solid #111827;
}
@media (min-width: 768px) {
  .recommendations__card,
  .recommendations__skeleton {
    flex-basis: calc((100% - 24px) / 3);
  }
  .recommendations__arrow {
    display: flex;
  }
}
@media (min-width: 1120px) {
  .recommendations__card,
  .recommendations__skeleton {
    flex-basis: calc((100% - 36px) / 4);
  }
}
@media (min-width: 768px) and (hover: hover) and (pointer: fine) {
  .recommendations__arrow {
    opacity: 0;
    pointer-events: none;
  }
  .recommendations__carousel:hover .recommendations__arrow,
  .recommendations__carousel:focus-within .recommendations__arrow {
    opacity: 1;
    pointer-events: auto;
  }
}
@media (prefers-reduced-motion: reduce) {
  .recommendations__arrow {
    transition: none;
  }
}
</style>
