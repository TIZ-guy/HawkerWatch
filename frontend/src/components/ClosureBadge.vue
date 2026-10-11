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
    return { text: `Closed today · ${closureLabel(current)}`, className: 'text-bg-danger', icon: 'bi-slash-circle' }
  }

  const [next] = upcomingClosures(props.closures)
  if (next) {
    const days = daysUntil(next.startDate)
    const when = days === 1 ? 'tomorrow' : `in ${days} days`
    return { text: `${closureLabel(next)} ${when}`, className: 'text-bg-warning', icon: 'bi-calendar-event' }
  }

  return { text: 'No closures scheduled', className: 'text-bg-light border', icon: 'bi-calendar-check' }
})
</script>

<template>
  <span class="badge" :class="badge.className" title="Official NEA closure information">
    <i class="bi me-1" :class="badge.icon" aria-hidden="true"></i>{{ badge.text }}
  </span>
</template>
