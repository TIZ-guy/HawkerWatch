<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import SearchBar from '../components/SearchBar.vue'
import FilterChips from '../components/FilterChips.vue'
import HawkerCentreCard from '../components/HawkerCentreCard.vue'
import StallCard from '../components/StallCard.vue'
import LoadingState from '../components/LoadingState.vue'
import ErrorState from '../components/ErrorState.vue'
import PlaceSearch from '../components/PlaceSearch.vue'
import { getHawkerCentres, getStalls } from '../services/hawkerService.js'
import { currentClosure } from '../utils/closures.js'
import { DEFAULT_DISTANCE_KM, DISTANCE_OPTIONS_KM, distanceKm, getCurrentPosition } from '../services/locationService.js'

const SEARCH_DELAY_MS = 300
const MAX_CUISINE_CHIPS = 10

const QUICK_FILTERS = [
  { value: 'near', label: 'Near me', icon: 'bi-geo-alt', title: 'Centres close to you, nearest first' },
  { value: 'open', label: 'Open today', icon: 'bi-door-open', title: 'No official NEA closure today' },
  { value: 'live', label: 'Has live updates', icon: 'bi-broadcast', title: 'At least one community update in the last hour' }
]

const NEAR_DISTANCE_CHOICES = DISTANCE_OPTIONS_KM.map((km) => ({ value: String(km), label: `${km} km` }))

const search = ref('')
const debouncedSearch = ref('')
const quickFilters = ref([])
const cuisine = ref('')
const cuisineOptions = ref([])

const location = ref(null) // from the browser, when Near me is on
const locationError = ref('')
// A postal code or place the user searched for ({ lat, lng, label, ... }), or null.
// It works like Near me, but from that place instead of where the user is.
const searchedPlace = ref(null)
// Where distances are measured from: the searched place, or the user's location
const origin = computed(() => searchedPlace.value || location.value)

const centres = ref([])
const stalls = ref([])
const loading = ref(true)
const hasLoaded = ref(false)
const errorMessage = ref('')

const nearMe = computed(() => quickFilters.value.includes('near'))
const nearDistance = ref(String(DEFAULT_DISTANCE_KM))
const nearDistanceKm = computed(() => Number(nearDistance.value) || DEFAULT_DISTANCE_KM)
watch(nearDistance, (value) => { if (!value) nearDistance.value = String(DEFAULT_DISTANCE_KM) }) // clicking the chosen distance again keeps it
const openOnly = computed(() => quickFilters.value.includes('open'))
const liveOnly = computed(() => quickFilters.value.includes('live'))
const findingLocation = computed(() => nearMe.value && !location.value && !locationError.value)
const showStalls = computed(() => Boolean(debouncedSearch.value || cuisine.value))
const hasFilters = computed(() => Boolean(search.value || quickFilters.value.length || cuisine.value || searchedPlace.value))

// Typing only searches once the user pauses, instead of on every key.
let searchTimer
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { debouncedSearch.value = value }, SEARCH_DELAY_MS)
})

// Find (or Enter) searches straight away instead of waiting for the pause
function searchNow() {
  clearTimeout(searchTimer)
  debouncedSearch.value = search.value
}

watch(nearMe, async (on) => {
  locationError.value = ''
  if (!on) {
    location.value = null
    return
  }
  searchedPlace.value = null // Near me replaces a searched postal code
  try {
    location.value = await getCurrentPosition()
  } catch (error) {
    locationError.value = error.message
    quickFilters.value = quickFilters.value.filter((filter) => filter !== 'near')
  }
})

// A postal code or place was found: show centres near it (turns Near me off, as only one can be used)
function usePlace(place) {
  searchedPlace.value = place
  quickFilters.value = quickFilters.value.filter((filter) => filter !== 'near')
}

// Centres come from every filter combined. Stalls (shown when searching or picking a cuisine)
// are limited to the centres that pass the same filters.
let latestRequest = 0
async function loadResults() {
  const request = ++latestRequest
  const term = debouncedSearch.value
  const near = origin.value ? { lat: origin.value.lat, lng: origin.value.lng, radius: nearDistanceKm.value * 1000 } : {}
  loading.value = true
  errorMessage.value = ''

  try {
    const cuisineStallsPromise = cuisine.value ? getStalls({ cuisine: cuisine.value }) : Promise.resolve(null)
    const [pool, matches, cuisineStalls, stallMatches] = await Promise.all([
      getHawkerCentres(near),
      term ? getHawkerCentres({ search: term, ...near }) : null,
      cuisineStallsPromise,
      term ? getStalls({ search: term, cuisine: cuisine.value }) : cuisineStallsPromise.then((found) => found || [])
    ])

    const cuisineCentreIds = cuisineStalls && new Set(cuisineStalls.map((stall) => stall.hawkerCentre?._id))
    // liveStallCount comes with each centre in the list, so "Has live updates" needs no extra requests
    const allowed = pool.filter((centre) =>
      (!openOnly.value || !currentClosure(centre.closures)) &&
      (!liveOnly.value || centre.liveStallCount > 0) &&
      (!cuisineCentreIds || cuisineCentreIds.has(centre._id))
    )

    if (request !== latestRequest) return // a newer search has started
    const allowedIds = new Set(allowed.map((centre) => centre._id))
    const matchIds = matches && new Set(matches.map((centre) => centre._id))
    centres.value = matchIds ? allowed.filter((centre) => matchIds.has(centre._id)) : allowed
    stalls.value = stallMatches.filter((stall) => allowedIds.has(stall.hawkerCentre?._id))
    hasLoaded.value = true
  } catch (error) {
    if (request === latestRequest) errorMessage.value = error.message
  } finally {
    if (request === latestRequest) loading.value = false
  }
}

