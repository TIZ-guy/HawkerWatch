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
  <section class="hw-surface p-3 h-100" aria-labelledby="community-heading">
    <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-2">
      <h2 id="community-heading" class="h6 mb-0">Live updates</h2>
      <span class="hw-label">Community reported</span>
    </div>

    <p v-if="error" class="small text-secondary mb-0">{{ error }}</p>
    <p v-else-if="!summary" class="small text-secondary mb-0">Loading community updates...</p>

    <template v-else-if="summary.stallsReported > 0">
      <p class="mb-2">
        <span class="h4 hw-mono">{{ summary.stallsReported }}</span>
        stall{{ summary.stallsReported === 1 ? '' : 's' }} reported in the last {{ summary.windowMinutes }} minutes
      </p>
      <ul class="list-unstyled d-flex flex-wrap gap-3 mb-2">
        <li v-for="item in reportedStatuses" :key="item.status" class="small">
          <StatusBadge :status="item.status" /> <span class="hw-mono">× {{ item.count }}</span>
        </li>
      </ul>
      <p class="small text-secondary mb-0">
        Latest update {{ timeAgo(summary.latestReportAt) }} <span class="hw-mono">({{ formatTime(summary.latestReportAt) }})</span>
      </p>
    </template>

    <p v-else class="small text-secondary mb-0">
      No community updates in the last {{ summary.windowMinutes }} minutes.
    </p>

    <p class="small text-secondary border-top pt-2 mt-2 mb-0">
      Submitted by diners, not official. Each update expires after {{ summary?.windowMinutes || 60 }} minutes.
    </p>
  </section>
</template>
