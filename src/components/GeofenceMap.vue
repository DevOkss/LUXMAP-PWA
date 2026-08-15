<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import L from 'leaflet'

const TCGC_CENTER = { lat: 8.065254, lng: 123.756733 }

const props = defineProps<{
  modelValue: { lat: number; lng: number; radius: number }
  readonly?: boolean
  userLat?: number | null
  userLng?: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [v: { lat: number; lng: number; radius: number }]
}>()

const mapContainer = ref<HTMLElement>()
const offline = ref(!navigator.onLine)
const tilesFailed = ref(false)
let map: L.Map | null = null
let marker: L.Marker | null = null
let circle: L.Circle | null = null
let userMarker: L.Marker | null = null

const mapUnavailable = () => offline.value || tilesFailed.value

function centerIcon() {
  return L.divIcon({
    className: '',
    html: '<div style="width:20px;height:20px;background:#20673A;border:4px solid white;border-radius:50%;box-shadow:0 0 0 2px rgba(32,103,58,0.35)"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

function userDotIcon() {
  return L.divIcon({
    className: '',
    html: '<div style="width:16px;height:16px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 0 8px rgba(59,130,246,0.6)"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function emitUpdate() {
  if (!marker) return
  const pos = marker.getLatLng()
  moveCircleToMarker()
  emit('update:modelValue', { lat: pos.lat, lng: pos.lng, radius: props.modelValue.radius })
}

function moveCircleToMarker() {
  if (!marker || !circle) return
  circle.setLatLng(marker.getLatLng())
}

function updateRadius(r: number) {
  if (!circle) return
  circle.setRadius(r)
}

watch(() => props.modelValue.radius, (r) => updateRadius(r))

watch([() => props.modelValue.lat, () => props.modelValue.lng], ([lat, lng]) => {
  if (marker && map) {
    marker.setLatLng([lat, lng])
    circle?.setLatLng([lat, lng])
    map.setView([lat, lng], map.getZoom())
  }
})

watch([() => props.userLat, () => props.userLng], ([ulat, ulng]) => {
  if (!map) return
  if (!userMarker && ulat != null && ulng != null) {
    userMarker = L.marker([ulat, ulng], { icon: userDotIcon() }).addTo(map)
  } else if (userMarker) {
    if (ulat != null && ulng != null) {
      userMarker.setLatLng([ulat, ulng])
    }
  }
})

function handleOnline() {
  offline.value = false
}
function handleOffline() {
  offline.value = true
}

onMounted(() => {
  if (!mapContainer.value) return
  const lat = props.modelValue.lat || TCGC_CENTER.lat
  const lng = props.modelValue.lng || TCGC_CENTER.lng
  map = L.map(mapContainer.value).setView([lat, lng], 17)

  const tiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri',
    maxZoom: 20,
  }).addTo(map)

  // If a tile request fails (no internet), mark the imagery unavailable and
  // let the fallback background show through.
  tiles.on('tileerror', () => {
    tilesFailed.value = true
  })

  marker = L.marker([lat, lng], { draggable: !props.readonly, icon: centerIcon() }).addTo(map)
  if (!props.readonly) {
    marker.on('drag', moveCircleToMarker)
    marker.on('dragend', emitUpdate)
  }
  circle = L.circle([lat, lng], { radius: props.modelValue.radius, color: '#20673A', fillColor: '#20673A', fillOpacity: 0.15 }).addTo(map)

  if (props.userLat != null && props.userLng != null) {
    userMarker = L.marker([props.userLat, props.userLng], { icon: userDotIcon() }).addTo(map)
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
})

onUnmounted(() => {
  map?.remove()
  map = null
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
})
</script>

<template>
  <div class="relative">
    <div
      ref="mapContainer"
      class="h-64 w-full overflow-hidden rounded-xl border border-gray-300"
      :class="mapUnavailable() ? 'map-fallback' : ''"
    ></div>

    <div
      v-if="mapUnavailable()"
      class="pointer-events-none absolute inset-x-0 top-2 flex justify-center"
    >
      <span class="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
        <span class="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
        Map imagery unavailable offline — showing your location
      </span>
    </div>
  </div>
</template>

<style scoped>
/* Fallback used when satellite tiles cannot load (offline). The geofence
   circle and markers are vector overlays, so they keep rendering on top. */
.map-fallback {
  background:
    linear-gradient(rgba(32, 103, 58, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(32, 103, 58, 0.08) 1px, transparent 1px),
    linear-gradient(rgba(32, 103, 58, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(32, 103, 58, 0.05) 1px, transparent 1px),
    #eaf0ea;
  background-size:
    80px 80px,
    80px 80px,
    16px 16px,
    16px 16px;
}
.map-fallback :deep(.leaflet-tile-pane) {
  display: none;
}
</style>
