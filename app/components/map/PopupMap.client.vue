<script setup lang="ts">
import type { MapPopup, PopupMapResponse } from '../../../shared/types/map'
import {
  loadGoogleMaps, MAPS_AUTH_FAILURE_EVENT,
  type GoogleMap, type GoogleMapsSdk, type GoogleMarker, type GoogleInfoWindow, type MapsListener,
} from '~/utils/googleMaps'

type BoundsQuery = { minLat: number; maxLat: number; minLng: number; maxLng: number }
const config = useRuntimeConfig()
const canvas = ref<HTMLDivElement | null>(null)
const state = ref<'loading' | 'ready' | 'missing-key' | 'sdk-error'>('loading')
const apiState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const popupCount = ref(0)
let sdk: GoogleMapsSdk | undefined
let map: GoogleMap | undefined
let info: GoogleInfoWindow | undefined
let disposed = false
let debounce: ReturnType<typeof setTimeout> | undefined
let request: AbortController | undefined
let requestVersion = 0
let activeKey = ''
let successfulKey = ''
const listeners: MapsListener[] = []
const markers: { marker: GoogleMarker; click: EventListener }[] = []

const blockingMessage = computed(() => {
  if (state.value === 'missing-key') return 'Google Maps 웹용 API 키가 설정되지 않았습니다.'
  if (state.value === 'sdk-error') return 'Google 지도를 불러오지 못했습니다. 네트워크와 API 키·허용 도메인 설정을 확인해 주세요.'
  if (state.value === 'loading') return '지도를 불러오는 중입니다.'
  return ''
})
const resultMessage = computed(() => {
  if (apiState.value === 'error') return '팝업 위치를 가져오지 못했습니다.'
  if (apiState.value === 'ready') return popupCount.value ? `현재 지도 영역의 팝업 ${popupCount.value}개` : '현재 지도 영역에 진행 중인 팝업이 없습니다.'
  return '팝업 위치를 불러오는 중입니다.'
})

function clearMarkers() {
  info?.close()
  for (const { marker, click } of markers) {
    marker.removeEventListener('gmp-click', click)
    marker.map = null
  }
  markers.length = 0
}

function drawMarkers(popups: MapPopup[]) {
  clearMarkers()
  if (!map || !sdk) return
  for (const popup of popups) {
    const dot = document.createElement('span')
    // Created outside Vue's template: inline styles avoid scoped-style attributes being required.
    Object.assign(dot.style, {
      display: 'block', width: '18px', height: '18px', borderRadius: '50%',
      background: '#111111', border: '2px solid #ffffff', boxShadow: '0 1px 4px #00000040',
    })
    const marker = new sdk.marker.AdvancedMarkerElement({
      map, position: { lat: popup.latitude, lng: popup.longitude }, title: popup.name,
      gmpClickable: true, anchorLeft: '-50%', anchorTop: '-50%',
    })
    marker.append(dot)
    const click: EventListener = () => {
      if (!map || !info) return
      const name = document.createElement('a')
      name.href = `/places/${encodeURIComponent(popup.id)}`
      name.setAttribute('aria-label', `${popup.name} 상세 보기`)
      name.textContent = popup.name // API names are text, never HTML.
      info.setContent(name)
      info.open({ map, anchor: marker, shouldFocus: false })
    }
    marker.addEventListener('gmp-click', click)
    markers.push({ marker, click })
  }
}

function queriesForBounds(): BoundsQuery[] {
  const bounds = map?.getBounds()?.toJSON()
  if (!bounds) return []
  // Outward rounding keeps boundary points in view; tiny SDK float changes share a key.
  const floor = (value: number) => Math.floor(value * 1e6) / 1e6
  const ceil = (value: number) => Math.ceil(value * 1e6) / 1e6
  const latitude = { minLat: Math.max(-90, floor(bounds.south)), maxLat: Math.min(90, ceil(bounds.north)) }
  const west = Math.max(-180, floor(bounds.west))
  const east = Math.min(180, ceil(bounds.east))
  // The backend requires minLng <= maxLng. Split a view crossing the date line.
  return west <= east
    ? [{ ...latitude, minLng: west, maxLng: east }]
    : [{ ...latitude, minLng: west, maxLng: 180 }, { ...latitude, minLng: -180, maxLng: east }]
}

