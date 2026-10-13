<script setup>
import { computed } from 'vue'
import { statusDisplay } from '../utils/status.js'

const props = defineProps({
  status: { type: String, required: true }
})

const display = computed(() => statusDisplay(props.status))
</script>

<template>
  <span class="badge rounded-pill" :class="display.badgeClass">
    <i class="bi me-1" :class="display.icon" aria-hidden="true"></i>{{ display.label }}
  </span>
</template>
