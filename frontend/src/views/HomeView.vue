<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import SearchBar from '../components/SearchBar.vue'
import FilterChips from '../components/FilterChips.vue'
import HawkerCentreCard from '../components/HawkerCentreCard.vue'
import StallCard from '../components/StallCard.vue'
import LoadingState from '../components/LoadingState.vue'
import ErrorState from '../components/ErrorState.vue'
import PlaceSearch from '../components/PlaceSearch.vue'
import { cuisineOptions } from '../utils/cuisines.js'
import { getHawkerCentres, getStalls } from '../services/hawkerService.js'
import { currentClosure } from '../utils/closures.js'
import { DEFAULT_DISTANCE_KM, DISTANCE_OPTIONS_KM, distanceKm, getCurrentPosition } from '../services/locationService.js'

const SEARCH_DELAY_MS = 300

const QUICK_FILTERS = [
  { value: 'near', label: 'Near me', icon: 'bi-geo-alt', title: 'Centres close to you, nearest first' },
  { value: 'open', label: 'Open today', icon: 'bi-door-open', title: 'No official NEA closure today' },
  { value: 'live', label: 'Has live updates', icon: 'bi-broadcast', title: 'At least one community update in the last hour' }
]

const NEAR_DISTANCE_CHOICES = DISTANCE_OPTIONS_KM.map((km) => ({ value: String(km), label: `${km} km` }))

const STALL_SORTS = [
  { value: 'distance', label: 'Nearest', icon: 'bi-geo-alt', title: 'Stalls at the closest centres first' },
  { value: 'name', label: 'A to Z' }
]

const search = ref('')
const debouncedSearch = ref('')
const quickFilters = ref([])
const cuisine = ref('')

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

// Stall results are sorted nearest first by default. Without Near me or a searched place, the user's
// location is asked for just to sort them, so it doesn't limit the centres the way Near me does.
const stallSort = ref('distance')
watch(stallSort, (value, previous) => { if (!value) stallSort.value = previous }) // clicking the chosen sort again keeps it
const sortLocation = ref(null)
const sortLocationError = ref('')
const findingSortLocation = ref(false)
const stallOrigin = computed(() => origin.value || sortLocation.value)

async function locateForSort() {
  if (stallOrigin.value || findingSortLocation.value) return
  findingSortLocation.value = true
  sortLocationError.value = ''
  try {
    sortLocation.value = await getCurrentPosition()
  } catch (error) {
    sortLocationError.value = `${error.message} Stalls are sorted A to Z instead.`
    stallSort.value = 'name'
  } finally {
    findingSortLocation.value = false
  }
}

watch([showStalls, stallSort], ([shown, sort]) => {
  if (shown && sort === 'distance') locateForSort()
}, { immediate: true })

// Each stall with its centre's distance (km, or null when unknown), in the chosen order.
// Stalls at centres without a location go last.
const stallResults = computed(() => {
  const from = stallOrigin.value
  const results = stalls.value.map((stall) => ({ stall, km: from ? distanceKm(from, stall.hawkerCentre?.location) : null }))
  if (stallSort.value === 'distance' && from) results.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity))
  return results
})

// Typing only searches once the user pauses, instead of on every key.
let searchTimer
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { debouncedSearch.value = value }, SEARCH_DELAY_MS)
})

// The Search button searches straight away, without waiting for the pause
function searchNow() {
  clearTimeout(searchTimer)
  debouncedSearch.value = search.value
}

// Totals for the footer, taken from the first unfiltered load (every centre, with its stall count)
const totals = ref(null)

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
    // live ({ stallsReported, ... } or null) comes with each centre in the list, so "Has live updates" needs no extra requests
    const allowed = pool.filter((centre) =>
      (!openOnly.value || !currentClosure(centre.closures)) &&
      (!liveOnly.value || centre.live?.stallsReported > 0) &&
      (!cuisineCentreIds || cuisineCentreIds.has(centre._id))
    )

    if (request !== latestRequest) return // a newer search has started
    const allowedIds = new Set(allowed.map((centre) => centre._id))
    const matchIds = matches && new Set(matches.map((centre) => centre._id))
    centres.value = matchIds ? allowed.filter((centre) => matchIds.has(centre._id)) : allowed
    if (!totals.value && !term && !near.lat && !cuisine.value && !openOnly.value && !liveOnly.value) {
      let stallTotal = 0
      for (const centre of pool) stallTotal += centre.stallCount || 0
      totals.value = { centres: pool.length, stalls: stallTotal }
    }
    stalls.value = stallMatches.filter((stall) => allowedIds.has(stall.hawkerCentre?._id))
    hasLoaded.value = true
  } catch (error) {
    if (request === latestRequest) errorMessage.value = error.message
  } finally {
    if (request === latestRequest) loading.value = false
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
})
</script>

