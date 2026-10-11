<script setup>
// One stall. With showCentre it links to the stall's centre (home search, favourites).
// When the stall data includes liveReport (centre page, favourites) it shows the newest
// live community report and can list recent ones. Stall search results don't include it.
import { computed, ref } from 'vue'
import StatusBadge from './StatusBadge.vue'
import FavouriteButton from './FavouriteButton.vue'
import { getStallReports } from '../services/hawkerService.js'
import { timeAgo, timeUntil } from '../utils/time.js'

const props = defineProps({
  // From /stalls (hawkerCentre populated) or /hawker-centres/:id/stalls (liveReport included)
  stall: { type: Object, required: true },
  showCentre: { type: Boolean, default: false }
})

const hasLiveData = computed(() => 'liveReport' in props.stall)

const reports = ref(null)
const reportsOpen = ref(false)
const reportsLoading = ref(false)
const reportsError = ref('')

async function toggleReports() {
  reportsOpen.value = !reportsOpen.value
  if (!reportsOpen.value || reports.value) return

  reportsLoading.value = true
  reportsError.value = ''
  try {
    reports.value = await getStallReports(props.stall._id)
  } catch (error) {
    reportsError.value = error.message
  } finally {
    reportsLoading.value = false
  }
}
</script>

<template>
  <article class="card border-0 shadow-sm h-100">
    <div class="card-body p-3 p-lg-4">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <h3 class="h6 mb-1">{{ stall.name }}</h3>
          <p class="small text-secondary mb-0">
            <span v-if="stall.cuisine">{{ stall.cuisine }}</span>
            <span v-if="stall.cuisine && stall.unitNumber"> · </span>
            <span v-if="stall.unitNumber">#{{ stall.unitNumber }}</span>
          </p>
        </div>
        <div class="d-flex align-items-center gap-2 flex-shrink-0">
          <StatusBadge v-if="stall.liveReport" :status="stall.liveReport.status" />
          <FavouriteButton target-type="Stall" :target-id="stall._id" :name="stall.name" />
        </div>
      </div>

      <RouterLink
        v-if="showCentre && stall.hawkerCentre?._id"
        class="d-inline-block small mt-2 text-danger"
        :to="`/hawker-centres/${stall.hawkerCentre._id}#stall-${stall._id}`"
      >
        <i class="bi bi-shop me-1" aria-hidden="true"></i>{{ stall.hawkerCentre.name }}
      </RouterLink>

      <template v-if="hasLiveData">
        <p v-if="stall.liveReport" class="small text-secondary mt-2 mb-0">
          <i class="bi bi-people me-1" aria-hidden="true"></i>Community update {{ timeAgo(stall.liveReport.createdAt) }}
          · expires {{ timeUntil(stall.liveReport.expiresAt) }}
        </p>
        <p v-else class="small text-secondary mt-2 mb-0">No live community updates.</p>

        <button
          v-if="stall.liveReport"
          type="button"
          class="btn btn-link btn-sm p-0 mt-1 text-decoration-none"
          :aria-expanded="reportsOpen"
          @click="toggleReports"
        >
          {{ reportsOpen ? 'Hide' : 'Show' }} recent updates
          <i class="bi" :class="reportsOpen ? 'bi-chevron-up' : 'bi-chevron-down'" aria-hidden="true"></i>
        </button>

        <div v-if="reportsOpen" class="mt-2">
          <p v-if="reportsLoading" class="small text-secondary mb-0">Loading updates...</p>
          <p v-else-if="reportsError" class="small text-danger mb-0">{{ reportsError }}</p>
          <ul v-else-if="reports" class="list-unstyled small mb-0">
            <li v-for="report in reports" :key="report._id" class="d-flex align-items-center gap-2 py-1 border-top">
              <StatusBadge :status="report.status" />
              <span class="text-secondary">{{ timeAgo(report.createdAt) }}</span>
            </li>
          </ul>
        </div>
      </template>

      <!-- Extra content from the parent, e.g. the alert summary on the Favourites page -->
      <slot />
    </div>
  </article>
</template>
