<script setup>
// Navbar bell for favourite reminders. Each reminder time that has come due today shows once,
// listing every favourite set for that time, until the user dismisses it.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useFavouriteStore } from '@/stores/useFavouriteStore.js'
import { dueReminders, reminderKey } from '@/utils/reminders.js'
import { formatAlertTime } from '@/utils/alerts.js'

const STORAGE_KEY = 'hawkerwatch-dismissed-reminders'

const favourites = useFavouriteStore()
const now = ref(new Date())
const open = ref(false)

// Dismissed reminders are kept in the browser, so a page refresh doesn't bring them back
function readDismissed() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
  } catch {
    return []
  }
}
const dismissed = ref(readDismissed())

const reminders = computed(() =>
  dueReminders(favourites.items, now.value).filter(
    (reminder) => !dismissed.value.includes(reminderKey(now.value, reminder.time))
  )
)

function dismiss(time) {
  dismissed.value = [...dismissed.value, reminderKey(now.value, time)]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed.value))
}

// Check the clock every 30 seconds, so a reminder appears soon after its time
let timer = null
onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date()
  }, 30 * 1000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="position-relative">
    <button
      type="button"
      class="btn btn-link nav-link position-relative px-2"
      :aria-label="`Reminders: ${reminders.length} due`"
      :aria-expanded="open"
      @click="open = !open"
    >
      <i class="bi bi-bell"></i>
      <span
        v-if="reminders.length"
        class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
      >
        {{ reminders.length }}
      </span>
    </button>

    <div v-if="open" class="card shadow-sm mt-1 reminder-panel">
      <div class="card-body p-3">
        <p v-if="!reminders.length" class="small text-secondary mb-0">
          No reminders due right now.
        </p>
        <div v-for="reminder in reminders" :key="reminder.time" class="mb-2">
          <div class="d-flex justify-content-between align-items-center">
            <span class="fw-semibold small">{{ formatAlertTime(reminder.time) }} reminder</span>
            <button type="button" class="btn btn-sm btn-link p-0" @click="dismiss(reminder.time)">
              Dismiss
            </button>
          </div>
          <p class="small mb-0">{{ reminder.names.join(', ') }}</p>
        </div>
        <RouterLink class="small" to="/profile#alerts" @click="open = false"
          >Change reminders</RouterLink
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
/* On phones the panel sits inside the open menu. From 992px (when the navbar
   stops collapsing) it floats under the bell instead. */
@media (min-width: 992px) {
  .reminder-panel {
    position: absolute;
    right: 0;
    width: 16rem;
    z-index: 1050;
  }
}
</style>
