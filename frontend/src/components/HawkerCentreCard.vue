<script setup>
// One hawker centre as a full-width list row: NEA photo, name, address, distance, stall counts,
// up to 3 cuisine tags, and the newest live community status (or "Closed today" from NEA).
// The whole row links to the centre page. Extra content from the parent (e.g. the reminder summary
// on the Saved page) goes in the slot, under the row.
import { computed } from 'vue'
import CentrePhoto from './CentrePhoto.vue'
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

// cuisines and live come from the centre list API; the Saved page's centres don't have them
const cuisines = computed(() => props.centre.cuisines || [])
const shownCuisines = computed(() => cuisines.value.slice(0, MAX_TAGS))
const live = computed(() => props.centre.live || null)
</script>

<template>
  <article class="hw-surface hw-surface-hover p-3 position-relative d-grid gap-3 centre-row">
    <CentrePhoto :centre="centre" />
    <div class="min-w-0 d-flex flex-column">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div class="min-w-0">
          <h3 class="h6 mb-1">
            <RouterLink class="stretched-link text-reset text-decoration-none" :to="`/hawker-centres/${centre._id}`">
              {{ centre.name }}
            </RouterLink>
          </h3>
          <p class="small text-secondary mb-2">
            {{ centre.address }}<span v-if="centre.postalCode">, Singapore {{ centre.postalCode }}</span>
            <span v-if="distanceKm != null"> · <span class="hw-mono">{{ formatDistance(distanceKm) }}</span></span>
            <span v-if="centre.stallCount != null"> · <span class="hw-mono">{{ centre.stallCount }}</span> listed</span>
            <span v-if="centre.foodStallCount"> of <span class="hw-mono">{{ centre.foodStallCount }}</span> stalls</span>
          </p>
        </div>
        <FavouriteButton class="flex-shrink-0 position-relative" target-type="HawkerCentre" :target-id="centre._id" :name="centre.name" />
      </div>

      <div v-if="shownCuisines.length" class="d-flex flex-wrap gap-1 mb-2">
        <span v-for="cuisine in shownCuisines" :key="cuisine" class="hw-tag">{{ cuisine }}</span>
        <span v-if="cuisines.length > MAX_TAGS" class="hw-tag">+{{ cuisines.length - MAX_TAGS }}</span>
      </div>

      <div class="mt-auto d-flex flex-wrap align-items-center gap-2 small">
        <ClosureBadge v-if="closedToday" :closures="centre.closures" />
        <template v-else-if="live">
          <StatusBadge :status="live.latestStatus" />
          <span class="text-secondary">
            <span class="hw-mono">{{ timeAgo(live.latestReportAt) }}</span>
            · {{ live.stallsReported }} stall{{ live.stallsReported === 1 ? '' : 's' }} reported
          </span>
        </template>
        <span v-else-if="'live' in centre" class="text-secondary">No live reports</span>
      </div>
    </div>
    <div v-if="$slots.default" class="slot-area position-relative">
      <slot />
    </div>
  </article>
</template>

<style scoped>
.centre-row { grid-template-columns: 144px 1fr; }
@media (max-width: 460px) { .centre-row { grid-template-columns: 96px 1fr; } }

/* The parent's extra content spans the whole row */
.slot-area { grid-column: 1 / -1; }
</style>
