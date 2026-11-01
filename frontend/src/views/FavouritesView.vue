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

const centreFavourites = computed(() => favourites.centres)
const stallFavourites = computed(() => favourites.stalls)
// A favourite whose stall or centre has been deleted comes back with target: null
const missing = computed(() => favourites.items.filter((item) => !item.target))

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
  <main class="container py-4">
    <h1 class="display-6 mb-2">Saved</h1>
    <p class="text-secondary mb-4">
      Centres and stalls you've saved, with their latest closures and community updates.
      Set reminder times in <RouterLink to="/profile#alerts">your profile</RouterLink>.
    </p>

    <LoadingState v-if="loading" message="Loading your favourites..." />
    <ErrorState v-else-if="favourites.error" :message="favourites.error" retryable @retry="load" />

    <div v-else-if="!favourites.items.length" class="hw-surface" data-testid="favourites-empty">
      <div class="p-4">
        <h2 class="h5">Nothing saved yet</h2>
        <p class="text-secondary">
          Select the <i class="bi bi-heart" aria-label="heart"></i> on any hawker centre or stall to save it here.
        </p>
        <RouterLink to="/" class="btn hw-btn-primary">Browse centres</RouterLink>
      </div>
    </div>

    <template v-else>
      <section v-if="centreFavourites.some((item) => item.target)" class="mb-5" aria-labelledby="fav-centres">
        <h2 id="fav-centres" class="h5 border-bottom pb-2 mb-3">Hawker centres</h2>
        <div class="d-grid gap-3">
          <template v-for="favourite in centreFavourites" :key="favourite._id">
            <HawkerCentreCard v-if="favourite.target" :centre="favourite.target">
              <p class="small text-secondary border-top pt-2 mb-0 position-relative z-2" data-testid="favourite-reminder">
                <i class="bi bi-bell me-1" aria-hidden="true"></i>{{ formatAlert(favourite.alert) || 'No reminder set' }}
                · <RouterLink to="/profile#alerts">Edit</RouterLink>
              </p>
            </HawkerCentreCard>
          </template>
        </div>
      </section>

      <section v-if="stallFavourites.some((item) => item.target)" class="mb-5" aria-labelledby="fav-stalls">
        <h2 id="fav-stalls" class="h5 border-bottom pb-2 mb-3">Stalls</h2>
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
        <h2 id="fav-missing" class="h5 border-bottom pb-2 mb-3">No longer listed</h2>
        <ErrorState v-if="removeError" :message="removeError" />
        <ul class="list-group">
          <li v-for="favourite in missing" :key="favourite._id" class="list-group-item d-flex justify-content-between align-items-center">
            <span class="text-secondary">
              A {{ favourite.targetType === 'Stall' ? 'stall' : 'hawker centre' }} you saved has been removed from HawkerWatch.
            </span>
            <button type="button" class="btn btn-sm btn-outline-dark" @click="removeMissing(favourite)">Remove</button>
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>
