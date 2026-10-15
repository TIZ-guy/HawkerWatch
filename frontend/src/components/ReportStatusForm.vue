<script setup>
// Small form for reporting a stall's status right now. Shown inside a stall card.
// While the location check is on, it gets the user's position and checks they are at the centre
// (the backend checks again). Emits submitted(report) after a successful report, or cancel.
import { onMounted, ref } from 'vue'
import { STATUS_DISPLAY, STATUS_ORDER } from '../utils/status.js'
import { getReportSettings, submitReport } from '../services/reportService.js'
import { distanceKm, formatDistance, getCurrentPosition } from '../services/locationService.js'

const props = defineProps({
  stall: { type: Object, required: true },
  // { name, location } of the stall's centre, when the page has it; lets the form check distance before sending
  centre: { type: Object, default: null }
})
const emit = defineEmits(['submitted', 'cancel'])

const status = ref('')
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
  let message = `You need to be at ${props.centre.name} to report this stall. You seem to be about ${formatDistance(km)} away.`
  if (position.accuracy > maxMetres) {
    message += ` Your device's location is only accurate to about ${formatDistance(position.accuracy / 1000)}, so this may be wrong.`
  }
  return message
}

async function submit() {
  errorMessage.value = ''
  if (!status.value) {
    errorMessage.value = 'Choose what you see at the stall.'
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
    emit('submitted', await submitReport(props.stall._id, status.value, position))
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    step.value = ''
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
    <p class="small text-secondary mt-2 mb-2">
      Your update is shown to others for 60 minutes.
      <template v-if="settings && !settings.locationCheck">
        <span class="badge text-bg-warning ms-1"><i class="bi bi-geo-alt me-1" aria-hidden="true"></i>Location check off (testing)</span>
      </template>
      <template v-else>
        You need to be at the hawker centre (within {{ settings?.maxDistanceMetres ?? 200 }} m); your location is only used for this check.
      </template>
    </p>
    <p v-if="errorMessage" class="small text-danger mb-2" role="alert">{{ errorMessage }}</p>
    <div class="d-flex gap-2">
      <button type="submit" class="btn btn-sm btn-danger" :disabled="step !== ''">
        <span v-if="step" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
        {{ step === 'locating' ? 'Checking your location...' : step === 'sending' ? 'Sending...' : 'Submit update' }}
      </button>
      <button type="button" class="btn btn-sm btn-link text-secondary" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>
