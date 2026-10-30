<script setup>
// Stall page (/stalls/:id): the stall's details, its centre's official closures,
// its live community status (with Report status) and its reviews.
// The person who added the stall, or an admin, can edit its details; admins can remove it.
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StallCard from '../components/StallCard.vue'
import StarRating from '../components/StarRating.vue'
import ReviewSection from '../components/ReviewSection.vue'
import OfficialClosureAlert from '../components/OfficialClosureAlert.vue'
import FavouriteButton from '../components/FavouriteButton.vue'
import LoadingState from '../components/LoadingState.vue'
import ErrorState from '../components/ErrorState.vue'
import StallForm from '../components/StallForm.vue'
import { getStall, removeStall } from '../services/hawkerService.js'
import { useAuthStore } from '../stores/useAuthStore.js'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// From /stalls/:id: the stall with liveReport, rating { average, count },
// and hawkerCentre { _id, name, address, postalCode, location, closures }
const stall = ref(null)
const loading = ref(true)
const errorMessage = ref('')
const notFound = ref(false)

const editing = ref(false)
const confirmingRemove = ref(false)
const removing = ref(false)
const removeError = ref('')

const isAdmin = computed(() => auth.isAdmin)
// The person who added the stall, or an admin, can edit it
const canEdit = computed(() => {
  const user = auth.user
  if (!user || !stall.value) return false
  return user.role === 'admin' || String(stall.value.addedBy) === String(user._id)
})

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

// Keep the centre, live report and rating, and take the new name, cuisine, dish and unit number
function onStallUpdated(updated) {
  stall.value.name = updated.name
  stall.value.cuisine = updated.cuisine
  stall.value.speciality = updated.speciality
  stall.value.unitNumber = updated.unitNumber
  editing.value = false
}

async function confirmRemove() {
  removing.value = true
  removeError.value = ''
  try {
    await removeStall(stall.value._id)
    router.push(`/hawker-centres/${stall.value.hawkerCentre._id}`)
  } catch (error) {
    removeError.value = error.message
  } finally {
    removing.value = false
  }
}

onMounted(loadStall)

// Going from one stall page straight to another reuses this page, so load the new stall
watch(() => route.params.id, (id) => {
  if (id) loadStall()
})
</script>

<template>
  <main class="container py-4">
    <nav aria-label="Breadcrumb" class="small mb-3">
      <RouterLink
        v-if="stall && stall.hawkerCentre"
        :to="`/hawker-centres/${stall.hawkerCentre._id}#stall-${stall._id}`"
        class="text-secondary text-decoration-none"
      >
        <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>{{ stall.hawkerCentre.name }}
      </RouterLink>
      <RouterLink v-else to="/" class="text-secondary text-decoration-none">
        <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>All hawker centres
      </RouterLink>
    </nav>

    <LoadingState v-if="loading" class="mt-3" message="Loading stall..." />

    <ErrorState v-else-if="errorMessage" class="mt-3" :message="errorMessage" :retryable="!notFound" v-on:retry="loadStall" />

    <template v-else-if="stall">
      <header class="mb-4">
        <h1 class="display-6 mb-2">{{ stall.name }}</h1>
        <!-- One meta line: dish, cuisine, unit, centre -->
        <p class="text-secondary mb-2">
          <span v-if="stall.speciality"><i class="bi bi-egg-fried me-1" aria-hidden="true"></i>{{ stall.speciality }}</span>
          <span v-if="stall.speciality && stall.cuisine"> · </span>
          <span v-if="stall.cuisine"><i v-if="!stall.speciality" class="bi bi-egg-fried me-1" aria-hidden="true"></i>{{ stall.cuisine }}</span>
          <span v-if="(stall.speciality || stall.cuisine) && stall.unitNumber"> · </span>
          <span v-if="stall.unitNumber">Unit <span class="hw-mono">#{{ stall.unitNumber }}</span></span>
          <template v-if="stall.hawkerCentre">
            <span> · </span>
            <RouterLink :to="`/hawker-centres/${stall.hawkerCentre._id}`" class="text-reset">{{ stall.hawkerCentre.name }}</RouterLink>
          </template>
        </p>
        <p class="mb-3">
          <StarRating v-if="stall.rating && stall.rating.count > 0" :rating="stall.rating.average" :count="stall.rating.count" />
          <span v-else class="text-secondary">No reviews yet</span>
        </p>
        <div class="d-flex flex-wrap gap-2">
          <FavouriteButton target-type="Stall" :target-id="stall._id" :name="stall.name" with-label />
          <a href="#reviews" class="btn btn-sm hw-btn-primary">
            <i class="bi bi-star me-1" aria-hidden="true"></i>Write a review
          </a>
          <button v-if="canEdit && !editing" type="button" class="btn btn-sm btn-outline-secondary" v-on:click="editing = true">
            <i class="bi bi-pencil me-1" aria-hidden="true"></i>Edit details
          </button>
          <button v-if="isAdmin && !confirmingRemove" type="button" class="btn btn-sm btn-outline-secondary" v-on:click="confirmingRemove = true">
            <i class="bi bi-trash me-1" aria-hidden="true"></i>Remove stall
          </button>
        </div>

        <div v-if="confirmingRemove" class="alert alert-warning d-flex flex-wrap align-items-center gap-2 mt-3 mb-0" role="alert">
          <span>Remove {{ stall.name }}? It will be hidden everywhere; its reviews are kept.</span>
          <button type="button" class="btn btn-sm btn-outline-dark" :disabled="removing" v-on:click="confirmRemove">
            {{ removing ? 'Removing...' : 'Remove' }}
          </button>
          <button type="button" class="btn btn-sm btn-link text-secondary" v-on:click="confirmingRemove = false">Cancel</button>
          <span v-if="removeError" class="w-100 small text-brick">{{ removeError }}</span>
        </div>
      </header>

      <StallForm v-if="editing" class="mb-4" :stall="stall" v-on:saved="onStallUpdated" v-on:cancel="editing = false" />

      <div class="row g-4">
        <div class="col-lg-6">
          <OfficialClosureAlert :closures="stall.hawkerCentre ? stall.hawkerCentre.closures : []" />
        </div>
        <div class="col-lg-6">
          <section aria-labelledby="status-heading">
            <h2 id="status-heading" class="h6 mb-2">Live status</h2>
            <StallCard :stall="stall" :centre="stall.hawkerCentre" status-only v-on:reported="onReported" v-on:changed="refreshStatus" />
          </section>
        </div>
      </div>

      <ReviewSection class="mt-5" :key="stall._id" :stall-id="stall._id" :stall-name="stall.name" v-on:changed="onReviewsChanged" />
    </template>
  </main>
</template>
