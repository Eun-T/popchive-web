<script setup lang="ts">
import type { MapPopup, PopupMapResponse } from "../../../shared/types/map";
import {
  MarkerClusterer,
  SuperClusterAlgorithm,
  NoopAlgorithm,
  type Algorithm,
  type AlgorithmInput,
} from "@googlemaps/markerclusterer";
import { ChevronLeft, ChevronRight, X } from "@lucide/vue";
import { popupNavigation } from "~/utils/mapPopupNavigation";
import { popupCalendarDate, popupDayStatus } from "~/utils/popupDates";
import { MapPopupCache, boundsQueries, containsBounds, usableImages, visiblePopups, type BoundsQuery } from "~/utils/mapPopupCache";
import {
  loadGoogleMaps,
  MAPS_AUTH_FAILURE_EVENT,
  type GoogleMap,
  type GoogleMapsSdk,
  type GoogleMarker,
  type MapsListener,
} from "~/utils/googleMaps";

const config = useRuntimeConfig();
const canvas = ref<HTMLDivElement | null>(null);
const state = ref<"loading" | "ready" | "missing-key" | "sdk-error">("loading");
const apiState = ref<"idle" | "loading" | "ready" | "error">("idle");
let sdk: GoogleMapsSdk | undefined;
let map: GoogleMap | undefined;
let clusterer: MarkerClusterer | undefined;
const selectedId = ref<string | null>(null);
const currentPopups = shallowRef<MapPopup[]>([]);
const navigation = ref<string[]>([]);
const failedImages = ref(new Set<string>());
// Card lifetime is independent of the current viewport's marker data.
const selectedPopup = shallowRef<MapPopup | null>(null);
let navigationData = new Map<string, MapPopup>();
const statusNow = ref(Date.now());
let statusClock: ReturnType<typeof setInterval> | undefined;
const selectedStatus = computed(() => {
  const popup = selectedPopup.value;
  if (!popup) return null;
  return popupDayStatus(
    { startDate: popup.startDate ?? null, endDate: popup.endDate ?? null },
    popupCalendarDate(statusNow.value, null),
  );
});
const selectedPeriod = computed(() => {
  const popup = selectedPopup.value;
  return popup?.startDate && popup.endDate
    ? `${popup.startDate.slice(5).replace("-", ".")} - ${popup.endDate.slice(5).replace("-", ".")}`
    : "운영 기간 미정";
});
let disposed = false;
let debounce: ReturnType<typeof setTimeout> | undefined;
let request: AbortController | undefined;
let requestVersion = 0;
const popupCache = new MapPopupCache();
let activeBounds: BoundsQuery[] | undefined;
let activeDay = "";
const listeners: MapsListener[] = [];
const markers = new Map<
  string,
  { marker: GoogleMarker; dot: HTMLElement; label: HTMLElement; click: EventListener }
>();

function markerTitle(name: string) {
  const characters = Array.from(name);
  return characters.length > 9 ? `${characters.slice(0, 9).join("")}...` : name;
}

function highlightSelection() {
  for (const [id, { marker, dot, label }] of markers) {
    const selected = id === selectedId.value;
    dot.style.background = selected ? "#7C3AED" : "#111111";
    dot.style.boxShadow = selected
      ? "0 0 0 5px #EDE9FE, 0 1px 4px #00000040"
      : "0 1px 4px #00000040";
    marker.zIndex = selected ? 1000 : 0;
    label.style.fontWeight = selected ? "600" : "500";
  }
}

function selectPopup(id: string, resetOrder = true) {
  const popup = currentPopups.value.find((item) => item.id === id) ?? navigationData.get(id);
  if (!popup) return;
  selectedId.value = id;
  selectedPopup.value = { ...popup };
  if (resetOrder) {
    navigationData = new Map(currentPopups.value.map(item => [item.id, item]));
    navigation.value = popupNavigation(currentPopups.value, popup);
  }
  highlightSelection();
}

