<script setup lang="ts">
import { ArrowUpRight } from "@lucide/vue";
import type {
  SeoulMapAreaId,
  SeoulMapPreviewResponse,
} from "../../../shared/types/map";
import {
  buildSeoulStaticMap,
  projectSeoulMapPoint,
} from "~/utils/seoulStaticMap";

const config = useRuntimeConfig();
const section = ref<HTMLElement | null>(null);
const frame = ref<HTMLElement | null>(null);
const preview = ref<SeoulMapPreviewResponse | null>(null);
const image = shallowRef<ReturnType<typeof buildSeoulStaticMap> | null>(null);
const frameSize = ref({ width: 0, height: 0 });
const dataState = ref<"waiting" | "loading" | "ready" | "error">("waiting");
const mapState = ref<"waiting" | "loading" | "ready" | "error" | "missing-key">(
  "waiting",
);
let observer: IntersectionObserver | undefined;
let resizeObserver: ResizeObserver | undefined;
let request: AbortController | undefined;
let started = false;
let disposed = false;

// Visual offsets in CSS pixels, applied after projection at every viewport size.
const areaOffsets: Partial<
  Record<SeoulMapAreaId, { offsetX: number; offsetY: number }>
> = {
  yeongdeungpo: { offsetX: 0, offsetY: 25 },
  gangnam: { offsetX: 0, offsetY: 25 },
  yongsan: { offsetX: 20, offsetY: 0 },
};

const areaMarkers = computed(() => {
  if (mapState.value !== "ready" || !preview.value || !image.value) return [];
  return (preview.value.areas ?? []).flatMap((area) => {
    if (!area.count || area.latitude === null || area.longitude === null)
      return [];
    const point = projectSeoulMapPoint(
      area.latitude,
      area.longitude,
      image.value!,
      frameSize.value.width,
      frameSize.value.height,
      Math.max(44, area.name.length * 12),
    );
    const { offsetX = 0, offsetY = 0 } = areaOffsets[area.id] ?? {};
    return point
      ? [{ ...area, x: point.x + offsetX, y: point.y + offsetY }]
      : [];
  });
});

const availableTotal = computed(
  () => preview.value?.popupStats?.totalCount ?? null,
);

async function loadPreview() {
  if (started || disposed) return;
  started = true;
  observer?.disconnect();
  dataState.value = "loading";
  const key = String(config.public.googleStaticMapsApiKey || "").trim();
  mapState.value = key ? "loading" : "missing-key";
  request = new AbortController();
  try {
    const result = await $fetch<SeoulMapPreviewResponse>("/api/popups/map", {
      query: { preview: "seoul" },
      signal: request.signal,
      timeout: 25_000,
      retry: 0,
      credentials: "omit",
    });
    if (disposed) return;
    preview.value = result;
    dataState.value = "ready";
  } catch {
    if (!disposed) {
      dataState.value = "error";
      mapState.value = "error";
    }
    return;
  }
  if (!key || !frame.value || !preview.value) return;
  try {
    // Assign the only image URL after intersection AND successful popup data.
    // SSR has neither src nor a preload; scrolling/resizing never changes this URL.
    image.value = buildSeoulStaticMap(
      key,
      frame.value.clientWidth,
      frame.value.clientHeight,
      String(config.public.googleStaticMapId || ""),
    );
  } catch {
    mapState.value = "error";
  }
}

function onImageLoad(event: Event) {
  const target = event.target as HTMLImageElement;
  if (target.naturalWidth > 0) mapState.value = "ready";
  else mapState.value = "error";
}

function updateFrameSize() {
  if (frame.value)
    frameSize.value = {
      width: frame.value.clientWidth,
      height: frame.value.clientHeight,
    };
}

onMounted(() => {
  updateFrameSize();
  if (frame.value && "ResizeObserver" in window) {
    resizeObserver = new ResizeObserver(updateFrameSize);
    resizeObserver.observe(frame.value);
  } else window.addEventListener("resize", updateFrameSize);
  if (!section.value || !("IntersectionObserver" in window)) {
    dataState.value = "error";
    mapState.value = "error";
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadPreview();
    },
    { rootMargin: "200px 0px" },
  );
  observer.observe(section.value);
});

onBeforeUnmount(() => {
  disposed = true;
  observer?.disconnect();
  resizeObserver?.disconnect();
  window.removeEventListener("resize", updateFrameSize);
  request?.abort();
});
</script>

