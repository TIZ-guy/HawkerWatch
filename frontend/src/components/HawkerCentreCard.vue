<script setup>
// Centre summary for lists: NEA photo, name, address, stall counts, up to 3 cuisine tags, the newest live
// community status (or the official closure badge) and optional distance. The whole card links to the centre page.
// Extra content from the parent (e.g. the reminder summary on the Favourites page) goes in the slot.
import { computed } from 'vue'
import ClosureBadge from './ClosureBadge.vue'
import FavouriteButton from './FavouriteButton.vue'
import StatusBadge from './StatusBadge.vue'
import { formatDistance } from '../services/locationService.js'
import { currentClosure } from '../utils/closures.js'
import { timeAgo } from '../utils/time.js'

const MAX_TAGS = 3

const props = defineProps({
  centre: { type: Object, required: true },
  distanceKm: { type: Number, default: null }
})

const closedToday = computed(() => Boolean(currentClosure(props.centre.closures)))

// cuisines and live come from the centre list API; the Favourites page's centres don't have them
const cuisines = computed(() => props.centre.cuisines || [])
const shownCuisines = computed(() => cuisines.value.slice(0, MAX_TAGS))
const live = computed(() => props.centre.live || null)
</script>

<template>
  <article class="card border-0 shadow-sm h-100 centre-card overflow-hidden" data-testid="centre-card">
    <img v-if="centre.photoUrl" :src="centre.photoUrl" alt="" class="card-img-top centre-photo" loading="lazy" />
    <div v-else class="card-img-top centre-photo d-flex align-items-center justify-content-center text-secondary fs-3" aria-hidden="true">
      <i class="bi bi-shop"></i>
    </div>
    <div class="card-body p-4 d-flex flex-column">
      <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
        <div class="d-flex flex-wrap gap-2 badges">
          <ClosureBadge v-if="closedToday" :closures="centre.closures" />
          <StatusBadge v-else-if="live" :status="live.latestStatus" />
          <span v-if="distanceKm != null" class="badge text-bg-light border">
            <i class="bi bi-geo-alt me-1" aria-hidden="true"></i>{{ formatDistance(distanceKm) }}
          </span>
        </div>
        <FavouriteButton class="flex-shrink-0 position-relative" target-type="HawkerCentre" :target-id="centre._id" :name="centre.name" />
      </div>
      <h3 class="h5">
        <RouterLink class="stretched-link text-reset text-decoration-none" data-testid="centre-card-link" :to="`/hawker-centres/${centre._id}`">
          {{ centre.name }}
        </RouterLink>
      </h3>
      <p class="text-secondary mb-0">
        {{ centre.address }}<span v-if="centre.postalCode">, Singapore {{ centre.postalCode }}</span>
      </p>
      <!-- stallCount comes from the centre list API (stalls listed in HawkerWatch right now) -->
      <p v-if="centre.stallCount != null" class="small text-secondary mt-2 mb-0">
        <i class="bi bi-shop me-1" aria-hidden="true"></i>
        <span v-if="centre.stallCount > 0">
          {{ centre.stallCount }}<template v-if="centre.foodStallCount"> of {{ centre.foodStallCount }}</template>
          stall{{ (centre.foodStallCount || centre.stallCount) === 1 ? '' : 's' }} listed
        </span>
        <span v-else>No stalls listed yet</span>
      </p>
      <p v-if="live && !closedToday" class="small text-secondary mt-1 mb-0">
        <i class="bi bi-clock me-1" aria-hidden="true"></i>
        {{ timeAgo(live.latestReportAt) }} · {{ live.stallsReported }} stall{{ live.stallsReported === 1 ? '' : 's' }} reported
      </p>
      <p v-else-if="'live' in centre && !closedToday" class="small text-secondary mt-1 mb-0">No live reports</p>
      <div v-if="shownCuisines.length" class="d-flex flex-wrap gap-1 mt-3">
        <span v-for="cuisine in shownCuisines" :key="cuisine" class="badge text-bg-light border fw-normal">{{ cuisine }}</span>
        <span v-if="cuisines.length > MAX_TAGS" class="badge text-bg-light border fw-normal">+{{ cuisines.length - MAX_TAGS }}</span>
      </div>
      <span class="mt-auto pt-3 small fw-semibold text-danger">
        View stalls and updates <i class="bi bi-arrow-right" aria-hidden="true"></i>
      </span>
      <!-- Extra content from the parent, e.g. the alert summary on the Favourites page -->
      <slot />
    </div>
  </article>
</template>

<style scoped>
/* Decorative (alt=""): the name below says which centre it is */
.centre-photo {
  height: 140px;
  object-fit: cover;
  background: #eee;
}

/* On narrow cards a long badge like "Closed today · Repair works" wraps instead of pushing the heart out */
.badges {
  min-width: 0;
}

.badges :deep(.badge) {
  white-space: normal;
  text-align: left;
}

.centre-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.centre-card:hover,
.centre-card:focus-within {
  transform: translateY(-2px);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.1) !important;
}
</style>
