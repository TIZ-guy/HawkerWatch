<script setup>
// One stall. The name links to the stall's own page (/stalls/:id), and its star rating is shown
// when the stall data includes one. With showCentre it links to the stall's centre (home search, favourites).
// With statusOnly it shows only the live status part (used on the stall page, which shows the name itself).
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
import StarRating from './StarRating.vue'
import { getStallReports } from '../services/hawkerService.js'
import { flagReport } from '../services/reportService.js'
import { useAuthStore } from '../stores/useAuthStore.js'
import { timeAgo, timeUntil } from '../utils/time.js'
import { statusDisplay } from '../utils/status.js'

const props = defineProps({
  // From /stalls (hawkerCentre populated) or /hawker-centres/:id/stalls (liveReport included)
  stall: { type: Object, required: true },
  showCentre: { type: Boolean, default: false },
  statusOnly: { type: Boolean, default: false },
  // { name, location } of the stall's centre, passed on to the report form for its distance check
  centre: { type: Object, default: null }
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
  if (!auth.user) return goToLogin()
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
  if (!auth.user) return goToLogin()
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
  <article class="hw-surface h-100">
    <div class="p-3 p-lg-4">
      <div v-if="!statusOnly" class="d-flex justify-content-between align-items-start gap-2">
        <div>
          <h3 class="h6 mb-1">
            <RouterLink :to="`/stalls/${stall._id}`" class="stall-link">{{ stall.name }}</RouterLink>
          </h3>
          <p class="small text-secondary mb-0">
            <span v-if="stall.speciality">{{ stall.speciality }}</span>
            <span v-if="stall.speciality && stall.cuisine"> · </span>
            <span v-if="stall.cuisine" class="text-secondary">{{ stall.cuisine }}</span>
            <span v-if="(stall.speciality || stall.cuisine) && stall.unitNumber"> · </span>
            <span v-if="stall.unitNumber">#{{ stall.unitNumber }}</span>
          </p>
          <p v-if="stall.rating && stall.rating.count > 0" class="small mt-1 mb-0">
            <StarRating :rating="stall.rating.average" :count="stall.rating.count" />
          </p>
        </div>
        <div class="d-flex align-items-center gap-2 flex-shrink-0">
          <StatusBadge v-if="liveReport" :status="liveReport.status" />
          <FavouriteButton target-type="Stall" :target-id="stall._id" :name="stall.name" />
        </div>
      </div>

      <RouterLink
        v-if="!statusOnly && showCentre && stall.hawkerCentre?._id"
        class="d-inline-block small mt-2 text-brick"
        :to="`/hawker-centres/${stall.hawkerCentre._id}#stall-${stall._id}`"
      >
        <i class="bi bi-shop me-1" aria-hidden="true"></i>{{ stall.hawkerCentre.name }}
      </RouterLink>

      <template v-if="hasLiveData">
        <StatusBadge v-if="statusOnly && liveReport" :status="liveReport.status" />
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
            class="btn btn-link btn-sm p-0 text-decoration-none text-brick"
            @click="startReport"
          >
            <i class="bi bi-megaphone me-1" aria-hidden="true"></i>Report status
          </button>
        </div>

        <p v-if="thanks" class="small text-secondary mt-2 mb-0" role="status">{{ thanks }}</p>

        <div v-if="reportsOpen" class="mt-2">
          <p v-if="reportsLoading" class="small text-secondary mb-0">Loading updates...</p>
          <p v-else-if="reportsError" class="small text-brick mb-0">{{ reportsError }}</p>
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
                    <button type="button" class="btn btn-sm btn-outline-dark py-0" :disabled="flaggingId === report._id" @click="confirmFlag(report._id)">
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

                <span v-if="flagError.id === report._id" class="w-100 text-brick" role="alert">{{ flagError.message }}</span>
              </li>
            </ul>
          </template>
          <p v-if="flagMessage" class="small text-secondary mt-2 mb-0" role="status">{{ flagMessage }}</p>
        </div>

        <ReportStatusForm v-if="reporting" :stall="stall" :centre="centre" @submitted="onReported" @cancel="reporting = false" />
      </template>

      <!-- Extra content from the parent, e.g. the alert summary on the Favourites page -->
      <slot />
    </div>
  </article>
</template>

<style scoped>
.stall-link {
  color: inherit;
  text-decoration: none;
}

.stall-link:hover,
.stall-link:focus {
  color: var(--line-strong);
  text-decoration: underline;
}
</style>
