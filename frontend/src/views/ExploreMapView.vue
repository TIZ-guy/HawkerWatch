<script setup>
// Explore Map: every hawker centre on the OneMap basemap, coloured by official closure status.
// The map images come from OneMap's public tile service, which needs no token.
// Distances are measured from the user's location, or from a postal code / place they search for
// (found with OneMap through our backend's GET /api/geocode).
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import HawkerCentreCard from '../components/HawkerCentreCard.vue'
import ErrorState from '../components/ErrorState.vue'
import FilterChips from '../components/FilterChips.vue'
import PlaceSearch from '../components/PlaceSearch.vue'
import { ONEMAP_ATTRIBUTION, ONEMAP_TILES, SINGAPORE_CENTRE } from '../utils/onemap.js'
import { getHawkerCentres } from '../services/hawkerService.js'
import { currentClosure } from '../utils/closures.js'
import { STATUS_ORDER, statusDisplay } from '../utils/status.js'
import { cssColor } from '../utils/colors.js'
import StatusBadge from '../components/StatusBadge.vue'
import { DISTANCE_OPTIONS_KM, distanceKm, formatDistance, getCurrentPosition } from '../services/locationService.js'

const SINGAPORE_BOUNDS = L.latLngBounds([1.144, 103.535], [1.494, 104.502])
// Marker colours come from the queue status tokens, so the map agrees with the list:
// the newest live report's status, grey when NEA says the centre is closed today,
// or a hollow marker when nobody has reported recently.
const NO_REPORTS = { label: 'No live reports', fill: '#ffffff', stroke: 'var(--dim)' }
const CLOSED_TODAY = { label: 'Closed today (NEA)', fill: 'var(--q-shut)', stroke: '#ffffff' }

function markerState(centre) {
  if (currentClosure(centre.closures)) return CLOSED_TODAY
  if (centre.live) {
    const display = statusDisplay(centre.live.latestStatus)
    return { label: display.label, fill: display.dotColor, stroke: '#ffffff', status: centre.live.latestStatus }
  }
  return NO_REPORTS
}

// Map legend: every status, then the two other kinds of marker
const LEGEND = [
  ...STATUS_ORDER.map((status) => ({ label: statusDisplay(status).label, fill: statusDisplay(status).dotColor, stroke: '#ffffff' })),
  CLOSED_TODAY,
  NO_REPORTS
]

const mapElement = ref(null)
const centres = ref([])
const loading = ref(true)
const errorMessage = ref('')
const selectedId = ref('')

const location = ref(null) // where distances are measured from: { lat, lng }
const locating = ref(false)
const locationError = ref('')
// A postal code or place the user searched for ({ lat, lng, label, ... }), or null when using their own location
const searchedPlace = ref(null)
const originName = computed(() => (searchedPlace.value ? searchedPlace.value.label : 'you'))

// Leaflet objects are kept outside Vue's reactivity; Vue doesn't need to track them.
let map = null
let userMarker = null
let radiusCircle = null
const markers = new Map()

const DISTANCE_CHOICES = [
  { value: 'all', label: 'All' },
  ...DISTANCE_OPTIONS_KM.map((km) => ({ value: String(km), label: `${km} km` }))
]
const distanceChoice = ref('all')
const radiusKm = computed(() => (distanceChoice.value === 'all' ? null : Number(distanceChoice.value)))

const selected = computed(() => centres.value.find((centre) => centre._id === selectedId.value) || null)
const distanceTo = (centre) => (location.value ? distanceKm(location.value, centre.location) : null)

// With a distance chosen, only centres inside it; otherwise every centre.
const visibleCentres = computed(() => {
  if (!radiusKm.value || !location.value) return centres.value
  return centres.value.filter((centre) => (distanceTo(centre) ?? Infinity) <= radiusKm.value)
})

// Nearest first once we know where the user is; otherwise A to Z (the API's order).
const listedCentres = computed(() => {
  if (!location.value) return visibleCentres.value
  return [...visibleCentres.value].sort((a, b) => (distanceTo(a) ?? Infinity) - (distanceTo(b) ?? Infinity))
})

