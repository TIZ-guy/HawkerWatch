<script setup>
// Centre detail page: official closures, community summary, the centre's stalls and comments.
// A link ending in #stall-<id> (from the home page stall results) scrolls to that stall.
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import OfficialClosureAlert from '../components/OfficialClosureAlert.vue'
import CommunityUpdateCard from '../components/CommunityUpdateCard.vue'
import StallCard from '../components/StallCard.vue'
import SearchBar from '../components/SearchBar.vue'
import FilterChips from '../components/FilterChips.vue'
import LoadingState from '../components/LoadingState.vue'
import ErrorState from '../components/ErrorState.vue'
import FavouriteButton from '../components/FavouriteButton.vue'
import CommentSection from '../components/CommentSection.vue'
import StallForm from '../components/StallForm.vue'
import { useAuthStore } from '../stores/useAuthStore.js'
import { getCommunitySummary, getHawkerCentre, getHawkerCentreStalls } from '../services/hawkerService.js'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const centre = ref(null)
const stalls = ref([])
const loading = ref(true)
const errorMessage = ref('')
const notFound = ref(false)

const summary = ref(null)
const summaryError = ref('')

const stallSearch = ref('')
const cuisine = ref('')
const highlightedStallId = ref('')

// "Add a stall" form (no official stall list exists, so diners add them)
const addingStall = ref(false)
const addedMessage = ref('')

const cuisineOptions = computed(() =>
  [...new Set(stalls.value.map((stall) => stall.cuisine).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ value: name, label: name }))
)

// The stall list is small, so filtering happens here instead of with another request.
const visibleStalls = computed(() => {
  const term = stallSearch.value.toLowerCase()
  return stalls.value.filter((stall) =>
    (!cuisine.value || stall.cuisine === cuisine.value) &&
    (!term || [stall.name, stall.cuisine, stall.unitNumber].some((text) => text?.toLowerCase().includes(term)))
  )
})

const liveStallCount = computed(() => stalls.value.filter((stall) => stall.liveReport).length)

const directionsUrl = computed(() => {
  const coordinates = centre.value?.location?.coordinates
  if (!coordinates) return ''
  const [lng, lat] = coordinates
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
})

function startAddingStall() {
  addedMessage.value = ''
  if (!auth.user) {
    router.push({ path: '/login', query: { redirect: `${route.path}#stalls` } })
    return
  }
  addingStall.value = true
}

// Show the new stall in the list straight away, sorted by name like the rest
function onStallAdded(stall) {
  addingStall.value = false
  stalls.value = [...stalls.value, stall].sort((a, b) => a.name.localeCompare(b.name))
  stallSearch.value = ''
  cuisine.value = ''
  addedMessage.value = `Thanks! ${stall.name} has been added.`
}

// After someone reports a stall, show it as that stall's latest update and recount the summary.
function onStallReported(stallId, report) {
  stalls.value = stalls.value.map((stall) => (stall._id === stallId ? { ...stall, liveReport: report } : stall))
  loadSummary(route.params.id, { keepCurrent: true })
}

// After a flag hides a report, reload every stall's latest update and the summary, without a loading screen.
async function refreshStatuses() {
  const id = route.params.id
  loadSummary(id, { keepCurrent: true })
  try {
    const fresh = await getHawkerCentreStalls(id)
    if (id === route.params.id) stalls.value = fresh
  } catch {
    // Keep showing the current list; the next page load will catch up.
  }
}

async function loadSummary(id, { keepCurrent = false } = {}) {
  if (!keepCurrent) summary.value = null // keepCurrent avoids flashing "Loading" on a refresh
  summaryError.value = ''
  try {
    const result = await getCommunitySummary(id)
    if (id === route.params.id) summary.value = result
  } catch {
    if (id === route.params.id) summaryError.value = 'Community updates are unavailable right now.'
  }
}

async function load(id) {
  loading.value = true
  errorMessage.value = ''
  notFound.value = false
  centre.value = null
  stalls.value = []
  stallSearch.value = ''
  cuisine.value = ''
  loadSummary(id) // shown separately, so it doesn't hold up the rest of the page

  try {
    const [centreData, stallData] = await Promise.all([getHawkerCentre(id), getHawkerCentreStalls(id)])
    if (id !== route.params.id) return // the user has moved to another centre
    centre.value = centreData
    stalls.value = stallData
  } catch (error) {
    if (id !== route.params.id) return
    // 400 is an id that isn't a valid MongoDB id, 404 is a valid id with no centre
    notFound.value = error.status === 400 || error.status === 404
    errorMessage.value = notFound.value ? "We couldn't find this hawker centre." : error.message
  } finally {
    if (id === route.params.id) loading.value = false
  }

  await nextTick()
  scrollToLinkedStall()
}

