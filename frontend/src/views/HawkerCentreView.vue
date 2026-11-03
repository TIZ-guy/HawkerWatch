<script setup>
// Centre detail page: banner photo, four figures, official closures, then tabs for the stalls (a table),
// recent reviews and comments, with a side rail holding the map, a report form and the reminder settings.
// A link ending in #stall-<id> (e.g. back from a stall page) scrolls to that stall;
// #reviews or #comments opens that tab.
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import OfficialClosureAlert from '../components/OfficialClosureAlert.vue'
import CentrePhoto from '../components/CentrePhoto.vue'
import StallTable from '../components/StallTable.vue'
import StarRating from '../components/StarRating.vue'
import ReportStatusForm from '../components/ReportStatusForm.vue'
import FavouriteAlertEditor from '../components/FavouriteAlertEditor.vue'
import SearchBar from '../components/SearchBar.vue'
import FilterChips from '../components/FilterChips.vue'
import LoadingState from '../components/LoadingState.vue'
import ErrorState from '../components/ErrorState.vue'
import FavouriteButton from '../components/FavouriteButton.vue'
import CommentSection from '../components/CommentSection.vue'
import StallForm from '../components/StallForm.vue'
import { useAuthStore } from '../stores/useAuthStore.js'
import { useFavouriteStore } from '../stores/useFavouriteStore.js'
import { getCentreReviews, photoUrl } from '../services/reviewService.js'
import { timeAgo } from '../utils/time.js'
import { cuisineOptions as allCuisineOptions } from '../utils/cuisines.js'

// The map library is big, so it is only downloaded when a centre page with a map is opened
const CentreMap = defineAsyncComponent(() => import('../components/CentreMap.vue'))
import { getCommunitySummary, getHawkerCentre, getHawkerCentreStalls } from '../services/hawkerService.js'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const favourites = useFavouriteStore()

const MAX_PHOTO_TILES = 8

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

// Stalls / Reviews / Comments tabs
const TABS = [
  { value: 'stalls', label: 'Stalls' },
  { value: 'reviews', label: 'Reviews' },
  { value: 'comments', label: 'Comments' }
]
const activeTab = ref('stalls')

// Recent reviews across the centre's stalls (Reviews tab and the photo strip)
const centreReviews = ref([])
const reviewsLoading = ref(false)
const reviewsError = ref('')

// Rail: report a stall's queue
const reportStallId = ref('')
const reportThanks = ref('')

// "Add a stall" form (no official stall list exists, so diners add them)
const addingStall = ref(false)
const addedMessage = ref('')

// Only the cuisines this centre actually has, in the fixed order of the full list
const cuisineOptions = computed(() => {
  const present = new Set(stalls.value.map((stall) => stall.cuisine).filter(Boolean))
  return allCuisineOptions.filter((option) => present.has(option.value))
})

// The stall list is small, so filtering happens here instead of with another request.
const visibleStalls = computed(() => {
  const term = stallSearch.value.toLowerCase()
  return stalls.value.filter((stall) =>
    (!cuisine.value || stall.cuisine === cuisine.value) &&
    (!term || [stall.name, stall.cuisine, stall.speciality, stall.unitNumber].some((text) => text?.toLowerCase().includes(term)))
  )
})

const liveStallCount = computed(() => stalls.value.filter((stall) => stall.liveReport).length)

// Average star rating over every stall's reviews, weighted by how many reviews each has
const centreRating = computed(() => {
  let total = 0
  let count = 0
  for (const stall of stalls.value) {
    if (stall.rating && stall.rating.count > 0) {
      total += stall.rating.average * stall.rating.count
      count += stall.rating.count
    }
  }
  return count ? { average: Math.round((total / count) * 10) / 10, count } : null
})

// The newest review photos, each linking to its stall's reviews
const photoTiles = computed(() => {
  const tiles = []
  for (const review of centreReviews.value) {
    for (const photoId of review.photos) {
      if (tiles.length < MAX_PHOTO_TILES) tiles.push({ photoId, stallId: review.stall._id, stallName: review.stall.name })
    }
  }
  return tiles
})