function stepSelection(step: number) {
  const index = navigation.value.indexOf(selectedId.value ?? "");
  const id =
    navigation.value[
      (index + step + navigation.value.length) % navigation.value.length
    ];
  if (!id) return;
  selectPopup(id, false);
  const popup = selectedPopup.value;
  if (popup && map) {
    const bounds = map.getBounds()?.toJSON();
    const inLongitude =
      bounds &&
      (bounds.west <= bounds.east
        ? popup.longitude >= bounds.west && popup.longitude <= bounds.east
        : popup.longitude >= bounds.west || popup.longitude <= bounds.east);
    if (
      bounds &&
      (!inLongitude ||
        popup.latitude < bounds.south ||
        popup.latitude > bounds.north)
    ) {
      map.panTo({ lat: popup.latitude, lng: popup.longitude });
    }
  }
}

function clearSelection() {
  selectedId.value = null;
  selectedPopup.value = null;
  navigationData.clear();
  navigation.value = [];
  highlightSelection();
}

// Supercluster radius is pixels; extent 256 matches Google's world tile size, not meters. Keep each index
// across idle events; fractional zoom bands are [0,13), [13,14), [14,17), [17,+inf).
function createAlgorithm(): Algorithm {
  const algorithms = [100, 80, 60].map(
    (radius) => new SuperClusterAlgorithm({ radius, extent: 256, maxZoom: 17 }),
  );
  const individual = new NoopAlgorithm({});
  let previous = -1;
  return {
    calculate(input: AlgorithmInput) {
      const zoom = input.map.getZoom() ?? 12;
      const band = zoom >= 17 ? 3 : zoom >= 14 ? 2 : zoom >= 13 ? 1 : 0;
      const result = (band === 3 ? individual : algorithms[band]!).calculate(
        input,
      );
      const switched = band !== previous;
      previous = band;
      return { ...result, changed: switched || result.changed };
    },
  };
}

const blockingMessage = computed(() => {
  if (state.value === "missing-key")
    return "Google Maps 웹용 API 키가 설정되지 않았습니다.";
  if (state.value === "sdk-error")
    return "Google 지도를 불러오지 못했습니다. 네트워크와 API 키·허용 도메인 설정을 확인해 주세요.";
  if (state.value === "loading") return "지도를 불러오는 중입니다.";
  return "";
});

function clearMarkers() {
  clusterer?.clearMarkers(true);
  for (const { marker, click } of markers.values()) {
    marker.removeEventListener("gmp-click", click);
    marker.map = null;
  }
  markers.clear();
  clusterer?.render();
  currentPopups.value = [];
  reconcileNavigation([]);
}

function reconcileNavigation(popups: MapPopup[]) {
  const selected = selectedPopup.value;
  if (!selected) return;
  const updated = popups.find(popup => popup.id === selected.id);
  if (updated) selectedPopup.value = { ...updated };
  // Keep only current results plus the selected snapshot; never change selection here.
  const byId = new Map(popups.map(popup => [popup.id, popup]));
  if (!byId.has(selected.id)) byId.set(selected.id, selected);
  navigationData = byId;
  const retained = navigation.value.filter(id => byId.has(id));
  const known = new Set(retained);
  for (const id of popupNavigation([...byId.values()], selectedPopup.value!).filter(id => !known.has(id))) {
    const popup = byId.get(id)!;
    let neighbor = -1;
    retained.forEach((otherId, index) => {
      const other = byId.get(otherId)!;
      if (other.latitude === popup.latitude && other.longitude === popup.longitude) neighbor = index;
    });
    if (neighbor >= 0) retained.splice(neighbor + 1, 0, id);
    else retained.push(id);
  }
  navigation.value = retained;
}

