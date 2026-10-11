<script setup>
// Official NEA closure information for one centre. Kept visually separate from community updates.
import { computed } from 'vue'
import { closureDates, closureLabel, currentClosure, upcomingClosures } from '../utils/closures.js'

const props = defineProps({
  closures: { type: Array, default: () => [] }
})

const current = computed(() => currentClosure(props.closures))
const upcoming = computed(() => upcomingClosures(props.closures))
</script>

<template>
  <section class="card border-0 shadow-sm official-card h-100" aria-labelledby="official-heading">
    <div class="card-body p-4">
      <p class="source-label mb-1"><i class="bi bi-patch-check-fill me-1" aria-hidden="true"></i>Official · NEA</p>
      <h2 id="official-heading" class="h5 mb-3">Centre closures</h2>

      <div v-if="current" class="alert alert-danger mb-3" role="alert">
        <p class="fw-semibold mb-1">
          <i class="bi bi-slash-circle me-1" aria-hidden="true"></i>Closed today for {{ closureLabel(current).toLowerCase() }}
        </p>
        <p class="mb-0 small">
          {{ closureDates(current) }}<span v-if="current.remarks"> · {{ current.remarks }}</span>
        </p>
      </div>

      <template v-if="upcoming.length">
        <p class="small fw-semibold text-secondary mb-2">Upcoming</p>
        <ul class="list-unstyled mb-0">
          <li v-for="closure in upcoming" :key="closure.startDate" class="d-flex gap-2 mb-2">
            <i class="bi bi-calendar-event text-warning" aria-hidden="true"></i>
            <div>
              <span class="fw-semibold">{{ closureDates(closure) }}</span> · {{ closureLabel(closure) }}
              <div v-if="closure.remarks" class="small text-secondary">{{ closure.remarks }}</div>
            </div>
          </li>
        </ul>
      </template>

      <p v-if="!current && !upcoming.length" class="text-secondary mb-0">
        <i class="bi bi-calendar-check me-1" aria-hidden="true"></i>No official closures scheduled.
      </p>
    </div>
  </section>
</template>

<style scoped>
.official-card {
  border-left: 4px solid #0d6efd !important;
}

.source-label {
  color: #0d6efd;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
</style>