// Cuisine chips are the most common cuisines across all stalls.
async function loadCuisines() {
  try {
    const counts = new Map()
    for (const stall of await getStalls()) {
      if (stall.cuisine) counts.set(stall.cuisine, (counts.get(stall.cuisine) || 0) + 1)
    }
    cuisineOptions.value = [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_CUISINE_CHIPS)
      .map(([name]) => ({ value: name, label: name }))
  } catch {
    cuisineOptions.value = [] // the chips are optional, so the page works without them
  }
}

function clearFilters() {
  search.value = ''
  debouncedSearch.value = ''
  quickFilters.value = []
  cuisine.value = ''
  searchedPlace.value = null
}

watch([debouncedSearch, cuisine, origin, openOnly, liveOnly, nearDistanceKm], loadResults)

onMounted(() => {
  loadResults()
  loadCuisines()
})
</script>

<template>
  <main class="container py-5">
    <span class="eyebrow">Singapore food, checked before you go</span>
    <h1 class="display-5 fw-bold mt-2 mb-3">What are you craving today?</h1>
    <p class="lead text-secondary col-lg-7">
      Find official centre information and clearly labelled community updates for a smarter hawker run.
    </p>

    <div class="row g-4 mt-2">
      <div class="col-md-7">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body p-4">
            <SearchBar
              v-model="search"
              label="Find a centre or stall"
              placeholder="Search hawker centres or stalls"
              find-button
              @submit="searchNow"
            />
            <FilterChips v-model="quickFilters" class="mt-3" :options="QUICK_FILTERS" multiple label="Quick filters" />
            <PlaceSearch
              class="mt-4"
              :place="searchedPlace"
              input-id="home-place-search"
              label="Or find centres near a postal code"
              v-on:picked="usePlace"
              v-on:cleared="searchedPlace = null"
            />
            <div v-if="nearMe || searchedPlace" class="d-flex flex-wrap align-items-center gap-2 mt-2">
              <span class="small text-secondary">Within</span>
              <FilterChips v-model="nearDistance" :options="NEAR_DISTANCE_CHOICES" label="Distance" small />
            </div>
            <div v-if="cuisineOptions.length" class="mt-3">
              <p class="small fw-semibold text-secondary mb-2">Food options</p>
              <FilterChips v-model="cuisine" :options="cuisineOptions" label="Food options" small />
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-5">
        <div class="card border-0 shadow-sm h-100 accent-card">
          <div class="card-body p-4">
            <p class="text-uppercase small fw-bold mb-2">Community pulse</p>
            <h2 class="h4">Updates with a timestamp</h2>
            <p class="mb-0 text-secondary">Crowd and queue information is community submitted and may expire after 60 minutes.</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="locationError" class="alert alert-warning mt-4 mb-0" role="alert">
      <i class="bi bi-geo-alt me-2" aria-hidden="true"></i>{{ locationError }}
    </div>
    <p v-if="findingLocation" class="text-secondary mt-4 mb-0">
      <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Finding your location...
    </p>

    <LoadingState v-if="loading && !hasLoaded" class="mt-4" message="Loading hawker centres..." />
    <ErrorState v-else-if="errorMessage" class="mt-4" :message="errorMessage" retryable @retry="loadResults" />

    <div v-else class="results" :class="{ 'is-refreshing': loading }" :aria-busy="loading">
      <section class="mt-5" aria-labelledby="centres-heading">
        <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-3">
          <h2 id="centres-heading" class="h3 mb-0">
            Hawker centres <span class="text-secondary fs-5">({{ centres.length }})</span>
          </h2>
          <span v-if="origin" class="text-secondary small">
            Nearest first, within {{ nearDistanceKm }} km{{ searchedPlace ? ` of ${searchedPlace.label}` : '' }}
          </span>
        </div>

        <div v-if="centres.length" class="row g-4">
          <div v-for="centre in centres" :key="centre._id" class="col-sm-6 col-lg-4">
            <HawkerCentreCard :centre="centre" :distance-km="origin ? distanceKm(origin, centre.location) : null" />
          </div>
        </div>
        <div v-else class="alert alert-light border d-flex flex-wrap align-items-center justify-content-between gap-2">
          <span>No hawker centres match{{ hasFilters ? ' your search and filters' : '' }}.</span>
          <button v-if="hasFilters" type="button" class="btn btn-sm btn-outline-danger" @click="clearFilters">
            Clear filters
          </button>
        </div>
      </section>

      <section v-if="showStalls" class="mt-5" aria-labelledby="stalls-heading">
        <h2 id="stalls-heading" class="h3 mb-3">
          Stalls <span class="text-secondary fs-5">({{ stalls.length }})</span>
        </h2>
        <div v-if="stalls.length" class="row g-3">
          <div v-for="stall in stalls" :key="stall._id" class="col-sm-6 col-lg-4">
            <StallCard :stall="stall" show-centre />
          </div>
        </div>
        <div v-else class="alert alert-light border">No stalls match{{ hasFilters ? ' your search and filters' : '' }}.</div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.results {
  transition: opacity 0.15s ease;
}

.results.is-refreshing {
  opacity: 0.6;
}
</style>