function drawMarkers(popups: MapPopup[]) {
  if (!map || !sdk) return;
  const ids = new Set(popups.map((popup) => popup.id));
  for (const [id, entry] of markers) {
    if (ids.has(id)) continue;
    clusterer?.removeMarker(
      entry.marker as unknown as google.maps.marker.AdvancedMarkerElement,
      true,
    );
    entry.marker.removeEventListener("gmp-click", entry.click);
    entry.marker.map = null;
    markers.delete(id);
  }
  for (const popup of popups) {
    const existing = markers.get(popup.id);
    if (existing) {
      existing.marker.title = popup.name;
      existing.label.textContent = markerTitle(popup.name);
      if (
        existing.marker.position.lat === popup.latitude &&
        existing.marker.position.lng === popup.longitude
      )
        continue;
      // A changed coordinate needs a new marker so the spatial index is rebuilt.
      clusterer?.removeMarker(
        existing.marker as unknown as google.maps.marker.AdvancedMarkerElement,
        true,
      );
      existing.marker.removeEventListener("gmp-click", existing.click);
      existing.marker.map = null;
      markers.delete(popup.id);
    }
    const dot = document.createElement("span");
    // Created outside Vue's template: inline styles avoid scoped-style attributes being required.
    Object.assign(dot.style, {
      display: "block",
      width: "18px",
      height: "18px",
      borderRadius: "50%",
      background: "#111111",
      border: "2px solid #ffffff",
      boxShadow: "0 1px 4px #00000040",
    });
    // Keep the content box 18×18: the coordinate still anchors the dot center.
    // Its absolutely positioned label travels/hides/clicks with this same marker.
    const content = document.createElement("span");
    Object.assign(content.style, {
      display: "block", position: "relative", width: "18px", height: "18px", overflow: "visible",
    });
    const label = document.createElement("span");
    label.textContent = markerTitle(popup.name);
    Object.assign(label.style, {
      position: "absolute", top: "calc(100% + 5px)", left: "50%", transform: "translateX(-50%)",
      fontSize: "11px", fontWeight: "500", color: "#222222", background: "transparent",
      padding: "0", border: "none", borderRadius: "0", textShadow: "0 1px 2px rgba(255, 255, 255, 0.6)",
      whiteSpace: "nowrap", textAlign: "center", cursor: "pointer",
    });
    content.append(dot, label);
    const marker = new sdk.marker.AdvancedMarkerElement({
      map,
      position: { lat: popup.latitude, lng: popup.longitude },
      title: popup.name,
      gmpClickable: true,
      anchorLeft: "-50%",
      anchorTop: "-50%",
    });
    marker.append(content);
    const click: EventListener = () => selectPopup(popup.id);
    marker.addEventListener("gmp-click", click);
    markers.set(popup.id, { marker, dot, label, click });
    clusterer?.addMarker(
      marker as unknown as google.maps.marker.AdvancedMarkerElement,
      true,
    );
  }
  currentPopups.value = popups;
  reconcileNavigation(popups);
  clusterer?.render();
  highlightSelection();
}

