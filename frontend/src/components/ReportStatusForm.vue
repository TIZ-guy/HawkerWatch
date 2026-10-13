<script setup>
import { ref } from 'vue'
import { STATUS_DISPLAY, STATUS_ORDER } from '../utils/status.js'
import { submitReport } from '../services/reportService.js'

const props = defineProps({
  stall: { type: Object, required: true }
})
const emit = defineEmits(['submitted', 'cancel'])

const status = ref('')
const submitting = ref(false)
const errorMessage = ref('')

async function submit() {
  errorMessage.value = ''
  if (!status.value) {
    errorMessage.value = 'Choose what you see at the stall.'
    return
  }
  submitting.value = true
  try {
    emit('submitted', await submitReport(props.stall._id, status.value))
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="report-form border-top mt-3 pt-3" @submit.prevent="submit">
    <fieldset>
      <legend class="small fw-semibold mb-2">What's it like at {{ stall.name }} right now?</legend>
      <div class="d-flex flex-wrap gap-2">
        <template v-for="value in STATUS_ORDER" :key="value">
          <input
            :id="`report-${stall._id}-${value}`"
            v-model="status"
            type="radio"
            class="btn-check"
            :name="`report-${stall._id}`"
            :value="value"
          />
          <label class="btn btn-sm btn-outline-secondary rounded-pill" :for="`report-${stall._id}-${value}`">
            <i class="bi me-1" :class="STATUS_DISPLAY[value].icon" aria-hidden="true"></i>{{ STATUS_DISPLAY[value].label }}
          </label>
        </template>
      </div>
    </fieldset>
    <p class="small text-secondary mt-2 mb-2">Your update is shown to others for 60 minutes.</p>
    <p v-if="errorMessage" class="small text-danger mb-2" role="alert">{{ errorMessage }}</p>
    <div class="d-flex gap-2">
      <button type="submit" class="btn btn-sm btn-danger" :disabled="submitting">
        {{ submitting ? 'Sending...' : 'Submit update' }}
      </button>
      <button type="button" class="btn btn-sm btn-link text-secondary" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>
