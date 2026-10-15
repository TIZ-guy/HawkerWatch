<script setup>
// Centre summary for lists: name, address, official closure badge and optional distance.
import ClosureBadge from './ClosureBadge.vue'
import FavouriteButton from './FavouriteButton.vue'
import { formatDistance } from '../services/locationService.js'

defineProps({
  centre: { type: Object, required: true },
  distanceKm: { type: Number, default: null }
})
</script>

<template>
  <article class="card border-0 shadow-sm h-100 centre-card">
    <div class="card-body p-4 d-flex flex-column">
      <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
        <div class="d-flex flex-wrap gap-2">
          <ClosureBadge :closures="centre.closures" />
          <span v-if="distanceKm != null" class="badge text-bg-light border">
            <i class="bi bi-geo-alt me-1" aria-hidden="true"></i>{{ formatDistance(distanceKm) }}
          </span>
        </div>
        <FavouriteButton target-type="HawkerCentre" :target-id="centre._id" :name="centre.name" />
      </div>
      <h3 class="h5">
        <RouterLink class="stretched-link text-reset text-decoration-none" :to="`/hawker-centres/${centre._id}`">
          {{ centre.name }}
        </RouterLink>
      </h3>
      <p class="text-secondary mb-0">
        {{ centre.address }}<span v-if="centre.postalCode">, Singapore {{ centre.postalCode }}</span>
      </p>
      <span class="mt-auto pt-3 small fw-semibold text-danger">
        View stalls and updates <i class="bi bi-arrow-right" aria-hidden="true"></i>
      </span>
      <!-- Extra content from the parent, e.g. the alert summary on the Favourites page -->
      <slot />
    </div>
  </article>
</template>

<style scoped>
.centre-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.centre-card:hover,
.centre-card:focus-within {
  transform: translateY(-2px);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.1) !important;
}
</style>
