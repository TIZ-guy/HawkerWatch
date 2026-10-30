<script setup>
// A centre's NEA photo, or a plain placeholder when it has none, at a fixed height so rows line up.
// Usage: <CentrePhoto :centre="centre" />  (thumbnail)  or  <CentrePhoto :centre="centre" size="banner" />
defineProps({
  centre: { type: Object, required: true },
  size: { type: String, default: 'thumb' } // 'thumb' | 'banner'
})
</script>

<template>
  <!-- alt="" is right: the centre name is always next to it -->
  <img
    v-if="centre.photoUrl"
    :src="centre.photoUrl"
    alt=""
    loading="lazy"
    class="hw-photo"
    :class="size === 'banner' ? 'hw-photo-banner' : 'hw-photo-thumb'"
  />
  <div
    v-else
    class="hw-photo hw-photo-none"
    :class="size === 'banner' ? 'hw-photo-banner' : 'hw-photo-thumb'"
    aria-hidden="true"
  >
    <i class="bi bi-shop"></i>
  </div>
</template>
