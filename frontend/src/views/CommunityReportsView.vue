<script setup>
// Community reports: the newest live reports across every centre, and a way to report a stall from here.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import FilterChips from '../components/FilterChips.vue'
import StatusBadge from '../components/StatusBadge.vue'
import ReportStatusForm from '../components/ReportStatusForm.vue'
import LoadingState from '../components/LoadingState.vue'
import ErrorState from '../components/ErrorState.vue'
import { getRecentReports } from '../services/reportService.js'
import { getHawkerCentres, getHawkerCentreStalls } from '../services/hawkerService.js'
import { useAuthStore } from '../stores/useAuthStore.js'
import { STATUS_DISPLAY, STATUS_ORDER } from '../utils/status.js'
import { timeAgo, timeUntil } from '../utils/time.js'

const REFRESH_MS = 60 * 1000

const auth = useAuthStore()
const router = useRouter()

const STATUS_CHOICES = STATUS_ORDER.map((value) => ({ value, label: STATUS_DISPLAY[value].label, icon: STATUS_DISPLAY[value].icon }))
const statusFilter = ref('')

const reports = ref([])
const loading = ref(true)
const errorMessage = ref('')
const now = ref(Date.now())

async function loadReports() {
  errorMessage.value = ''
  try {
    reports.value = await getRecentReports({ status: statusFilter.value || undefined })
    now.value = Date.now()
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}

watch(statusFilter, () => {
  loading.value = true
  loadReports()
})

// Reporting from this page: choose a centre, then a stall, then the status
const reporting = ref(false)
const centres = ref([])
const centreId = ref('')
const stalls = ref([])
const stallId = ref('')
const pickerError = ref('')
const thanks = ref('')

const centre = computed(() => centres.value.find((item) => item._id === centreId.value) || null)
const stall = computed(() => stalls.value.find((item) => item._id === stallId.value) || null)

async function startReport() {
  thanks.value = ''
  if (!auth.user) {
    router.push({ path: '/login', query: { redirect: '/reports' } })
    return
  }
  reporting.value = true
  if (centres.value.length) return
  try {
    centres.value = await getHawkerCentres()
  } catch (error) {
    pickerError.value = error.message
  }
}

watch(centreId, async (id) => {
  stalls.value = []
  stallId.value = ''
  pickerError.value = ''
  if (!id) return
  try {
    stalls.value = await getHawkerCentreStalls(id)
  } catch (error) {
    pickerError.value = error.message
  }
})

function closeReport() {
  reporting.value = false
  centreId.value = ''
}

function onReported() {
  thanks.value = `Thanks! Your update on ${stall.value?.name} is live for the next 60 minutes.`
  closeReport()
  loadReports()
}

let timer
onMounted(() => {
  loadReports()
  timer = setInterval(loadReports, REFRESH_MS)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <main class="container py-4">
    <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
      <div>
        <h1 class="display-6 mb-2">Community reports</h1>
        <p class="text-secondary mb-0">Live updates from diners in the last 60 minutes. Submitted by the community, not official.</p>
      </div>
      <button v-if="!reporting" type="button" class="btn hw-btn-primary" @click="startReport">
        <i class="bi bi-megaphone me-2" aria-hidden="true"></i>Report a stall
      </button>
    </div>

    <p v-if="thanks" class="hw-surface p-3 small" role="status">{{ thanks }}</p>

    <section v-if="reporting" class="hw-surface mb-4" aria-labelledby="report-heading">
      <div class="p-4">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h2 id="report-heading" class="h5 mb-0">Report a stall</h2>
          <button type="button" class="btn btn-sm btn-link text-secondary" @click="closeReport">Cancel</button>
        </div>
        <div class="row g-3">
          <div class="col-md-6">
            <label for="report-centre" class="form-label hw-label">Hawker centre</label>
            <select id="report-centre" v-model="centreId" class="form-select">
              <option value="">Choose a centre</option>
              <option v-for="item in centres" :key="item._id" :value="item._id">{{ item.name }}</option>
            </select>
          </div>
          <div class="col-md-6">
            <label for="report-stall" class="form-label hw-label">Stall</label>
            <select id="report-stall" v-model="stallId" class="form-select" :disabled="!centreId || !stalls.length">
              <option value="">{{ centreId && !stalls.length ? 'No stalls listed yet' : 'Choose a stall' }}</option>
              <option v-for="item in stalls" :key="item._id" :value="item._id">
                {{ item.name }}{{ item.unitNumber ? ` (#${item.unitNumber})` : '' }}
              </option>
            </select>
          </div>
        </div>
        <p v-if="pickerError" class="small text-brick mt-2 mb-0" role="alert">{{ pickerError }}</p>
        <ReportStatusForm v-if="stall" :key="stall._id" :stall="stall" :centre="centre" @submitted="onReported" @cancel="closeReport" />
      </div>
    </section>

    <section aria-labelledby="feed-heading">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 border-bottom pb-2 mb-3">
        <h2 id="feed-heading" class="h5 mb-0">Latest updates <span class="hw-mono text-secondary fw-normal">({{ reports.length }})</span></h2>
        <button type="button" class="btn btn-sm btn-outline-dark" @click="loadReports">
          <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Refresh
        </button>
      </div>
      <FilterChips v-model="statusFilter" class="mb-3" :options="STATUS_CHOICES" label="Filter by status" small />

      <LoadingState v-if="loading" message="Loading community reports..." />
      <ErrorState v-else-if="errorMessage" :message="errorMessage" retryable @retry="loadReports" />
      <div v-else-if="!reports.length" class="hw-surface p-3">
        No live {{ statusFilter ? STATUS_DISPLAY[statusFilter].label.toLowerCase() : '' }} reports right now.
        Be the first: choose <strong>Report a stall</strong>.
      </div>
      <ul v-else class="row g-4 list-unstyled mb-0">
        <li v-for="report in reports" :key="report.id" class="col-sm-6 col-lg-4">
          <article class="card border-0 shadow-sm h-100 report-card" data-testid="report-feed-item">
            <div class="card-body p-4 d-flex flex-column">
              <div class="mb-3"><StatusBadge :status="report.status" /></div>
              <h3 class="h6 mb-1">
                <RouterLink
                  class="stretched-link text-reset text-decoration-none"
                  :to="`/hawker-centres/${report.hawkerCentre._id}#stall-${report.stall._id}`"
                >
                  {{ report.stall.name }}<span v-if="report.stall.unitNumber" class="text-secondary fw-normal small"> #{{ report.stall.unitNumber }}</span>
                </RouterLink>
              </h3>
              <p class="small text-secondary mb-0">
                <i class="bi bi-shop me-1" aria-hidden="true"></i>{{ report.hawkerCentre.name }}
              </p>
              <p class="small text-secondary mt-auto pt-3 mb-0">
                <i class="bi bi-clock me-1" aria-hidden="true"></i>{{ timeAgo(report.createdAt, now) }} · expires {{ timeUntil(report.expiresAt, now) }}
              </p>
            </div>
          </article>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
/* Same hover lift as HawkerCentreCard, since the whole card links to the stall */
.report-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.report-card:hover,
.report-card:focus-within {
  transform: translateY(-2px);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.1) !important;
}
</style>