const reportStall = computed(() => stalls.value.find((stall) => stall._id === reportStallId.value) || null)

// This centre's favourite, if the user has saved it (for the reminder panel)
const centreFavourite = computed(() => (centre.value ? favourites.find('HawkerCentre', centre.value._id) : null))

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

// Show the new stall in the list straight away, sorted by name like the rest.
// A stall added by a user waits for an admin to approve it, so it isn't shown yet.
function onStallAdded(stall) {
  addingStall.value = false
  if (stall.pendingApproval) {
    addedMessage.value = `Thanks! ${stall.name} has been sent to an admin and will show here once it's approved.`
    return
  }
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

// The rail's report form finished: show the update in the table and thank the user
function onRailReported(report) {
  const stall = reportStall.value
  onStallReported(stall._id, report)
  reportThanks.value = `Thanks! Your update for ${stall.name} is live for the next 60 minutes.`
  reportStallId.value = ''
}

function goToLogin(hash) {
  router.push({ path: '/login', query: { redirect: `${route.path}${hash}` } })
}

async function loadCentreReviews(id) {
  reviewsLoading.value = true
  reviewsError.value = ''
  try {
    const data = await getCentreReviews(id)
    if (id === route.params.id) centreReviews.value = data.reviews
  } catch (error) {
    if (id === route.params.id) reviewsError.value = error.message
  } finally {
    if (id === route.params.id) reviewsLoading.value = false
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
  centreReviews.value = []
  reportStallId.value = ''
  reportThanks.value = ''
  activeTab.value = route.hash === '#reviews' ? 'reviews' : route.hash === '#comments' ? 'comments' : 'stalls'
  loadSummary(id) // shown separately, so it doesn't hold up the rest of the page
  loadCentreReviews(id)
  if (auth.user) favourites.load() // for the reminder panel

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
  <main class="container py-4">
    <nav aria-label="Breadcrumb" class="small text-secondary mb-3">
      <RouterLink to="/" class="text-reset">Discover</RouterLink>
      <span v-if="centre" aria-hidden="true"> › </span>
      <span v-if="centre" aria-current="page">{{ centre.name }}</span>
    </nav>

    <LoadingState v-if="loading" message="Loading hawker centre..." />

    <template v-else-if="errorMessage">
      <ErrorState :message="errorMessage" :retryable="!notFound" @retry="load(route.params.id)" />
    </template>

    <template v-else-if="centre">
      <CentrePhoto :centre="centre" size="banner" />

      <header class="d-flex flex-wrap justify-content-between align-items-start gap-3 mt-3 mb-3" data-testid="centre-header">
        <div class="min-w-0">
          <h1 class="display-6 mb-2" data-testid="centre-name">{{ centre.name }}</h1>
          <div class="d-flex flex-wrap gap-3 small text-secondary">
            <span>{{ centre.address }}<span v-if="centre.postalCode">, Singapore {{ centre.postalCode }}</span></span>
            <a v-if="directionsUrl" :href="directionsUrl" target="_blank" rel="noopener" class="text-reset">
              <i class="bi bi-sign-turn-right me-1" aria-hidden="true"></i>Directions
            </a>
          </div>
          <p v-if="centre.description" class="small text-secondary mt-2 mb-0">{{ centre.description }}</p>
        </div>
        <FavouriteButton target-type="HawkerCentre" :target-id="centre._id" :name="centre.name" with-label />
      </header>

      <!-- Figures -->
      <dl class="hw-surface d-flex flex-wrap m-0 overflow-hidden hw-stats">
        <div class="p-3 flex-fill min-w-0">
          <dt class="small text-uppercase text-secondary">Stalls</dt>
          <dd class="h5 hw-mono mb-0">{{ centre.foodStallCount ?? '–' }}</dd>
        </div>
        <div class="p-3 flex-fill min-w-0">
          <dt class="small text-uppercase text-secondary">Listed here</dt>
          <!-- stalls.length changes straight away when someone adds a stall on this page -->
          <dd class="h5 hw-mono mb-0" data-testid="centre-listed-count">{{ stalls.length }}</dd>
        </div>
        <div class="p-3 flex-fill min-w-0">
          <dt class="small text-uppercase text-secondary">Live reports</dt>
          <dd class="h5 hw-mono mb-0">{{ summary ? summary.stallsReported : liveStallCount }}</dd>
        </div>
        <div class="p-3 flex-fill min-w-0">
          <dt class="small text-uppercase text-secondary">Rating</dt>
          <dd class="h5 hw-mono mb-0">
            <template v-if="centreRating">{{ centreRating.average.toFixed(1) }} <span class="small text-secondary fw-normal">({{ centreRating.count }})</span></template>
            <template v-else>–</template>
          </dd>
        </div>
      </dl>

      <OfficialClosureAlert class="mt-3" data-testid="centre-closure-alert" :closures="centre.closures" />

      <div class="row g-4 mt-1">
        <!-- Main column: tabs -->
        <div class="col-lg-8 min-w-0">
          <ul class="nav nav-underline mb-3" role="tablist">
            <li v-for="tab in TABS" :key="tab.value" class="nav-item" role="presentation">
              <button
                type="button"
                class="nav-link"
                :class="{ active: activeTab === tab.value }"
                role="tab"
                :aria-selected="activeTab === tab.value"
                v-on:click="activeTab = tab.value"
              >
                {{ tab.label }}
                <span v-if="tab.value === 'stalls'" class="hw-mono small text-secondary">{{ stalls.length }}</span>
              </button>
            </li>
          </ul>

          <!-- Stalls -->
          <section v-show="activeTab === 'stalls'" id="stalls" aria-label="Stalls">
            <div class="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
              <span class="small text-secondary">
                <span class="hw-mono">{{ liveStallCount }}</span> with a live community update
              </span>
              <button v-if="!addingStall" type="button" class="btn btn-sm btn-outline-dark" data-testid="add-stall-button" v-on:click="startAddingStall">
                <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add a stall
              </button>
            </div>

            <StallForm v-if="addingStall" class="mb-3" :centre-id="centre._id" v-on:saved="onStallAdded" v-on:cancel="addingStall = false" />
            <p v-if="addedMessage" class="small text-secondary" role="status" data-testid="stall-added-message">{{ addedMessage }}</p>

            <template v-if="stalls.length">
              <div class="d-grid gap-2 mb-3">
                <SearchBar v-model="stallSearch" id="stall-search" label="Search this centre" placeholder="Stall name, dish or unit" />
                <FilterChips v-if="cuisineOptions.length > 1" v-model="cuisine" :options="cuisineOptions" label="Cuisine" small />
              </div>

              <StallTable v-if="visibleStalls.length" :stalls="visibleStalls" :highlighted-id="highlightedStallId" />
              <div v-else class="hw-surface p-3">No stalls match your search.</div>
            </template>

            <div v-else-if="!addingStall" class="hw-surface p-3">
              No stalls have been added for this centre yet. Know a stall here?
              <button type="button" class="btn btn-link p-0 align-baseline" v-on:click="startAddingStall">Add it</button>
              so others can see its queue and reviews.
            </div>
          </section>

          <!-- Reviews: the newest across every stall here; writing one happens on the stall's page -->
          <section v-show="activeTab === 'reviews'" aria-label="Recent reviews">
            <LoadingState v-if="reviewsLoading" message="Loading reviews..." />
            <ErrorState v-else-if="reviewsError" :message="reviewsError" retryable @retry="loadCentreReviews(centre._id)" />
            <div v-else-if="centreReviews.length" class="d-grid gap-2">
              <article v-for="review in centreReviews" :key="review._id" class="hw-surface p-3">
                <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2">
                  <RouterLink :to="`/stalls/${review.stall._id}#reviews`" class="fw-semibold text-reset">{{ review.stall.name }}</RouterLink>
                  <span class="small text-secondary">
                    {{ review.user ? review.user.name : 'Deleted user' }} · <span class="hw-mono">{{ timeAgo(review.createdAt) }}</span>
                  </span>
                </div>
                <StarRating :rating="review.rating" :show-number="false" />
                <p v-if="review.text" class="small mt-1 mb-0">{{ review.text }}</p>
              </article>
            </div>
            <div v-else class="hw-surface p-3 small text-secondary">
              No reviews yet. Open a stall to rate it.
            </div>
          </section>

          <!-- Comments about the centre -->
          <CommentSection v-if="activeTab === 'comments'" :centre-id="centre._id" />

          <!-- The newest review photos -->
          <section v-if="photoTiles.length" class="mt-4" aria-labelledby="photos-heading">
            <h2 id="photos-heading" class="hw-label mb-2">Recent photos</h2>
            <div class="d-flex flex-wrap gap-2">
              <RouterLink
                v-for="tile in photoTiles"
                :key="tile.photoId"
                :to="`/stalls/${tile.stallId}#reviews`"
                :title="`Photo from a review of ${tile.stallName}`"
              >
                <img :src="photoUrl(tile.photoId)" :alt="`Photo from a review of ${tile.stallName}`" class="hw-photo hw-photo-tile" loading="lazy" />
              </RouterLink>
            </div>
          </section>
        </div>

        <!-- Rail: map, report a queue, reminder -->
        <aside class="col-lg-4">
          <div class="rail d-grid gap-3">
            <section v-if="centre.location?.coordinates" class="hw-surface overflow-hidden" aria-label="Map" data-testid="centre-map">
              <CentreMap :key="centre._id" :centre="centre" />
            </section>

            <section class="hw-surface p-3" aria-labelledby="report-heading">
              <h2 id="report-heading" class="h6">Report a queue</h2>
              <template v-if="!auth.user">
                <p class="small text-secondary mb-2">Tell others how long the queue is right now.</p>
                <button type="button" class="btn btn-sm btn-outline-dark" v-on:click="goToLogin('#stalls')">Log in to report</button>
              </template>
              <template v-else-if="stalls.length">
                <label for="report-stall" class="form-label small text-secondary">Which stall?</label>
                <select id="report-stall" data-testid="report-stall-select" v-model="reportStallId" class="form-select form-select-sm">
                  <option value="">Choose a stall</option>
                  <option v-for="stall in stalls" :key="stall._id" :value="stall._id">
                    {{ stall.name }}{{ stall.unitNumber ? ` (#${stall.unitNumber})` : '' }}
                  </option>
                </select>
                <ReportStatusForm
                  v-if="reportStall"
                  :key="reportStall._id"
                  :stall="reportStall"
                  :centre="centre"
                  v-on:submitted="onRailReported"
                  v-on:cancel="reportStallId = ''"
                />
                <p v-if="reportThanks" class="small text-secondary mt-2 mb-0" role="status" data-testid="report-thanks">{{ reportThanks }}</p>
              </template>
              <p v-else class="small text-secondary mb-0">Add a stall first to report its queue.</p>
            </section>

            <section class="hw-surface p-3" aria-labelledby="reminder-heading" data-testid="centre-reminder">
              <h2 id="reminder-heading" class="h6">Reminder</h2>
              <FavouriteAlertEditor v-if="centreFavourite" :favourite="centreFavourite" />
              <template v-else>
                <p class="small text-secondary mb-2">Save this centre to set a reminder for the days you usually go.</p>
                <FavouriteButton target-type="HawkerCentre" :target-id="centre._id" :name="centre.name" with-label />
              </template>
            </section>
          </div>
        </aside>
      </div>
    </template>
  </main>
</template>

<style scoped>
.hw-stats > div + div { border-left: 1px solid var(--line); }

.nav-underline .nav-link {
  color: var(--dim);
}

.nav-underline .nav-link.active {
  color: var(--ink);
  font-weight: 600;
}

/* The rail stays in view while the stall table scrolls, on wide screens */
@media (min-width: 992px) {
  .rail {
    position: sticky;
    top: 5rem;
  }
}
</style>
