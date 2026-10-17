<script setup>
// Stall page (/stalls/:id): the stall's details, its centre's official closures,
// its live community status (with Report status) and its reviews.
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import StallCard from '../components/StallCard.vue'
import StarRating from '../components/StarRating.vue'
import ReviewSection from '../components/ReviewSection.vue'
import OfficialClosureAlert from '../components/OfficialClosureAlert.vue'
import FavouriteButton from '../components/FavouriteButton.vue'
import LoadingState from '../components/LoadingState.vue'
import ErrorState from '../components/ErrorState.vue'
import { getStall } from '../services/hawkerService.js'

const route = useRoute()

// From /stalls/:id: the stall with liveReport, rating { average, count },
// and hawkerCentre { _id, name, address, postalCode, location, closures }
const stall = ref(null)
const loading = ref(true)
const errorMessage = ref('')
const notFound = ref(false)

async function loadStall() {
  const id = route.params.id
  loading.value = true
  errorMessage.value = ''
  notFound.value = false
  try {
    const data = await getStall(id)
    if (id === route.params.id) stall.value = data
  } catch (error) {
    if (id !== route.params.id) return // the user has moved to another stall
    // 400 is an id that isn't a valid MongoDB id, 404 is a valid id with no stall
    notFound.value = error.status === 400 || error.status === 404
    errorMessage.value = notFound.value ? "We couldn't find this stall." : error.message
  } finally {
    if (id === route.params.id) loading.value = false
  }
}

// After someone reports the stall's status, show it as the newest update
function onReported(report) {
  stall.value.liveReport = report
}

// After a flag hides a report, fetch the stall again for its newest live report, without a loading screen
async function refreshStatus() {
  try {
    const data = await getStall(stall.value._id)
    stall.value.liveReport = data.liveReport
  } catch {
    // Keep showing the current status; the next page load will catch up.
  }
}

// After a review is added, edited or deleted, update the rating in the header
function onReviewsChanged(rating) {
  stall.value.rating = rating
}

onMounted(loadStall)

// Going from one stall page straight to another reuses this page, so load the new stall
watch(() => route.params.id, (id) => {
  if (id) loadStall()
})
</script>

<template>
  <main class="container py-5">
    <RouterLink v-if="stall && stall.hawkerCentre" :to="`/hawker-centres/${stall.hawkerCentre._id}#stall-${stall._id}`" class="text-decoration-none small">
      <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>{{ stall.hawkerCentre.name }}
    </RouterLink>
    <RouterLink v-else to="/" class="text-decoration-none small">
      <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>All hawker centres
    </RouterLink>

    <LoadingState v-if="loading" class="mt-3" message="Loading stall..." />

    <ErrorState v-else-if="errorMessage" class="mt-3" :message="errorMessage" :retryable="!notFound" v-on:retry="loadStall" />

    <template v-else-if="stall">
      <header class="mt-3 mb-4">
        <span class="eyebrow">Stall</span>
        <h1 class="display-6 fw-bold mt-1 mb-2">{{ stall.name }}</h1>
        <p class="text-secondary mb-2">
          <span v-if="stall.cuisine"><i class="bi bi-egg-fried me-1" aria-hidden="true"></i>{{ stall.cuisine }}</span>
          <span v-if="stall.cuisine && stall.unitNumber"> · </span>
          <span v-if="stall.unitNumber">Unit #{{ stall.unitNumber }}</span>
        </p>
        <p v-if="stall.hawkerCentre" class="text-secondary mb-2">
          <i class="bi bi-shop me-1" aria-hidden="true"></i>
          <RouterLink :to="`/hawker-centres/${stall.hawkerCentre._id}`" class="text-danger">{{ stall.hawkerCentre.name }}</RouterLink>,
          {{ stall.hawkerCentre.address }}
        </p>
        <p class="mb-3">
          <StarRating v-if="stall.rating && stall.rating.count > 0" :rating="stall.rating.average" :count="stall.rating.count" />
          <span v-else class="text-secondary">No reviews yet</span>
        </p>
        <div class="d-flex flex-wrap gap-2">
          <FavouriteButton target-type="Stall" :target-id="stall._id" :name="stall.name" with-label />
          <a href="#reviews" class="btn btn-sm btn-outline-danger">
            <i class="bi bi-star me-1" aria-hidden="true"></i>Write a review
          </a>
        </div>
      </header>

      <div class="row g-4">
        <div class="col-lg-6">
          <OfficialClosureAlert :closures="stall.hawkerCentre ? stall.hawkerCentre.closures : []" />
        </div>
        <div class="col-lg-6">
          <section aria-labelledby="status-heading">
            <h2 id="status-heading" class="h5 mb-3">Live status</h2>
            <StallCard :stall="stall" :centre="stall.hawkerCentre" status-only v-on:reported="onReported" v-on:changed="refreshStatus" />
          </section>
        </div>
      </div>

      <ReviewSection class="mt-5" :key="stall._id" :stall-id="stall._id" :stall-name="stall.name" v-on:changed="onReviewsChanged" />
    </template>
  </main>
</template>