async function fetchPopups(force = false) {
  if (disposed || state.value !== 'ready') return
  const queries = queriesForBounds()
  if (!queries.length) return
  const key = JSON.stringify(queries)
  if (!force && (key === activeKey || key === successfulKey)) return
  request?.abort()
  const controller = new AbortController()
  request = controller
  const version = ++requestVersion
  activeKey = key
  successfulKey = ''
  apiState.value = 'loading'
  try {
    const responses = await Promise.all(queries.map(bounds => $fetch<PopupMapResponse>('/api/popups/map', {
      query: { ...bounds, languageCode: 'ko' },
      signal: controller.signal,
      timeout: 15_000,
      retry: 0,
      credentials: 'omit',
    })))
    if (disposed || version !== requestVersion || controller.signal.aborted) return
    const popups = [...new Map(responses.flatMap(response => response.popups).map(popup => [popup.id, popup])).values()]
    drawMarkers(popups)
    popupCount.value = popups.length
    successfulKey = key
    apiState.value = 'ready'
  } catch {
    if (disposed || version !== requestVersion || controller.signal.aborted) return
    controller.abort()
    clearMarkers()
    popupCount.value = 0
    apiState.value = 'error'
  } finally {
    if (version === requestVersion) {
      activeKey = ''
      request = undefined
    }
  }
}

function cancelPendingRequest() {
  clearTimeout(debounce)
  request?.abort()
  request = undefined
  activeKey = ''
  ++requestVersion
}

function onAuthenticationFailure() {
  if (disposed) return
  cancelPendingRequest()
  clearMarkers()
  state.value = 'sdk-error'
}

function reloadMap() { window.location.reload() }

onMounted(async () => {
  const key = String(config.public.googleMapsApiKey || '').trim()
  if (!key) {
    state.value = 'missing-key'
    return
  }
  window.addEventListener(MAPS_AUTH_FAILURE_EVENT, onAuthenticationFailure)
  try {
    sdk = await loadGoogleMaps(key)
    if (disposed || !canvas.value || state.value === 'sdk-error') return
    map = new sdk.Map(canvas.value, {
      center: { lat: 37.5665, lng: 126.9780 }, zoom: 12,
      // Google permits DEMO_MAP_ID for development. Set your own JavaScript map ID for production.
      mapId: String(config.public.googleMapsMapId || '').trim() || 'DEMO_MAP_ID',
      mapTypeControl: false, streetViewControl: false,
    })
    info = new sdk.InfoWindow({ disableAutoPan: true })
    state.value = 'ready'
    listeners.push(map.addListener('bounds_changed', cancelPendingRequest))
    listeners.push(map.addListener('idle', () => {
      clearTimeout(debounce)
      debounce = setTimeout(() => { void fetchPopups() }, 250)
    }))
  } catch {
    if (!disposed) state.value = 'sdk-error'
  }
})

onBeforeUnmount(() => {
  disposed = true
  cancelPendingRequest()
  window.removeEventListener(MAPS_AUTH_FAILURE_EVENT, onAuthenticationFailure)
  clearMarkers()
  for (const listener of listeners) listener.remove()
  if (map) sdk?.event.clearInstanceListeners(map)
  map = undefined
})
</script>

<template>
  <div class="popup-map">
    <div class="popup-map__frame" :aria-busy="state === 'loading'">
      <div ref="canvas" class="popup-map__canvas" aria-label="팝업 위치 지도" />
      <div v-if="blockingMessage" class="popup-map__message" :role="state === 'loading' ? 'status' : 'alert'">
        <p>{{ blockingMessage }}</p>
        <button v-if="state === 'sdk-error'" type="button" class="popup-map__retry ds-control" @click="reloadMap">다시 불러오기</button>
      </div>
    </div>
    <div v-if="state === 'ready'" class="popup-map__status" aria-live="polite" aria-atomic="true">
      <p>{{ resultMessage }}</p>
      <button v-if="apiState === 'error'" type="button" class="popup-map__retry ds-control" @click="fetchPopups(true)">다시 시도</button>
    </div>
  </div>
</template>

<style scoped>
.popup-map { width: 100%; min-width: 0; }
.popup-map__frame {
  position: relative;
  width: 100%;
  height: 650px;
  overflow: hidden;
  border: 1px solid var(--ds-border);
  border-radius: var(--ds-radius-8);
  background: var(--ds-surface);
}
.popup-map__canvas { width: 100%; height: 100%; }
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
.popup-map__status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  min-height: 44px;
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
.popup-map__retry:hover { background: var(--ds-tag); }
@media (width < 768px) {
  .popup-map__frame { height: clamp(360px, 65dvh, 650px); }
}
</style>
