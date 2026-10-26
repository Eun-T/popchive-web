<script setup lang="ts">
import { loadGoogleMaps, MAPS_AUTH_FAILURE_EVENT, type GoogleMap, type GoogleMapsSdk, type GoogleMarker } from '~/utils/googleMaps'

const props = defineProps<{ latitude: number; longitude: number; name: string }>()
const config = useRuntimeConfig()
const canvas = ref<HTMLDivElement | null>(null)
const message = ref('지도를 불러오는 중입니다.')
let disposed = false
let sdk: GoogleMapsSdk | undefined
let map: GoogleMap | undefined
let marker: GoogleMarker | undefined
const onAuthFailure = () => { message.value = '지도를 불러오지 못했습니다. API 키 설정을 확인해 주세요.' }

onMounted(async () => {
  const key = String(config.public.googleMapsApiKey || '').trim()
  if (!key) { message.value = '지도 설정이 준비되지 않았습니다.'; return }
  window.addEventListener(MAPS_AUTH_FAILURE_EVENT, onAuthFailure)
  try {
    sdk = await loadGoogleMaps(key)
    if (disposed || !canvas.value) return
    const position = { lat: props.latitude, lng: props.longitude }
    map = new sdk.Map(canvas.value, {
      center: position, zoom: 16,
      mapId: String(config.public.googleMapsMapId || '').trim() || 'DEMO_MAP_ID',
      mapTypeControl: false, streetViewControl: false,
    })
    marker = new sdk.marker.AdvancedMarkerElement({
      map, position, title: props.name, gmpClickable: false, anchorLeft: '-50%', anchorTop: '-100%',
    })
    message.value = ''
  } catch { if (!disposed) message.value = '지도를 불러오지 못했습니다.' }
})
onBeforeUnmount(() => {
  disposed = true
  window.removeEventListener(MAPS_AUTH_FAILURE_EVENT, onAuthFailure)
  if (marker) marker.map = null
  if (map) sdk?.event.clearInstanceListeners(map)
})
</script>

<template>
  <div class="location-preview">
    <div ref="canvas" class="location-preview__canvas" :aria-label="`${name} 위치 지도`" />
    <p v-if="message" class="location-preview__message" role="status">{{ message }}</p>
  </div>
</template>

<style scoped>
.location-preview { position: relative; width: 100%; height: 240px; overflow: hidden; border-radius: 5px; background: #f5f5f7; }
.location-preview__canvas { width: 100%; height: 100%; }
.location-preview__message { position: absolute; inset: 0; display: grid; place-items: center; padding: 16px; background: #f5f5f7; color: #6b7280; text-align: center; font-size: 14px; }
</style>
