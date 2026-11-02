<script setup>
// Small form for saying what the food is like at a stall today. Shown inside a stall card.
// Same location check as ReportStatusForm (the backend checks again).
// Emits submitted(foodUpdate) after a successful update, or cancel.
import { onMounted, ref } from 'vue'
import { FOOD_UPDATE_DISPLAY, FOOD_UPDATE_ORDER, FOOD_UPDATE_NOTE_MAX_LENGTH } from '../utils/foodUpdates.js'
import { getReportSettings } from '../services/reportService.js'
import { submitFoodUpdate } from '../services/foodUpdateService.js'
import { distanceKm, formatDistance, getCurrentPosition } from '../services/locationService.js'

const props = defineProps({
  stall: { type: Object, required: true },
  // { name, location } of the stall's centre, when the page has it; lets the form check distance before sending
  centre: { type: Object, default: null }
})
const emit = defineEmits(['submitted', 'cancel'])

const type = ref('')
const note = ref('')
const step = ref('') // '', 'locating' or 'sending'
const errorMessage = ref('')
const settings = ref(null)

onMounted(async () => {
  try {
    settings.value = await getReportSettings()
  } catch {
    settings.value = null // the backend still checks; the note just stays generic
  }
})

function tooFarMessage(position) {
  const maxMetres = settings.value?.maxDistanceMetres ?? 200
  const km = distanceKm(position, props.centre?.location)
  if (km == null || km * 1000 <= maxMetres) return ''
  return `You need to be at ${props.centre.name} to update this stall. You seem to be about ${formatDistance(km)} away.`
}

async function submit() {
  errorMessage.value = ''
  if (!type.value) {
    errorMessage.value = 'Choose what the food is like.'
    return
  }

  let position = null
  if (settings.value?.locationCheck !== false) {
    step.value = 'locating'
    try {
      position = await getCurrentPosition({ fresh: true })
    } catch (error) {
      errorMessage.value = error.message
      step.value = ''
      return
    }
    errorMessage.value = tooFarMessage(position)
    if (errorMessage.value) {
      step.value = ''
      return
    }
  }

  step.value = 'sending'
  try {
    emit('submitted', await submitFoodUpdate(props.stall._id, type.value, note.value.trim() || undefined, position))
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    step.value = ''
  }
}
</script>

<template>
  <form class="food-update-form border-top mt-3 pt-3" @submit.prevent="submit">
    <fieldset>
      <legend class="small fw-semibold mb-2">What's the food like at {{ stall.name }} today?</legend>
      <div class="d-flex flex-wrap gap-2">
        <template v-for="value in FOOD_UPDATE_ORDER" :key="value">
          <input
            :id="`food-${stall._id}-${value}`"
            v-model="type"
            type="radio"
            class="btn-check"
            :name="`food-${stall._id}`"
            :value="value"
          />
          <label class="hw-chip" :for="`food-${stall._id}-${value}`">
            <i class="bi me-1" :class="FOOD_UPDATE_DISPLAY[value].icon" aria-hidden="true"></i>{{ FOOD_UPDATE_DISPLAY[value].label }}
          </label>
        </template>
      </div>
    </fieldset>
    <label class="small mt-2 d-block" :for="`food-note-${stall._id}`">Note (optional)</label>
    <input
      :id="`food-note-${stall._id}`"
      v-model="note"
      type="text"
      class="form-control form-control-sm"
      :maxlength="FOOD_UPDATE_NOTE_MAX_LENGTH"
      placeholder="e.g. No more fish balls"
    />
    <p class="small text-secondary mt-2 mb-2">
      Your update is shown to others until the end of the day.
      <template v-if="settings && !settings.locationCheck">
        <span class="hw-tag ms-1"><i class="bi bi-geo-alt me-1" aria-hidden="true"></i>Location check off (testing)</span>
      </template>
      <template v-else>
        You need to be at the hawker centre (within {{ settings?.maxDistanceMetres ?? 200 }} m); your location is only used for this check.
      </template>
    </p>
    <p v-if="errorMessage" class="small text-brick mb-2" role="alert">{{ errorMessage }}</p>
    <div class="d-flex gap-2">
      <button type="submit" class="btn btn-sm hw-btn-primary" :disabled="step !== ''">
        <span v-if="step" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
        {{ step === 'locating' ? 'Checking your location...' : step === 'sending' ? 'Sending...' : 'Submit food update' }}
      </button>
      <button type="button" class="btn btn-sm btn-link text-secondary" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>