async function fetchPopups() {
  if (disposed || state.value !== "ready") return;
  const viewport = map?.getBounds()?.toJSON();
  if (!viewport) return;
  const visibleBounds = boundsQueries(viewport);
  if (!visibleBounds.length) return;
  const cached = popupCache.find(visibleBounds);
  if (cached) {
    if (request) cancelPendingRequest();
    drawMarkers(visiblePopups(usableImages(cached.popups), viewport));
    apiState.value = "ready";
    return;
  }
  const day = popupCalendarDate(Date.now(), null);
  if (request && activeDay === day && activeBounds && containsBounds(activeBounds, visibleBounds)) return;
  cancelPendingRequest();
  const queries = boundsQueries(viewport, 1.5);
  const controller = new AbortController();
  request = controller;
  const version = ++requestVersion;
  activeBounds = queries;
  activeDay = day;
  apiState.value = "loading";
  try {
    const responses = await Promise.all(
      queries.map((bounds) =>
        $fetch<PopupMapResponse>("/api/popups/map", {
          query: { ...bounds, languageCode: "ko" },
          signal: controller.signal,
          timeout: 15_000,
          retry: 0,
          credentials: "omit",
        }),
      ),
    );
    if (disposed || version !== requestVersion || controller.signal.aborted)
      return;
    const popups = [
      ...new Map(
        responses
          .flatMap((response) => response.popups)
          .map((popup) => [popup.id, popup]),
      ).values(),
    ];
    // A request crossing Korean midnight must not populate the new day's cache.
    if (day !== popupCalendarDate(Date.now(), null)) {
      cancelPendingRequest();
      void fetchPopups();
      return;
    }
    popupCache.store(queries, popups);
    const latest = map?.getBounds()?.toJSON();
    if (!latest || !containsBounds(queries, boundsQueries(latest))) {
      cancelPendingRequest();
      void fetchPopups();
      return;
    }
    drawMarkers(visiblePopups(usableImages(popups), latest));
    apiState.value = "ready";
  } catch {
    if (disposed || version !== requestVersion || controller.signal.aborted)
      return;
    controller.abort();
    clearMarkers();
    apiState.value = "error";
  } finally {
    if (version === requestVersion) {
      activeBounds = undefined;
      request = undefined;
    }
  }
}

function cancelPendingRequest() {
  clearTimeout(debounce);
  request?.abort();
  request = undefined;
  activeBounds = undefined;
  activeDay = "";
  ++requestVersion;
}

function onBoundsChanged() {
  clearTimeout(debounce);
  const viewport = map?.getBounds()?.toJSON();
  if (request && (!viewport || !activeBounds || activeDay !== popupCalendarDate(Date.now(), null)
    || !containsBounds(activeBounds, boundsQueries(viewport)))) cancelPendingRequest();
}

function onAuthenticationFailure() {
  if (disposed) return;
  cancelPendingRequest();
  clearMarkers();
  state.value = "sdk-error";
}

function reloadMap() {
  window.location.reload();
}

onMounted(async () => {
  statusClock = setInterval(() => {
    statusNow.value = Date.now();
  }, 60_000);
  const key = String(config.public.googleMapsApiKey || "").trim();
  if (!key) {
    state.value = "missing-key";
    return;
  }
  window.addEventListener(MAPS_AUTH_FAILURE_EVENT, onAuthenticationFailure);
  try {
    sdk = await loadGoogleMaps(key);
    if (disposed || !canvas.value || state.value === "sdk-error") return;
    map = new sdk.Map(canvas.value, {
      center: { lat: 37.5665, lng: 126.978 },
      zoom: 12,
      gestureHandling: "greedy",
      // Google permits DEMO_MAP_ID for development. Set your own JavaScript map ID for production.
      mapId:
        String(config.public.googleMapsMapId || "").trim() || "DEMO_MAP_ID",
      mapTypeControl: false,
      streetViewControl: false,
    });
    // The SDK is loaded above; no global google access occurs during SSR.
    clusterer = new MarkerClusterer({
      map: map as unknown as google.maps.Map,
      algorithm: createAlgorithm(),
      renderer: {
        render(cluster) {
          const marker = new sdk!.marker.AdvancedMarkerElement({
            map: map!,
            position: cluster.position.toJSON(),
            title: `팝업 ${cluster.count}개, 확대하기`,
            gmpClickable: true,
            anchorLeft: "-50%",
            anchorTop: "-50%",
          });
          const badge = document.createElement("span");
          badge.textContent = String(cluster.count);
          Object.assign(badge.style, {
            display: "grid",
            placeItems: "center",
            minWidth: "44px",
            height: "44px",
            padding: "6px",
            borderRadius: "50%",
            background: "rgba(0, 0, 0, 0.8)",
            border: "none",
            color: "#FFFFFF",
            font: "700 14px Pretendard, sans-serif",
            boxSizing: "border-box",
          });
          marker.append(badge);
          return marker as unknown as google.maps.marker.AdvancedMarkerElement;
        },
      },
      // The library's default click handler fits the cluster bounds using Google Maps.
    });
    state.value = "ready";
    listeners.push(map.addListener("bounds_changed", onBoundsChanged));
    listeners.push(
      map.addListener("idle", () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          void fetchPopups();
        }, 250);
      }),
    );
  } catch {
    if (!disposed) state.value = "sdk-error";
  }
});

