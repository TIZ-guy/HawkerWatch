<script setup>
defineProps({
  message: { type: String, required: true },
  retryable: { type: Boolean, default: false }
})
const emit = defineEmits(['retry'])
</script>

<template>
  <div class="alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2" role="alert">
    <span><i class="bi bi-exclamation-triangle me-2" aria-hidden="true"></i>{{ message }}</span>
    <button v-if="retryable" type="button" class="btn btn-sm btn-outline-dark" @click="emit('retry')">
      Try again
    </button>
  </div>
</template>
