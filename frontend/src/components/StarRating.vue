<script setup>
// Shows a rating as 5 stars (full, half or empty), e.g. 4.3 -> ★★★★☆ 4.3
// Usage: <StarRating :rating="4.3" :count="12" />  shows "4.3 (12 reviews)" after the stars
import { computed } from 'vue'

const props = defineProps({
  rating: { type: Number, required: true },
  // Number of reviews; leave it out to show only the stars and the number
  count: { type: Number, default: null },
  showNumber: { type: Boolean, default: true }
})

// One Bootstrap icon class per star
const stars = computed(() => {
  const icons = []
  for (let star = 1; star <= 5; star++) {
    if (props.rating >= star) {
      icons.push('bi-star-fill')
    } else if (props.rating >= star - 0.5) {
      icons.push('bi-star-half')
    } else {
      icons.push('bi-star')
    }
  }
  return icons
})
</script>

<template>
  <span class="star-rating d-inline-flex align-items-center gap-1">
    <span class="stars" role="img" :aria-label="`${rating} out of 5 stars`">
      <i v-for="(icon, index) in stars" :key="index" class="bi" :class="icon" aria-hidden="true"></i>
    </span>
    <span v-if="showNumber" class="fw-semibold">{{ rating.toFixed(1) }}</span>
    <span v-if="count !== null" class="text-secondary">({{ count }} review{{ count === 1 ? '' : 's' }})</span>
  </span>
</template>

<style scoped>
.stars {
  color: #f5a623;
  white-space: nowrap;
}
</style>