<template>
  <main class="container py-4 py-lg-5">
    <h1 class="display-6 mb-2">See the queue before you go</h1>
    <p class="lead text-secondary mb-4">
      Official NEA closures and live, community-reported queues for every hawker centre in Singapore.
    </p>

    <!-- Search: centres, stalls or dishes, and centres near a postal code -->
    <div class="row g-3 align-items-end">
      <div class="col-lg-7">
        <div class="d-flex gap-2 align-items-end">
          <SearchBar v-model="search" data-testid="home-search" class="flex-grow-1 min-w-0" label="Centre, stall or dish" placeholder="e.g. Maxwell, laksa, Tian Tian" />
          <button type="button" class="btn hw-btn-primary" data-testid="home-search-button" @click="searchNow">Search</button>
        </div>
      </div>
      <div class="col-lg-5">
        <p class="form-label hw-label">Near a postal code</p>
        <PlaceSearch :place="searchedPlace" input-id="home-place-search" v-on:picked="usePlace" v-on:cleared="searchedPlace = null" />
      </div>
    </div>

    <!-- Filters, directly on the page -->
    <div class="d-grid gap-2 mt-3">
      <FilterChips v-model="quickFilters" data-testid="home-quick-filters" :options="QUICK_FILTERS" multiple label="Quick filters" />
      <div class="d-flex flex-wrap align-items-center gap-2">
        <span class="hw-label">Cuisine</span>
        <FilterChips v-model="cuisine" data-testid="home-cuisine-filters" :options="cuisineOptions" label="Cuisine" small />
      </div>
      <div v-if="nearMe || searchedPlace" class="d-flex flex-wrap align-items-center gap-2">
        <span class="hw-label">Within</span>
        <FilterChips v-model="nearDistance" :options="NEAR_DISTANCE_CHOICES" label="Distance" small />
      </div>
    </div>

    <div v-if="locationError" class="alert alert-warning mt-3 mb-0" role="alert">
      <i class="bi bi-geo-alt me-2" aria-hidden="true"></i>{{ locationError }}
    </div>
    <p v-if="findingLocation" class="text-secondary mt-3 mb-0">
      <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Finding your location...
    </p>

    <LoadingState v-if="loading && !hasLoaded" class="mt-4" message="Loading hawker centres..." />
    <ErrorState v-else-if="errorMessage" class="mt-4" :message="errorMessage" retryable @retry="loadResults" />

    <div v-else class="results" :class="{ 'is-refreshing': loading }" :aria-busy="loading">
      <section class="mt-4" aria-labelledby="centres-heading">
        <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 border-bottom pb-2 mb-3">
          <h2 id="centres-heading" class="h5 mb-0">
            <span class="hw-mono" data-testid="home-centre-count">{{ centres.length }}</span> centre{{ centres.length === 1 ? '' : 's' }}{{ hasFilters ? ' match' : '' }}
          </h2>
          <span class="text-secondary small">
            <template v-if="origin">Nearest first, within {{ nearDistanceKm }} km{{ searchedPlace ? ` of ${searchedPlace.label}` : '' }}</template>
            <template v-else>A to Z</template>
          </span>
        </div>

        <div v-if="centres.length" class="row g-4">
          <div v-for="centre in centres" :key="centre._id" class="col-sm-6 col-lg-4">
            <HawkerCentreCard :centre="centre" :distance-km="origin ? distanceKm(origin, centre.location) : null" />
          </div>
        </div>
        <div v-else class="hw-surface p-3 d-flex flex-wrap align-items-center justify-content-between gap-2" data-testid="home-no-results">
          <span>No hawker centres match{{ hasFilters ? ' your search and filters' : '' }}.</span>
          <button v-if="hasFilters" type="button" class="btn btn-sm btn-outline-dark" @click="clearFilters">
            Clear filters
          </button>
        </div>
      </section>

      <section v-if="showStalls" class="mt-5" aria-labelledby="stalls-heading" data-testid="home-stall-results">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 border-bottom pb-2 mb-3">
          <h2 id="stalls-heading" class="h5 mb-0">
            <span class="hw-mono">{{ stalls.length }}</span> stall{{ stalls.length === 1 ? '' : 's' }}
          </h2>
          <div class="d-flex flex-wrap align-items-center gap-2">
            <span class="hw-label">Sort</span>
            <FilterChips v-model="stallSort" data-testid="home-stall-sort" :options="STALL_SORTS" label="Sort stalls" small />
          </div>
        </div>
        <p v-if="findingSortLocation" class="small text-secondary">
          <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Finding your location to sort stalls by distance...
        </p>
        <p v-else-if="sortLocationError" class="small text-secondary" role="status">
          <i class="bi bi-geo-alt me-1" aria-hidden="true"></i>{{ sortLocationError }}
        </p>
        <p v-else-if="stallSort === 'distance' && stallOrigin && stalls.length" class="small text-secondary">
          Nearest first, from {{ searchedPlace ? searchedPlace.label : 'your location' }}
        </p>
        <div v-if="stalls.length" class="row g-4">
          <div v-for="{ stall, km } in stallResults" :key="stall._id" class="col-sm-6 col-lg-4">
            <StallCard :stall="stall" show-centre :distance-km="km" />
          </div>
        </div>
        <div v-else class="hw-surface p-3">No stalls match{{ hasFilters ? ' your search and filters' : '' }}.</div>
      </section>
    </div>

    <p class="small text-secondary border-top pt-3 mt-5 mb-0">
      <template v-if="totals">
        <span class="hw-mono">{{ totals.centres.toLocaleString() }}</span> centres ·
        <span class="hw-mono">{{ totals.stalls.toLocaleString() }}</span> stalls ·
      </template>
      Community reports are submitted by diners and expire after 60 minutes. Closures are official NEA data.
    </p>
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
