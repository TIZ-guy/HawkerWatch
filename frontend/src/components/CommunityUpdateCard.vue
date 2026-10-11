<script setup>
// Community summary for one centre (from /hawker-centres/:id/community-summary).
// Clearly labelled as community submitted and time-limited, unlike OfficialClosureAlert.
import { computed } from 'vue'
import StatusBadge from './StatusBadge.vue'
import { STATUS_ORDER } from '../utils/status.js'
import { formatTime, timeAgo } from '../utils/time.js'

const props = defineProps({
  // { windowMinutes, stallsReported, byStatus, latestReportAt }, or null while loading or on error
  summary: { type: Object, default: null },
  error: { type: String, default: '' }
})

// Only the statuses that at least one stall has, in a fixed order.
const reportedStatuses = computed(() =>
  STATUS_ORDER
    .filter((status) => props.summary?.byStatus?.[status] > 0)
    .map((status) => ({ status, count: props.summary.byStatus[status] }))
)
</script>

<template>
  <section class="card border-0 shadow-sm community-card h-100" aria-labelledby="community-heading">
    <div class="card-body p-4">
      <p class="source-label mb-1"><i class="bi bi-people-fill me-1" aria-hidden="true"></i>Community reported</p>
      <h2 id="community-heading" class="h5 mb-3">Live updates</h2>

      <p v-if="error" class="text-secondary mb-0">{{ error }}</p>
      <p v-else-if="!summary" class="text-secondary mb-0">Loading community updates...</p>

      <template v-else-if="summary.stallsReported > 0">
        <p class="mb-2">
          <span class="fs-3 fw-bold">{{ summary.stallsReported }}</span>
          stall{{ summary.stallsReported === 1 ? '' : 's' }} reported in the last {{ summary.windowMinutes }} minutes
        </p>
        <ul class="list-unstyled d-flex flex-wrap gap-2 mb-3">
          <li v-for="item in reportedStatuses" :key="item.status">
            <StatusBadge :status="item.status" /> <span class="small fw-semibold">× {{ item.count }}</span>
          </li>
        </ul>
        <p class="small text-secondary mb-0">
          <i class="bi bi-clock me-1" aria-hidden="true"></i>Latest update {{ timeAgo(summary.latestReportAt) }}
          ({{ formatTime(summary.latestReportAt) }})
        </p>
      </template>

      <p v-else class="text-secondary mb-0">
        No community updates in the last {{ summary.windowMinutes }} minutes.
      </p>

      <p class="small text-secondary border-top pt-3 mt-3 mb-0">
        Submitted by diners, not official. Each update expires after {{ summary?.windowMinutes || 60 }} minutes.
      </p>
    </div>
  </section>
</template>

<style scoped>
.community-card {
  border-left: 4px solid var(--hw-orange) !important;
  background: #fffaf3;
}

.source-label {
  color: #b85c00;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
</style>
