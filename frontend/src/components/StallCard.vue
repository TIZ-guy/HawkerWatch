<script setup>
// One stall. With showCentre it links to the stall's centre (home search, favourites).
// When the stall data includes liveReport (centre page, favourites) it shows the newest
// live community report, can list recent ones, and lets logged-in users report the status.
// Stall search results don't include liveReport.
// Emits reported(report) after the user submits an update, so the page can refresh totals,
// and changed() when a flag hides a report, so the page can reload the stall statuses.
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StatusBadge from './StatusBadge.vue'
import FavouriteButton from './FavouriteButton.vue'
import ReportStatusForm from './ReportStatusForm.vue'
import { getStallReports } from '../services/hawkerService.js'
import { flagReport } from '../services/reportService.js'
import { useAuthStore } from '../stores/useAuthStore.js'
import { timeAgo, timeUntil } from '../utils/time.js'
import { statusDisplay } from '../utils/status.js'

const props = defineProps({
  // From /stalls (hawkerCentre populated) or /hawker-centres/:id/stalls (liveReport included)
  stall: { type: Object, required: true },
  showCentre: { type: Boolean, default: false }
})
const emit = defineEmits(['reported', 'changed'])

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const hasLiveData = computed(() => 'liveReport' in props.stall)

// The user's own new report shows straight away, without waiting for the page to reload.
const submittedReport = ref(null)
const liveReport = computed(() => submittedReport.value || props.stall.liveReport)

const reports = ref(null)
const reportsOpen = ref(false)
const reportsLoading = ref(false)
const reportsError = ref('')

async function loadReports() {
  reportsLoading.value = true
  reportsError.value = ''
  try {
    reports.value = await getStallReports(props.stall._id)
  } catch (error) {
    reportsError.value = error.message
  } finally {
    reportsLoading.value = false
  }
}

function toggleReports() {
  reportsOpen.value = !reportsOpen.value
  if (reportsOpen.value && !reports.value) loadReports()
}

const reporting = ref(false)
const thanks = ref('')

function startReport() {
  thanks.value = ''
  if (!auth.state.user) return goToLogin()
  reporting.value = true
}

// Flagging a report as wrong. The reports list doesn't say who wrote each report (user ids
// stay private), so only a report submitted from this card is known to be the user's own;
// for older ones the backend refuses and its message is shown.
const confirmingFlagId = ref('')
const flaggingId = ref('')
const flaggedIds = ref([])
const flagError = ref({ id: '', message: '' })
const flagMessage = ref('')

const isOwnReport = (report) => String(submittedReport.value?.id) === String(report._id)

function goToLogin() {
  router.push({ path: '/login', query: { redirect: `${route.path}#stall-${props.stall._id}` } })
}

function startFlag(reportId) {
  flagError.value = { id: '', message: '' }
  if (!auth.state.user) return goToLogin()
  confirmingFlagId.value = reportId
}

async function confirmFlag(reportId) {
  flaggingId.value = reportId
  flagMessage.value = ''
  try {
    const result = await flagReport(reportId)
    flaggedIds.value = [...flaggedIds.value, reportId]
    if (result.hidden) {
      flagMessage.value = 'Thanks. Enough people flagged that update, so it is now hidden.'
      emit('changed')
      await loadReports()
    } else {
      flagMessage.value = 'Thanks. That update has been flagged as wrong.'
    }
  } catch (error) {
    // 409: you flagged it before (e.g. before reloading the page), so just show it as flagged
    if (error.status === 409) flaggedIds.value = [...flaggedIds.value, reportId]
    else flagError.value = { id: reportId, message: error.message }
  } finally {
    flaggingId.value = ''
    confirmingFlagId.value = ''
  }
}

function onReported(report) {
  reporting.value = false
  submittedReport.value = report
  thanks.value = 'Thanks! Your update is live for the next 60 minutes.'
  if (reportsOpen.value) loadReports()
  else reports.value = null // fetched fresh next time the list opens
  emit('reported', report)
}
</script>

