<script setup>
// The "Are you sure?" bar under an admin list item, before something is removed or changed.
// Anything inside it (e.g. the ban length and reason) goes between the question and the buttons.
//   <ConfirmBar message="Remove Ah Hock?" label="Remove" :busy="busy" @confirm="remove" @cancel="confirming = ''" />
defineProps({
  message: { type: String, required: true },
  label: { type: String, default: 'Confirm' },
  busyLabel: { type: String, default: 'Working...' },
  busy: { type: Boolean, default: false }
})
const emit = defineEmits(['confirm', 'cancel'])
</script>

<template>
  <div class="alert alert-warning mt-3 mb-0" role="group" :aria-label="message">
    <p class="mb-2">{{ message }}</p>
    <slot />
    <div class="d-flex flex-wrap gap-2">
      <button type="button" class="btn btn-sm btn-outline-dark" :disabled="busy" v-on:click="emit('confirm')">
        {{ busy ? busyLabel : label }}
      </button>
      <button type="button" class="btn btn-sm btn-link text-secondary" v-on:click="emit('cancel')">Cancel</button>
    </div>
  </div>
</template>
