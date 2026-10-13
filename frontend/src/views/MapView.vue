<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import HawkerCentreCard from '../components/HawkerCentreCard.vue'
import ErrorState from '../components/ErrorState.vue'
import { getHawkerCentres } from '../services/hawkerService.js'
import { currentClosure, daysUntil, upcomingClosures } from '../utils/closures.js'
import { distanceKm, formatDistance, getCurrentPosition } from '../utils/location.js'

const SINGAPORE_CENTRE = [1.3521, 103.8198]
const SINGAPORE_BOUNDS = L.latLngBounds([1.144, 103.535], [1.494, 104.502])
const UPCOMING_DAYS = 7

const ONEMAP_TILES = 'https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png'
const ONEMAP_ATTRIBUTION =
  '<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" style="height:20px;width:20px;" alt="" />' +
  '&nbsp;<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a>' +
  '&nbsp;&copy;&nbsp;contributors&nbsp;&#124;&nbsp;' +
  '<a href="https://www.sla.gov.sg/" target="_blank" rel="noopener noreferrer">Singapore Land Authority</a>'

const MARKER_STYLES = {
  closed: { color: '#b02a37', fillColor: '#dc3545', label: 'Closed today' },
  soon: { color: '#997404', fillColor: '#ffc107', label: `Closure in the next ${UPCOMING_DAYS} days` },
  open: { color: '#146c43', fillColor: '#198754', label: 'No closure in the next week' }
}

function closureState(centre) {
  if (currentClosure(centre.closures)) return 'closed'
  const [next] = upcomingClosures(centre.closures)
  return next && daysUntil(next.startDate) <= UPCOMING_DAYS ? 'soon' : 'open'
}

const mapElement = ref(null)
const centres = ref([])
const loading = ref(true)
const errorMessage = ref('')
const selectedId = ref('')

const location = ref(null)
const locating = ref(false)
const locationError = ref('')

let map = null
let userMarker = null
const markers = new Map()

const selected = computed(() => centres.value.find((centre) => centre._id === selectedId.value) || null)
const distanceTo = (centre) => (location.value ? distanceKm(location.value, centre.location) : null)

const listedCentres = computed(() => {
  if (!location.value) return centres.value
  return [...centres.value].sort((a, b) => (distanceTo(a) ?? Infinity) - (distanceTo(b) ?? Infinity))
})

function markerStyle(centre, isSelected) {
  const { color, fillColor } = MARKER_STYLES[closureState(centre)]
  return { radius: isSelected ? 12 : 8, weight: isSelected ? 4 : 2, color, fillColor, fillOpacity: 0.9 }
}

function select(centre, { fly = true } = {}) {
  const previous = centres.value.find((item) => item._id === selectedId.value)
  if (previous) markers.get(previous._id)?.setStyle(markerStyle(previous, false))

  selectedId.value = centre._id
  const marker = markers.get(centre._id)
  if (!marker) return
  marker.setStyle(markerStyle(centre, true)).bringToFront()
  if (fly) map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 15))
}

function clearSelection() {
  const previous = selected.value
  selectedId.value = ''
  if (previous) markers.get(previous._id)?.setStyle(markerStyle(previous, false))
}

function createMap() {
  map = L.map(mapElement.value, {
    center: SINGAPORE_CENTRE,
    zoom: 12,
    minZoom: 11,
    maxZoom: 19,
    maxBounds: SINGAPORE_BOUNDS.pad(0.1),
    maxBoundsViscosity: 1
  })
  L.tileLayer(ONEMAP_TILES, { minZoom: 11, maxZoom: 19, detectRetina: true, attribution: ONEMAP_ATTRIBUTION }).addTo(map)
}

function addMarkers() {
  for (const centre of centres.value) {
    const coordinates = centre.location?.coordinates
    if (!coordinates) continue
    const [lng, lat] = coordinates
    const marker = L.circleMarker([lat, lng], markerStyle(centre, false))
      .bindTooltip(centre.name, { direction: 'top', offset: [0, -10] })
      .on('click', () => select(centre, { fly: false }))
      .addTo(map)
    markers.set(centre._id, marker)
  }
  if (markers.size) {
    map.fitBounds(L.featureGroup([...markers.values()]).getBounds(), { padding: [48, 48], maxZoom: 15 })
  }
}

async function locate() {
  locating.value = true
  locationError.value = ''
  try {
    const position = await getCurrentPosition()
    const latLng = L.latLng(position.lat, position.lng)
    if (!SINGAPORE_BOUNDS.contains(latLng)) {
      locationError.value = "You seem to be outside Singapore, so the map can't centre on you."
      return
    }
    location.value = position
    userMarker?.remove()
    userMarker = L.circleMarker(latLng, { radius: 7, color: '#ffffff', weight: 3, fillColor: '#0d6efd', fillOpacity: 1 })
      .bindTooltip('You are here')
      .addTo(map)
    map.flyTo(latLng, 14)
  } catch (error) {
    locationError.value = error.message
  } finally {
    locating.value = false
  }
}

