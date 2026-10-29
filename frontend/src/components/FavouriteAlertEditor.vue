<script setup>
// Reminder settings for one favourite: on/off, days of the week and a time.
// Saves the preference; ReminderBell shows the reminder in the navbar when it's due.
import { computed, ref, watch } from 'vue'
import { useFavouriteStore } from '../stores/useFavouriteStore.js'
import { WEEK_DAYS, formatAlert } from '../utils/alerts.js'

const props = defineProps({
  favourite: { type: Object, required: true }
})

const favourites = useFavouriteStore()

const enabled = ref(false)
const days = ref([])
const time = ref('')
const saving = ref(false)
const message = ref('')
const errorMessage = ref('')

function resetFromFavourite() {
  enabled.value = Boolean(props.favourite.alert?.enabled)
  days.value = [...(props.favourite.alert?.days || [])]
  time.value = props.favourite.alert?.time || ''
}
watch(() => props.favourite.alert, resetFromFavourite, { immediate: true, deep: true })

const idPrefix = computed(() => `alert-${props.favourite._id}`)
const name = computed(() => props.favourite.target?.name || 'Removed listing')
const typeLabel = computed(() => (props.favourite.targetType === 'Stall' ? 'Stall' : 'Hawker centre'))

const changed = computed(() => {
  const saved = props.favourite.alert || {}
  return enabled.value !== Boolean(saved.enabled) ||
    time.value !== (saved.time || '') ||
    [...days.value].sort().join() !== [...(saved.days || [])].sort().join()
})

function toggleDay(value) {
  days.value = days.value.includes(value) ? days.value.filter((day) => day !== value) : [...days.value, value]
}

async function save() {
  message.value = ''
  errorMessage.value = ''
  if (enabled.value && (!days.value.length || !time.value)) {
    errorMessage.value = 'Pick at least one day and a time, or turn the reminder off.'
    return
  }

  saving.value = true
  try {
    // An empty time isn't valid HH:mm, so it's left out instead of sent as ''
    await favourites.updateAlert(props.favourite._id, {
      enabled: enabled.value,
      days: days.value,
      time: time.value || undefined
    })
    message.value = enabled.value ? `Saved: ${formatAlert({ enabled: true, days: days.value, time: time.value })}` : 'Reminder turned off'
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="alert-row py-3" @submit.prevent="save">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
      <div>
        <span class="fw-semibold">{{ name }}</span>
        <span class="badge text-bg-light border ms-2">{{ typeLabel }}</span>
      </div>
      <div class="form-check form-switch mb-0">
        <input :id="`${idPrefix}-enabled`" v-model="enabled" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label small" :for="`${idPrefix}-enabled`">Reminder {{ enabled ? 'on' : 'off' }}</label>
      </div>
    </div>

    <fieldset :disabled="!enabled" class="d-flex flex-wrap align-items-end gap-3">
      <legend class="visually-hidden">Reminder days and time for {{ name }}</legend>
      <div>
        <span class="form-label small d-block mb-1">Days</span>
        <div class="btn-group btn-group-sm" role="group" :aria-label="`Reminder days for ${name}`">
          <template v-for="day in WEEK_DAYS" :key="day.value">
            <input
              :id="`${idPrefix}-day-${day.value}`"
              type="checkbox"
              class="btn-check"
              :checked="days.includes(day.value)"
              @change="toggleDay(day.value)"
            />
            <label class="btn btn-outline-secondary" :for="`${idPrefix}-day-${day.value}`">{{ day.short }}</label>
          </template>
        </div>
      </div>
      <div>
        <label class="form-label small mb-1" :for="`${idPrefix}-time`">Time</label>
        <input :id="`${idPrefix}-time`" v-model="time" type="time" class="form-control form-control-sm" />
      </div>
    </fieldset>

    <div class="d-flex flex-wrap align-items-center gap-3 mt-3">
      <button type="submit" class="btn btn-sm btn-danger" :disabled="!changed || saving">
        {{ saving ? 'Saving...' : 'Save reminder' }}
      </button>
      <span v-if="message" class="small text-success" role="status">{{ message }}</span>
      <span v-if="errorMessage" class="small text-danger" role="alert">{{ errorMessage }}</span>
    </div>
  </form>
</template>

<style scoped>
.alert-row + .alert-row {
  border-top: 1px solid var(--bs-border-color);
}

fieldset:disabled {
  opacity: 0.55;
}
</style>
