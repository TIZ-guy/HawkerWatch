<script setup>
// How much to trust a stall's community status, e.g. "High confidence · 3 reports".
// Takes the summary from GET /api/reports?stallId=...: { level, confidence, reportCount }.
// A soft pill coloured by level (green high, amber medium, red low). The level is always written out
// (never colour alone); the percentage is in the tooltip.
// Usage: <ConfidenceLabel :summary="summary" />
import { computed } from 'vue'
import { confidenceDisplay } from '../utils/status.js'

const props = defineProps({
  summary: { type: Object, required: true }
})

const display = computed(() => confidenceDisplay(props.summary.level))
const reportsText = computed(() => `${props.summary.reportCount} ${props.summary.reportCount === 1 ? 'report' : 'reports'}`)
</script>

<template>
  <span class="badge hw-pill" :class="display.pillClass" :title="`${summary.confidence}% confidence from ${reportsText}`">
    <i class="bi me-1" :class="display.icon" aria-hidden="true"></i>{{ display.label }} · {{ reportsText }}
  </span>
</template>