// Scrolls to the stall in the link, e.g. when coming back from a stall's own page
function scrollToLinkedStall() {
  if (!route.hash.startsWith('#stall-')) return
  const element = document.getElementById(route.hash.slice(1))
  if (!element) return
  highlightedStallId.value = route.hash.slice('#stall-'.length)
  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

watch(() => route.params.id, (id) => { if (id) load(id) }, { immediate: true })
</script>

<template>
  <main class="container py-5">
    <RouterLink to="/" class="text-decoration-none small">
      <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>All hawker centres
    </RouterLink>

    <LoadingState v-if="loading" class="mt-3" message="Loading hawker centre..." />

    <template v-else-if="errorMessage">
      <ErrorState class="mt-3" :message="errorMessage" :retryable="!notFound" @retry="load(route.params.id)" />
    </template>

    <template v-else-if="centre">
      <header class="row g-4 align-items-center mt-1 mb-4">
        <div :class="centre.photoUrl ? 'col-lg-7' : 'col-12'">
          <span class="eyebrow">Hawker centre</span>
          <h1 class="display-6 fw-bold mt-1 mb-2">{{ centre.name }}</h1>
          <p class="text-secondary mb-2">
            <i class="bi bi-geo-alt me-1" aria-hidden="true"></i>{{ centre.address
            }}<span v-if="centre.postalCode">, Singapore {{ centre.postalCode }}</span>
          </p>
          <p v-if="centre.foodStallCount" class="text-secondary mb-2">
            <i class="bi bi-shop me-1" aria-hidden="true"></i>{{ centre.foodStallCount }} cooked food stalls (NEA)
          </p>
          <p v-if="centre.description" class="mb-3">{{ centre.description }}</p>
          <div class="d-flex flex-wrap gap-2">
            <FavouriteButton target-type="HawkerCentre" :target-id="centre._id" :name="centre.name" with-label />
            <a v-if="directionsUrl" :href="directionsUrl" target="_blank" rel="noopener" class="btn btn-sm btn-outline-danger">
              <i class="bi bi-sign-turn-right me-1" aria-hidden="true"></i>Directions
            </a>
          </div>
        </div>
        <div v-if="centre.photoUrl" class="col-lg-5">
          <img :src="centre.photoUrl" :alt="`Photo of ${centre.name}`" class="centre-photo rounded shadow-sm" />
          <p class="small text-secondary mt-1 mb-0">Photo: NEA</p>
        </div>
      </header>

      <div class="row g-4">
        <div class="col-lg-6">
          <OfficialClosureAlert :closures="centre.closures" />
        </div>
        <div class="col-lg-6">
          <CommunityUpdateCard :summary="summary" :error="summaryError" />
        </div>
      </div>

      <section id="stalls" class="mt-5" aria-labelledby="stalls-heading">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h2 id="stalls-heading" class="h3 mb-0">
              Stalls <span class="text-secondary fs-5">({{ stalls.length }})</span>
            </h2>
            <span v-if="stalls.length" class="text-secondary small">
              {{ liveStallCount }} with a live community update
            </span>
          </div>
          <button v-if="!addingStall" type="button" class="btn btn-sm btn-outline-danger" v-on:click="startAddingStall">
            <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add a stall
          </button>
        </div>

        <StallForm v-if="addingStall" class="mb-4" :centre-id="centre._id" v-on:saved="onStallAdded" v-on:cancel="addingStall = false" />
        <p v-if="addedMessage" class="small text-success" role="status">{{ addedMessage }}</p>

        <template v-if="stalls.length">
          <div class="row g-3 mb-4">
            <div class="col-md-6">
              <SearchBar v-model="stallSearch" id="stall-search" label="Search this centre" placeholder="Stall name, cuisine or unit" />
            </div>
            <div v-if="cuisineOptions.length > 1" class="col-md-6 d-flex flex-column justify-content-end">
              <FilterChips v-model="cuisine" :options="cuisineOptions" label="Food options" small />
            </div>
          </div>

          <div v-if="visibleStalls.length" class="row g-3">
            <div
              v-for="stall in visibleStalls"
              :id="`stall-${stall._id}`"
              :key="stall._id"
              class="col-md-6 col-xl-4"
              :class="{ 'stall-highlight': stall._id === highlightedStallId }"
            >
              <StallCard :stall="stall" :centre="centre" @reported="(report) => onStallReported(stall._id, report)" @changed="refreshStatuses" />
            </div>
          </div>
          <div v-else class="alert alert-light border">No stalls match your search.</div>
        </template>

        <div v-else-if="!addingStall" class="alert alert-light border mb-0">
          No stalls have been added for this centre yet. Know a stall here?
          <button type="button" class="btn btn-link p-0 align-baseline" v-on:click="startAddingStall">Add it</button>
          so others can see its queue and reviews.
        </div>
      </section>

      <CommentSection class="mt-5" :centre-id="centre._id" />
    </template>
  </main>
</template>

<style scoped>
.centre-photo {
  display: block;
  width: 100%;
  max-height: 280px;
  object-fit: cover;
}

.stall-highlight :deep(.card) {
  outline: 3px solid var(--hw-orange);
  outline-offset: 2px;
}
</style>