onBeforeUnmount(() => {
  clearInterval(statusClock);
  disposed = true;
  cancelPendingRequest();
  popupCache.clear();
  window.removeEventListener(MAPS_AUTH_FAILURE_EVENT, onAuthenticationFailure);
  clearMarkers();
  clearSelection();
  clusterer?.setMap(null);
  clusterer = undefined;
  for (const listener of listeners) listener.remove();
  if (map) sdk?.event.clearInstanceListeners(map);
  map = undefined;
});
</script>

<template>
  <div class="popup-map">
    <div class="popup-map__frame" :aria-busy="state === 'loading'">
      <div ref="canvas" class="popup-map__canvas" aria-label="팝업 위치 지도" />
      <div
        v-if="selectedPopup"
        class="popup-map__selection"
        aria-label="선택한 팝업"
        @pointerdown.stop
        @click.stop
        @dblclick.stop
        @wheel.stop
        @keydown.stop
      >
        <button
          type="button"
          class="popup-map__arrow ds-control"
          :disabled="navigation.length < 2"
          aria-label="이전 팝업"
          @click.stop="stepSelection(-1)"
        >
          <ChevronLeft :size="20" />
        </button>
        <div class="popup-map__card">
          <button
            type="button"
            class="popup-map__close ds-control"
            aria-label="팝업 카드 닫기"
            @click.stop="clearSelection"
          >
            <X :size="16" />
          </button>
          <NuxtLink
            :to="`/places/${encodeURIComponent(selectedPopup.id)}`"
            :aria-label="`${selectedPopup.name} 상세 보기`"
          >
            <div class="popup-map__image">
              <img
                v-if="
                  selectedPopup.coverImageUrl &&
                  !failedImages.has(selectedPopup.coverImageUrl)
                "
                :key="selectedPopup.coverImageUrl"
                :src="selectedPopup.coverImageUrl"
                :alt="selectedPopup.name"
                width="90"
                height="120"
                @error="failedImages.add(selectedPopup.coverImageUrl!)"
              />
              <span v-else>이미지를 불러올 수 없습니다.</span>
            </div>
            <div class="popup-map__card-text">
              <strong>{{ selectedPopup.name }}</strong>
              <div class="popup-map__period-row">
                <span
                  v-if="selectedStatus"
                  class="popup-map__day-status"
                  :class="`popup-map__day-status--${selectedStatus.state}`"
                  >{{ selectedStatus.label }}</span
                >
                <span class="popup-map__period">{{ selectedPeriod }}</span>
              </div>
              <div
                v-if="selectedPopup.primaryTag"
                class="popup-map__tags"
                aria-label="팝업 태그"
              >
                <TagChip :title="selectedPopup.primaryTag">{{
                  selectedPopup.primaryTag
                }}</TagChip>
              </div>
            </div>
          </NuxtLink>
        </div>
        <button
          type="button"
          class="popup-map__arrow ds-control"
          :disabled="navigation.length < 2"
          aria-label="다음 팝업"
          @click.stop="stepSelection(1)"
        >
          <ChevronRight :size="20" />
        </button>
      </div>
      <div
        v-if="blockingMessage"
        class="popup-map__message"
        :role="state === 'loading' ? 'status' : 'alert'"
      >
        <p>{{ blockingMessage }}</p>
        <button
          v-if="state === 'sdk-error'"
          type="button"
          class="popup-map__retry ds-control"
          @click="reloadMap"
        >
          다시 불러오기
        </button>
      </div>
    </div>
    <div
      v-if="state === 'ready' && apiState === 'error'"
      class="popup-map__api-error"
      aria-live="polite"
      aria-atomic="true"
    >
      <p>팝업 위치를 가져오지 못했습니다.</p>
      <button
        type="button"
        class="popup-map__retry ds-control"
        @click="fetchPopups()"
      >
        다시 시도
      </button>
    </div>
  </div>
