<script setup>
// The logged-in user's saved centres and stalls (the router only lets logged-in users in).
import { computed, onMounted, ref } from 'vue'
import HawkerCentreCard from '../components/HawkerCentreCard.vue'
import StallCard from '../components/StallCard.vue'
import LoadingState from '../components/LoadingState.vue'
import ErrorState from '../components/ErrorState.vue'
import { useFavouriteStore } from '../stores/useFavouriteStore.js'
import { getStall } from '../services/hawkerService.js'
import { formatAlert } from '../utils/alerts.js'

const favourites = useFavouriteStore()
const loading = ref(true)
const removeError = ref('')
// stallId -> stall from /stalls/:id, which adds the live report and the centre's name
const stallDetails = ref({})

const centreFavourites = computed(() => favourites.state.items.filter((item) => item.targetType === 'HawkerCentre'))
const stallFavourites = computed(() => favourites.state.items.filter((item) => item.targetType === 'Stall'))
// A favourite whose stall or centre has been deleted comes back with target: null
const missing = computed(() => favourites.state.items.filter((item) => !item.target))

async function load() {
  loading.value = true
  // Refresh so every favourite has its stall or centre filled in, including ones just added
  await favourites.load({ refresh: true })

  const stalls = stallFavourites.value.filter((item) => item.target?._id)
  const details = await Promise.all(stalls.map((item) => getStall(item.target._id).catch(() => null)))
  stallDetails.value = Object.fromEntries(details.filter(Boolean).map((stall) => [stall._id, stall]))
  loading.value = false
}

async function removeMissing(favourite) {
  removeError.value = ''
  try {
    await favourites.remove(favourite._id)
  } catch (error) {
    removeError.value = error.message
  }
}

onMounted(load)
</script>

<template>
  <main class="container py-5">
    <span class="eyebrow">Saved for later</span>
    <h1 class="display-6 fw-bold mt-1 mb-2">Your favourites</h1>
    <p class="text-secondary mb-4">
      Centres and stalls you've saved, with their latest closures and community updates.
      Set reminder times in <RouterLink to="/profile#alerts">your profile</RouterLink>.
    </p>

    <LoadingState v-if="loading" message="Loading your favourites..." />
    <ErrorState v-else-if="favourites.state.error" :message="favourites.state.error" retryable @retry="load" />

    <div v-else-if="!favourites.state.items.length" class="card border-0 shadow-sm">
      <div class="card-body p-4">
        <h2 class="h5">No favourites yet</h2>
        <p class="text-secondary">
          Select the <i class="bi bi-heart" aria-label="heart"></i> on any hawker centre or stall to save it here.
        </p>
        <RouterLink to="/" class="btn btn-danger">Discover hawker centres</RouterLink>
      </div>
    </div>

    <template v-else>
      <section v-if="centreFavourites.some((item) => item.target)" class="mb-5" aria-labelledby="fav-centres">
        <h2 id="fav-centres" class="h4 mb-3">Hawker centres</h2>
        <div class="row g-4">
          <template v-for="favourite in centreFavourites" :key="favourite._id">
            <div v-if="favourite.target" class="col-md-6 col-xl-4">
              <HawkerCentreCard :centre="favourite.target">
                <p class="small text-secondary border-top pt-3 mt-3 mb-0 position-relative z-2">
                  <i class="bi bi-bell me-1" aria-hidden="true"></i>{{ formatAlert(favourite.alert) || 'No reminder set' }}
                  · <RouterLink to="/profile#alerts">Edit</RouterLink>
                </p>
              </HawkerCentreCard>
            </div>
          </template>
        </div>
      </section>

      <section v-if="stallFavourites.some((item) => item.target)" class="mb-5" aria-labelledby="fav-stalls">
        <h2 id="fav-stalls" class="h4 mb-3">Stalls</h2>
        <div class="row g-3">
          <template v-for="favourite in stallFavourites" :key="favourite._id">
            <div v-if="favourite.target" class="col-md-6 col-xl-4">
              <StallCard :stall="stallDetails[favourite.target._id] || favourite.target" show-centre>
                <p class="small text-secondary border-top pt-2 mt-3 mb-0">
                  <i class="bi bi-bell me-1" aria-hidden="true"></i>{{ formatAlert(favourite.alert) || 'No reminder set' }}
                  · <RouterLink to="/profile#alerts">Edit</RouterLink>
                </p>
              </StallCard>
            </div>
          </template>
        </div>
      </section>

      <section v-if="missing.length" aria-labelledby="fav-missing">
        <h2 id="fav-missing" class="h4 mb-3">No longer listed</h2>
        <ErrorState v-if="removeError" :message="removeError" />
        <ul class="list-group">
          <li v-for="favourite in missing" :key="favourite._id" class="list-group-item d-flex justify-content-between align-items-center">
            <span class="text-secondary">
              A {{ favourite.targetType === 'Stall' ? 'stall' : 'hawker centre' }} you saved has been removed from HawkerWatch.
            </span>
            <button type="button" class="btn btn-sm btn-outline-secondary" @click="removeMissing(favourite)">Remove</button>
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>