const listHeading = computed(() => {
  if (radiusKm.value && location.value) return `Within ${radiusKm.value} km`
  return location.value ? 'Nearest centres' : 'All centres'
})

function markerStyle(centre, isSelected) {
  const state = markerState(centre)
  return {
    radius: isSelected ? 11 : 7,
    weight: isSelected ? 4 : 3,
    color: cssColor(state.stroke),
    fillColor: cssColor(state.fill),
    fillOpacity: 1
  }
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

// Puts the blue pin on `point` ({ lat, lng }) and measures distances from it.
// Returns false (with a message) when the point is outside Singapore.
function setOrigin(point, label) {
  const latLng = L.latLng(point.lat, point.lng)
  if (!SINGAPORE_BOUNDS.contains(latLng)) {
    locationError.value = "That's outside Singapore, so the map can't centre on it."
    return false
  }
  location.value = { lat: point.lat, lng: point.lng }
  userMarker?.remove()
  userMarker = L.circleMarker(latLng, { radius: 7, color: '#ffffff', weight: 3, fillColor: cssColor('var(--ink)'), fillOpacity: 1 })
    .bindTooltip(label)
    .addTo(map)
  if (!radiusKm.value) map.flyTo(latLng, 15)
  return true
}

async function locate() {
  locating.value = true
  locationError.value = ''
  try {
    const position = await getCurrentPosition()
    if (setOrigin(position, 'You are here')) searchedPlace.value = null
  } catch (error) {
    locationError.value = error.message
  } finally {
    locating.value = false
  }
}

// A postal code or place was found: measure distances from it instead of from the user
function usePlace(place) {
  locationError.value = ''
  if (setOrigin(place, place.label)) searchedPlace.value = place
}

// Back to no starting point: every centre, A to Z
function clearPlace() {
  searchedPlace.value = null
  location.value = null
  userMarker?.remove()
  userMarker = null
  distanceChoice.value = 'all'
}

// Shows only the markers inside the chosen distance, with the radius drawn around the user.
function showDistance() {
  if (!map) return
  const visibleIds = new Set(visibleCentres.value.map((centre) => centre._id))
  for (const [id, marker] of markers) {
    if (visibleIds.has(id)) {
      if (!map.hasLayer(marker)) marker.addTo(map)
    } else {
      marker.remove()
    }
  }
  if (selectedId.value && !visibleIds.has(selectedId.value)) clearSelection()

  radiusCircle?.remove()
  radiusCircle = null
  if (radiusKm.value && location.value) {
    radiusCircle = L.circle([location.value.lat, location.value.lng], {
      radius: radiusKm.value * 1000,
      color: cssColor('var(--ink)'),
      weight: 1,
      fillOpacity: 0.06,
      interactive: false
    }).addTo(map)
    map.flyToBounds(radiusCircle.getBounds(), { padding: [24, 24] })
  }
}

watch(distanceChoice, async (choice) => {
  if (!choice) {
    distanceChoice.value = 'all' // clicking the selected chip again goes back to All
    return
  }
  if (choice !== 'all' && !location.value) {
    await locate()
    if (!location.value) distanceChoice.value = 'all'
  }
})

watch([radiusKm, location], showDistance)

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
  <main class="container py-4">
    <h1 class="display-6 mb-2">Map</h1>
    <p class="text-secondary mb-4">
      Markers show the newest community queue report at each centre; grey means NEA has it closed today.
      Select a marker or a centre in the list for details.
    </p>

    <div class="row g-4">
      <div class="col-lg-8">
        <div class="hw-surface overflow-hidden position-relative">
          <div ref="mapElement" class="map" role="region" aria-label="Map of hawker centres in Singapore"></div>
          <div v-if="loading" class="map-overlay d-flex align-items-center justify-content-center gap-2 text-secondary" role="status">
            <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>Loading hawker centres...
          </div>
        </div>
        <ul class="list-inline small text-secondary mt-3 mb-0" aria-label="Map legend">
          <li v-for="item in LEGEND" :key="item.label" class="list-inline-item me-3">
            <span class="legend-dot" :style="{ background: item.fill, borderColor: item.stroke === '#ffffff' ? item.fill : item.stroke }" aria-hidden="true"></span>
            {{ item.label }}
          </li>
          <li class="list-inline-item">
            <span class="legend-dot legend-you" aria-hidden="true"></span>You / searched place
          </li>
        </ul>
      </div>

      <aside class="col-lg-4">
        <div class="map-rail d-grid gap-3">
          <div>
            <p class="form-label hw-label">Near a postal code</p>
            <PlaceSearch :place="searchedPlace" input-id="map-place-search" v-on:picked="usePlace" v-on:cleared="clearPlace" />
          </div>

          <div>
            <p class="form-label hw-label">Distance from {{ originName }}</p>
            <FilterChips v-model="distanceChoice" :options="DISTANCE_CHOICES" :label="`Distance from ${originName}`" />
          </div>

          <div>
            <button type="button" class="btn btn-sm btn-outline-dark" :disabled="locating" @click="locate">
              <span v-if="locating" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              <i v-else class="bi bi-crosshair me-2" aria-hidden="true"></i>{{ location ? 'Update my location' : 'Show where I am' }}
            </button>
            <p v-if="locationError" class="small text-brick mt-2 mb-0" role="alert">{{ locationError }}</p>
          </div>

          <ErrorState v-if="errorMessage" :message="errorMessage" retryable @retry="loadCentres" />

          <div v-if="selected" class="d-grid gap-2">
            <HawkerCentreCard :centre="selected" :distance-km="distanceTo(selected)" />
            <button type="button" class="btn btn-link btn-sm justify-self-start p-0 text-secondary" @click="clearSelection">
              <i class="bi bi-x me-1" aria-hidden="true"></i>Clear selection
            </button>
          </div>

          <section v-if="centres.length" class="hw-surface overflow-hidden" aria-labelledby="map-list-heading">
            <div class="px-3 pt-3 pb-2 border-bottom">
              <h2 id="map-list-heading" class="h6 mb-0">
                {{ listHeading }} <span class="hw-mono text-secondary fw-normal">({{ visibleCentres.length }})</span>
              </h2>
            </div>
            <p v-if="!visibleCentres.length" class="small text-secondary p-3 mb-0">
              No hawker centres within {{ radiusKm }} km of {{ originName }}. Try a bigger distance.
            </p>
            <div class="list-group list-group-flush centre-list">
              <button
                v-for="centre in listedCentres"
                :key="centre._id"
                type="button"
                class="list-group-item list-group-item-action d-grid gap-1 text-start"
                :class="{ active: centre._id === selectedId }"
                :aria-current="centre._id === selectedId"
                @click="select(centre)"
              >
                <span class="d-flex justify-content-between align-items-baseline gap-2">
                  <span class="fw-semibold min-w-0">{{ centre.name }}</span>
                  <span v-if="distanceTo(centre) != null" class="small hw-mono text-secondary text-nowrap">{{ formatDistance(distanceTo(centre)) }}</span>
                </span>
                <span class="small text-secondary">{{ centre.address }}</span>
                <span class="small">
                  <StatusBadge v-if="markerState(centre).status" :status="markerState(centre).status" />
                  <span v-else class="text-secondary">{{ markerState(centre).label }}</span>
                </span>
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.map {
  height: 620px;
  z-index: 0; /* keeps Leaflet's panes below the sticky navbar */
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
  background: var(--ink);
  border-color: var(--ink);
}

.centre-list {
  max-height: 420px;
  overflow-y: auto;
}

/* The selected centre: a neutral fill instead of Bootstrap's blue */
.centre-list .list-group-item.active {
  background: var(--sub);
  border-color: var(--line);
  color: var(--ink);
  border-left: 3px solid var(--ink);
}

.justify-self-start {
  justify-self: start;
}

/* The controls and list stay in view next to the map on wide screens */
@media (min-width: 992px) {
  .map-rail {
    position: sticky;
    top: 5rem;
  }
}
</style>