</template>

<style scoped>
.popup-map {
  width: 100%;
  min-width: 0;
}
.popup-map__frame {
  position: relative;
  width: 100%;
  height: 650px;
  overflow: hidden;
  border: 1px solid var(--ds-border);
  border-radius: var(--ds-radius-8);
  background: var(--ds-surface);
}
.popup-map__canvas {
  width: 100%;
  height: 100%;
}
.popup-map__selection {
  position: absolute;
  z-index: 2;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(464px, calc(100% - 16px));
  pointer-events: none;
}
.popup-map__card {
  position: relative;
  width: 360px;
  min-width: 0;
  flex: 1;
  background: var(--ds-background);
  border: 1px solid var(--ds-border);
  border-radius: var(--ds-radius-16);
  box-shadow: 0 3px 14px #00000024;
  overflow: hidden;
  pointer-events: auto;
}
.popup-map__card a {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  color: var(--ds-text);
  text-decoration: none;
}
.popup-map__image {
  flex: 0 0 90px;
  width: 90px;
  height: 120px;
  border-radius: var(--ds-radius-8);
  overflow: hidden;
  display: grid;
  place-items: center;
  background: var(--ds-surface);
  color: var(--ds-secondary);
  font-size: 11px;
  text-align: center;
}
.popup-map__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.popup-map__card-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  align-self: stretch;
  text-align: left;
}
.popup-map__card-text strong {
  display: block;
  padding-right: 32px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 18px;
  font-weight: 600;
  line-height: 24px;
}
.popup-map__period-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
}
.popup-map__day-status {
  flex-shrink: 0;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}
.popup-map__day-status--upcoming {
  color: #2563eb;
}
.popup-map__day-status--ongoing {
  color: #16805d;
}
.popup-map__day-status--last-day {
  color: #c05621;
}
.popup-map__day-status--ended {
  color: #9ca3af;
}
.popup-map__period {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--ds-secondary);
  font-size: 13px;
  line-height: 20px;
}
.popup-map__tags {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.popup-map__arrow,
.popup-map__close {
  display: grid;
  place-items: center;
  border: 1px solid var(--ds-border);
  border-radius: 50%;
  background: var(--ds-background);
  color: var(--ds-text);
  pointer-events: auto;
}
.popup-map__arrow {
  flex: 0 0 40px;
  height: 40px;
  box-shadow: 0 2px 8px #00000018;
}
.popup-map__arrow:disabled {
  opacity: 0.4;
  cursor: default;
}
.popup-map__close {
  position: absolute;
  right: 12px;
  top: 12px;
  width: 28px;
  height: 28px;
  border: 0;
}
@media (width < 480px) {
  .popup-map__selection {
    gap: 4px;
    width: min(464px, calc(100% - 12px));
  }
  .popup-map__arrow {
    flex-basis: 32px;
    height: 32px;
  }
}
.popup-map__message {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  background: var(--ds-surface);
  color: var(--ds-secondary);
  text-align: center;
}
.popup-map__api-error {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 8px;
  color: var(--ds-secondary);
  font-size: var(--ds-label-size);
}
.popup-map__retry {
  min-height: 36px;
  padding: 6px 12px;
  color: var(--ds-text);
  background: var(--ds-background);
  border: 1px solid var(--ds-border);
  border-radius: var(--ds-radius-4);
}
.popup-map__retry:hover {
  background: var(--ds-tag);
}
@media (width < 768px) {
  .popup-map__frame {
    height: clamp(360px, 65dvh, 650px);
  }
}
</style>
