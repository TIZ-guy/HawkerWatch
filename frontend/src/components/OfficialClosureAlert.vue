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
  <!-- Official NEA closures. Uses the notice colours when there is a closure, kept apart from queue statuses. -->
  <section class="closure-panel p-3" :class="{ 'has-closure': current || upcoming.length }" aria-labelledby="official-heading">
    <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-2">
      <h2 id="official-heading" class="h6 mb-0">
        <i class="bi bi-calendar-event me-1" aria-hidden="true"></i>Centre closures
      </h2>
      <span class="hw-label">Official · NEA</span>
    </div>

    <p v-if="current" class="fw-semibold mb-2" role="alert">
      Closed today for {{ closureLabel(current).toLowerCase() }}
      <span class="hw-mono fw-normal">· {{ closureDates(current) }}</span>
      <span v-if="current.remarks" class="d-block small fw-normal">{{ current.remarks }}</span>
    </p>

    <ul v-if="upcoming.length" class="list-unstyled small mb-0 d-grid gap-1">
      <li v-for="closure in upcoming" :key="closure.startDate">
        <span class="hw-mono fw-semibold">{{ closureDates(closure) }}</span> · {{ closureLabel(closure) }}
        <span v-if="closure.remarks" class="d-block closure-remarks">{{ closure.remarks }}</span>
      </li>
    </ul>

    <p v-if="!current && !upcoming.length" class="small text-secondary mb-0">No official closures scheduled.</p>
  </section>
</template>

<style scoped>
.closure-panel {
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.closure-panel.has-closure {
  border-color: var(--warn-line);
  background: var(--warn-bg);
  color: var(--warn-ink);
}

.closure-panel.has-closure .hw-label,
.closure-remarks {
  color: var(--warn-ink);
  opacity: 0.85;
}
</style>