<template>
  <article class="card border-0 shadow-sm h-100">
    <div class="card-body p-3 p-lg-4">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <h3 class="h6 mb-1">{{ stall.name }}</h3>
          <p class="small text-secondary mb-0">
            <span v-if="stall.cuisine">{{ stall.cuisine }}</span>
            <span v-if="stall.cuisine && stall.unitNumber"> · </span>
            <span v-if="stall.unitNumber">#{{ stall.unitNumber }}</span>
          </p>
        </div>
        <div class="d-flex align-items-center gap-2 flex-shrink-0">
          <StatusBadge v-if="liveReport" :status="liveReport.status" />
          <FavouriteButton target-type="Stall" :target-id="stall._id" :name="stall.name" />
        </div>
      </div>

      <RouterLink
        v-if="showCentre && stall.hawkerCentre?._id"
        class="d-inline-block small mt-2 text-danger"
        :to="`/hawker-centres/${stall.hawkerCentre._id}#stall-${stall._id}`"
      >
        <i class="bi bi-shop me-1" aria-hidden="true"></i>{{ stall.hawkerCentre.name }}
      </RouterLink>

      <template v-if="hasLiveData">
        <p v-if="liveReport" class="small text-secondary mt-2 mb-0">
          <i class="bi bi-people me-1" aria-hidden="true"></i>Community update {{ timeAgo(liveReport.createdAt) }}
          · expires {{ timeUntil(liveReport.expiresAt) }}
        </p>
        <p v-else class="small text-secondary mt-2 mb-0">No live community updates.</p>

        <div class="d-flex flex-wrap gap-3 mt-1">
          <button
            v-if="liveReport"
            type="button"
            class="btn btn-link btn-sm p-0 text-decoration-none"
            :aria-expanded="reportsOpen"
            @click="toggleReports"
          >
            {{ reportsOpen ? 'Hide' : 'Show' }} recent updates
            <i class="bi" :class="reportsOpen ? 'bi-chevron-up' : 'bi-chevron-down'" aria-hidden="true"></i>
          </button>
          <button
            v-if="!reporting"
            type="button"
            class="btn btn-link btn-sm p-0 text-decoration-none text-danger"
            @click="startReport"
          >
            <i class="bi bi-megaphone me-1" aria-hidden="true"></i>Report status
          </button>
        </div>

        <p v-if="thanks" class="small text-success mt-2 mb-0" role="status">{{ thanks }}</p>

        <div v-if="reportsOpen" class="mt-2">
          <p v-if="reportsLoading" class="small text-secondary mb-0">Loading updates...</p>
          <p v-else-if="reportsError" class="small text-danger mb-0">{{ reportsError }}</p>
          <template v-else-if="reports">
            <p v-if="!reports.length" class="small text-secondary mb-0">No live updates right now.</p>
            <ul class="list-unstyled small mb-0">
              <li v-for="report in reports" :key="report._id" class="d-flex flex-wrap align-items-center gap-2 py-1 border-top">
                <StatusBadge :status="report.status" />
                <span class="text-secondary">{{ timeAgo(report.createdAt) }}</span>

                <span class="ms-auto">
                  <span v-if="flaggedIds.includes(report._id)" class="text-secondary">
                    <i class="bi bi-flag-fill me-1" aria-hidden="true"></i>Flagged
                  </span>
                  <span v-else-if="isOwnReport(report)" class="text-secondary">Your update</span>
                  <span v-else-if="confirmingFlagId === report._id" class="d-inline-flex align-items-center gap-2">
                    <span>Flag as wrong?</span>
                    <button type="button" class="btn btn-sm btn-danger py-0" :disabled="flaggingId === report._id" @click="confirmFlag(report._id)">
                      {{ flaggingId === report._id ? 'Flagging...' : 'Yes' }}
                    </button>
                    <button type="button" class="btn btn-sm btn-link text-secondary p-0" @click="confirmingFlagId = ''">Cancel</button>
                  </span>
                  <button
                    v-else
                    type="button"
                    class="btn btn-link btn-sm p-0 text-secondary text-decoration-none"
                    :aria-label="`Flag this ${statusDisplay(report.status).label.toLowerCase()} update as wrong`"
                    @click="startFlag(report._id)"
                  >
                    <i class="bi bi-flag me-1" aria-hidden="true"></i>Flag
                  </button>
                </span>

                <span v-if="flagError.id === report._id" class="w-100 text-danger" role="alert">{{ flagError.message }}</span>
              </li>
            </ul>
          </template>
          <p v-if="flagMessage" class="small text-success mt-2 mb-0" role="status">{{ flagMessage }}</p>
        </div>

        <ReportStatusForm v-if="reporting" :stall="stall" @submitted="onReported" @cancel="reporting = false" />
      </template>

      <!-- Extra content from the parent, e.g. the alert summary on the Favourites page -->
      <slot />
    </div>
  </article>
</template>