async function loadCentres() {
  loading.value = true
  errorMessage.value = ''
  try {
    centres.value = await getHawkerCentres()
    addMarkers()
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  createMap()
  loadCentres()
})

onBeforeUnmount(() => {
  map?.remove()
  markers.clear()
})
</script>

<template>
  <main class="container py-5">
    <span class="eyebrow">Explore</span>
    <h1 class="display-6 fw-bold mt-1 mb-2">Hawker centres on the map</h1>
    <p class="text-secondary mb-4">
      Marker colours show official NEA closures. Select a marker or a centre in the list for details.
    </p>

    <div class="row g-4">
      <div class="col-lg-8">
        <div class="card border-0 shadow-sm overflow-hidden position-relative">
          <div ref="mapElement" class="map" role="region" aria-label="Map of hawker centres in Singapore"></div>
          <div v-if="loading" class="map-overlay d-flex align-items-center justify-content-center gap-2 text-secondary" role="status">
            <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>Loading hawker centres...
          </div>
        </div>
        <ul class="list-inline small text-secondary mt-3 mb-0" aria-label="Map legend">
          <li v-for="(style, key) in MARKER_STYLES" :key="key" class="list-inline-item me-4">
            <span class="legend-dot" :style="{ background: style.fillColor, borderColor: style.color }" aria-hidden="true"></span>
            {{ style.label }}
          </li>
          <li class="list-inline-item">
            <span class="legend-dot legend-you" aria-hidden="true"></span>You
          </li>
        </ul>
      </div>

      <aside class="col-lg-4 d-grid gap-3 align-content-start">
        <div>
          <button type="button" class="btn btn-outline-danger" :disabled="locating" @click="locate">
            <span v-if="locating" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
            <i v-else class="bi bi-crosshair me-2" aria-hidden="true"></i>{{ location ? 'Update my location' : 'Show where I am' }}
          </button>
          <p v-if="locationError" class="small text-danger mt-2 mb-0" role="alert">{{ locationError }}</p>
        </div>

        <ErrorState v-if="errorMessage" :message="errorMessage" retryable @retry="loadCentres" />

        <div v-if="selected" class="d-grid gap-2">
          <HawkerCentreCard :centre="selected" :distance-km="distanceTo(selected)" />
          <button type="button" class="btn btn-link btn-sm justify-self-start p-0 text-secondary" @click="clearSelection">
            <i class="bi bi-x me-1" aria-hidden="true"></i>Clear selection
          </button>
        </div>

        <section v-if="centres.length" class="card border-0 shadow-sm" aria-labelledby="map-list-heading">
          <div class="card-body pb-2">
            <h2 id="map-list-heading" class="h6 mb-0">
              {{ location ? 'Nearest centres' : 'All centres' }} <span class="text-secondary">({{ centres.length }})</span>
            </h2>
          </div>
          <div class="list-group list-group-flush centre-list">
            <button
              v-for="centre in listedCentres"
              :key="centre._id"
              type="button"
              class="list-group-item list-group-item-action d-flex align-items-start gap-2"
              :class="{ active: centre._id === selectedId }"
              :aria-current="centre._id === selectedId"
              @click="select(centre)"
            >
              <span
                class="legend-dot mt-1 flex-shrink-0"
                :style="{ background: MARKER_STYLES[closureState(centre)].fillColor, borderColor: MARKER_STYLES[closureState(centre)].color }"
                aria-hidden="true"
              ></span>
              <span class="flex-grow-1 text-start">
                <span class="d-block fw-semibold">{{ centre.name }}</span>
                <span class="d-block small opacity-75">{{ centre.address }}</span>
              </span>
              <span v-if="distanceTo(centre) != null" class="small opacity-75 text-nowrap">{{ formatDistance(distanceTo(centre)) }}</span>
            </button>
          </div>
        </section>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.map {
  height: 620px;
  z-index: 0;
}

.map-overlay {
  position: absolute;
  inset: 0;
  z-index: 500;
  background: rgba(255, 255, 255, 0.7);
}

.legend-dot {
  display: inline-block;
  width: 0.8rem;
  height: 0.8rem;
  border-radius: 50%;
  border: 2px solid;
  vertical-align: -0.1em;
  margin-right: 0.35rem;
}

.legend-you {
  background: #0d6efd;
  border-color: #ffffff;
  box-shadow: 0 0 0 1px #0d6efd;
}

.centre-list {
  max-height: 420px;
  overflow-y: auto;
}

.list-group-item.active .legend-dot {
  border-color: #ffffff !important;
}

.justify-self-start {
  justify-self: start;
}
</style>
