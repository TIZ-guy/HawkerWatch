<script setup>
// The stalls of one centre as a table: unit, stall (with cuisine and rating), dish, queue status
// and when it was reported. The stall name links to the stall's page; the rest of the row doesn't.
// Each row keeps id="stall-<id>", so a link back from a stall page can scroll to it.
// Usage: <StallTable :stalls="stalls" :highlighted-id="id" />
import StarRating from './StarRating.vue'
import StatusBadge from './StatusBadge.vue'
import { timeAgo } from '../utils/time.js'

defineProps({
  stalls: { type: Array, required: true },
  // The stall the page scrolled to (from a #stall-<id> link), shown with a soft background
  highlightedId: { type: String, default: '' }
})
</script>

<template>
  <div class="table-responsive">
    <table class="table align-middle mb-0 stall-table">
      <thead>
        <tr>
          <th scope="col" class="small text-uppercase text-secondary fw-semibold">Unit</th>
          <th scope="col" class="small text-uppercase text-secondary fw-semibold">Stall</th>
          <th scope="col" class="small text-uppercase text-secondary fw-semibold">Dish</th>
          <th scope="col" class="small text-uppercase text-secondary fw-semibold">Queue</th>
          <th scope="col" class="small text-uppercase text-secondary fw-semibold">Reported</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="stall in stalls"
          :id="`stall-${stall._id}`"
          :key="stall._id"
          data-testid="stall-row"
          :class="{ 'row-highlight': stall._id === highlightedId }"
        >
          <td class="hw-mono small text-nowrap">{{ stall.unitNumber ? `#${stall.unitNumber}` : '–' }}</td>
          <td class="min-w-0">
            <RouterLink :to="`/stalls/${stall._id}`" class="text-reset text-decoration-none fw-semibold">{{ stall.name }}</RouterLink>
            <div class="small text-secondary d-flex flex-wrap align-items-center gap-2">
              <span v-if="stall.cuisine">{{ stall.cuisine }}</span>
              <StarRating
                v-if="stall.rating && stall.rating.count > 0"
                :rating="stall.rating.average"
                :count="stall.rating.count"
              />
            </div>
          </td>
          <td class="small">{{ stall.speciality || '' }}</td>
          <td>
            <StatusBadge v-if="stall.liveReport" :status="stall.liveReport.status" />
            <span v-else class="small text-secondary text-nowrap">No reports</span>
          </td>
          <td class="hw-mono small text-secondary text-nowrap">
            {{ stall.liveReport ? timeAgo(stall.liveReport.createdAt) : '' }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.stall-table th,
.stall-table td {
  border-color: var(--line);
  /* Bootstrap paints table cell fills with an inset box-shadow; this table uses plain backgrounds */
  box-shadow: none;
}

/* The stall a #stall-<id> link pointed at */
.row-highlight > td {
  background: var(--sub);
}
</style>