<template>
  <section ref="section" class="seoul-map" aria-labelledby="seoul-map-title">
    <header class="seoul-map__header">
      <div class="seoul-map__heading">
        <h2 id="seoul-map-title">지도로 발견하는 팝업</h2>
        <p class="seoul-map__description">
          지도에서 가까운 팝업을 한눈에 살펴보세요.
        </p>
      </div>
      <div class="seoul-map__stats" aria-live="polite" aria-atomic="true">
        <p v-if="availableTotal !== null" class="seoul-map__stats-total">
          <span>총</span><strong>{{ availableTotal }}</strong
          ><span>개</span>
        </p>
        <p
          v-else-if="dataState === 'error' || dataState === 'ready'"
          class="seoul-map__stats-state"
        >
          전체 팝업 수를 불러오지 못했습니다.
        </p>
        <div v-else class="seoul-map__stats-placeholder" role="status">
          <span class="sr-only">전체 팝업 수를 불러오는 중입니다.</span>
        </div>
      </div>
    </header>
    <div
      ref="frame"
      class="seoul-map__frame"
      :aria-busy="mapState === 'waiting' || mapState === 'loading'"
    >
      <NuxtLink
        to="/map"
        :prefetch="false"
        class="seoul-map__link"
        aria-label="서울 팝업 지도에서 보기"
        :aria-describedby="
          preview && mapState === 'ready' ? 'seoul-map-areas' : undefined
        "
        draggable="false"
      >
        <img
          v-if="image"
          :src="image.url"
          :width="image.width * 2"
          :height="image.height * 2"
          alt="서울 중심부 지도 미리보기"
          class="seoul-map__image"
          :class="{ 'seoul-map__image--ready': mapState === 'ready' }"
          decoding="async"
          referrerpolicy="strict-origin-when-cross-origin"
          draggable="false"
          @load="onImageLoad"
          @error="mapState = 'error'"
        />
        <span
          v-for="area in areaMarkers"
          :key="area.id"
          class="seoul-map__area"
          :style="{ left: `${area.x}px`, top: `${area.y}px` }"
          aria-hidden="true"
        >
          <span class="seoul-map__area-count">{{ area.count }}</span>
          <span class="seoul-map__area-name">{{ area.name }}</span>
        </span>
        <span
          v-if="preview && mapState === 'ready'"
          id="seoul-map-areas"
          class="sr-only"
        >
          <template v-for="area in preview.areas" :key="area.id"
            >{{ area.name }} 팝업 {{ area.count }}개.
          </template>
        </span>
        <div
          v-if="mapState === 'waiting' || mapState === 'loading'"
          class="seoul-map__skeleton"
          role="status"
        >
          <span class="sr-only">지도를 불러오는 중입니다.</span>
        </div>
        <div
          v-else-if="mapState !== 'ready'"
          class="seoul-map__fallback"
          role="status"
        >
          <p>
            {{
              mapState === "missing-key"
                ? "지도 설정이 준비되지 않았습니다."
                : "지도를 불러오지 못했습니다."
            }}
          </p>
          <span
            >지도에서 보기 <ArrowUpRight :size="16" aria-hidden="true"
          /></span>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.seoul-map {
  width: 100%;
  max-width: 826px;
  min-width: 0;
  margin-top: 52px;
  color: var(--ds-text);
}
.seoul-map__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.seoul-map__heading {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.seoul-map__header h2 {
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;
}
.seoul-map__description {
  margin-top: 2px;
  color: var(--ds-secondary);
  font-size: 14px;
  line-height: 20px;
}
.seoul-map__frame {
  position: relative;
  height: 360px;
  overflow: hidden;
  border-radius: 12px;
  background: #f5f5f7;
}
.seoul-map__link {
  display: block;
  width: 100%;
  height: 100%;
}
.seoul-map__link:focus-visible {
  outline: 2px solid var(--ds-accent-purple);
  outline-offset: -3px;
}
/* Keep the entire Google image, logo and attribution visible, also after viewport resizing. */
.seoul-map__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  opacity: 0;
}
.seoul-map__image--ready {
  opacity: 1;
}
.seoul-map__area {
  --area-size: 44px;
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  transform: translate(-50%, calc(var(--area-size) / -2));
  pointer-events: none;
}
.seoul-map__area-count {
  display: grid;
  place-items: center;
  width: var(--area-size);
  height: var(--area-size);
  border: 1px solid #fff;
  border-radius: 50%;
  background: #111827;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
}
.seoul-map__area-name {
  color: #111827;
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
  text-shadow:
    0 1px 2px #fff,
    1px 0 2px #fff,
    -1px 0 2px #fff;
}
.seoul-map__skeleton,
.seoul-map__fallback {
  position: absolute;
  inset: 0;
  background: #f5f5f7;
}
.seoul-map__skeleton {
  animation: seoul-map-pulse 1.6s ease-in-out infinite;
}
.seoul-map__fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;
  color: var(--ds-secondary);
  font-size: 14px;
  text-align: center;
}
.seoul-map__fallback span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ds-accent-purple);
  font-weight: 600;
}
.seoul-map__stats {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 40%;
  text-align: right;
  overflow-wrap: anywhere;
}
.seoul-map__stats-total {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: baseline;
  gap: 4px;
  color: var(--ds-text);
  font-size: 14px;
  font-weight: 500;
  line-height: 24px;
}
.seoul-map__stats-total strong {
  min-width: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 28px;
  font-variant-numeric: tabular-nums;
}
.seoul-map__stats-state {
  color: var(--ds-secondary);
  font-size: 14px;
  line-height: 22px;
}
.seoul-map__stats-placeholder {
  width: 64px;
  max-width: 100%;
  height: 28px;
  border-radius: 4px;
  background: #f5f5f7;
}
@keyframes seoul-map-pulse {
  50% {
    background: #e5e7eb;
  }
}
@media (width < 768px) {
  .seoul-map__frame {
    height: clamp(240px, 60vw, 320px);
  }
}
@media (width < 768px) {
  .seoul-map__area {
    --area-size: 40px;
  }
  .seoul-map__area-name {
    font-size: 11px;
    line-height: 14px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .seoul-map__skeleton {
    animation: none;
  }
}
</style>
