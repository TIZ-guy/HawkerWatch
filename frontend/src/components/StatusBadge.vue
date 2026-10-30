<script setup>
// Community status, e.g. "Long queue", as a coloured dot plus label (default) or a soft pill.
// Usage: <StatusBadge status="LONG_QUEUE" />  or  <StatusBadge status="LONG_QUEUE" variant="pill" />
import { computed } from 'vue'
import { statusDisplay } from '../utils/status.js'

const props = defineProps({
  status: { type: String, required: true },
  variant: { type: String, default: 'dot' } // 'dot' | 'pill'
})

const display = computed(() => statusDisplay(props.status))
</script>

<template>
  <span v-if="variant === 'pill'" class="badge hw-pill" :class="display.pillClass">{{ display.label }}</span>
  <span v-else class="hw-q" :class="display.qClass">{{ display.label }}</span>
</template>
