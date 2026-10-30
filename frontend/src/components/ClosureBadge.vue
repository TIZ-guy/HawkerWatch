<script setup>
// Small official-closure badge for centre cards. The full details are in OfficialClosureAlert.
import { computed } from 'vue'
import { closureLabel, currentClosure, daysUntil, upcomingClosures } from '../utils/closures.js'

const props = defineProps({
  closures: { type: Array, default: () => [] }
})

const badge = computed(() => {
  const current = currentClosure(props.closures)
  if (current) {
    return { text: `Closed today · ${closureLabel(current)}`, className: 'hw-closure', icon: 'bi-slash-circle' }
  }

  const [next] = upcomingClosures(props.closures)
  if (next) {
    const days = daysUntil(next.startDate)
    const when = days === 1 ? 'tomorrow' : `in ${days} days`
    return { text: `${closureLabel(next)} ${when}`, className: 'hw-closure', icon: 'bi-calendar-event' }
  }

  return { text: 'No closures scheduled', className: 'hw-tag', icon: 'bi-calendar-check' }
})
</script>

<template>
  <span class="closure-badge" :class="badge.className" title="Official NEA closure information">
    <i class="bi me-1" :class="badge.icon" aria-hidden="true"></i>{{ badge.text }}
  </span>
</template>

<style scoped>
.closure-badge {
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 600;
}

/* Official closures use the notice colours, kept apart from queue statuses */
.hw-closure {
  border: 1px solid var(--warn-line);
  border-radius: var(--radius-sm);
  background: var(--warn-bg);
  color: var(--warn-ink);
  padding: 0.1rem 0.45rem;
}
</style>
