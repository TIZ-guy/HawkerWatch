<script setup>
// Admin page (admins only): approve or reject stalls users added, remove and restore stalls,
// remove community reports, and refresh the NEA centre data.
import { computed, onMounted, ref, watch } from 'vue'
import FilterChips from '../components/FilterChips.vue'
import SearchBar from '../components/SearchBar.vue'
import StatusBadge from '../components/StatusBadge.vue'
import LoadingState from '../components/LoadingState.vue'
import ErrorState from '../components/ErrorState.vue'
import { removeStall } from '../services/hawkerService.js'
import {
  approveStall, deleteReport, getAdminReports, getAdminStalls, getOverview, importCentres, rejectStall, restoreStall
} from '../services/adminService.js'
import { timeAgo } from '../utils/time.js'

const SEARCH_DELAY_MS = 300

const overview = ref(null)

async function loadOverview() {
  try {
    overview.value = await getOverview()
  } catch {
    overview.value = null // the tiles stay out; each tab shows its own error
  }
}

const tiles = computed(() => overview.value && [
  { label: 'Waiting for approval', value: overview.value.pendingStalls, tab: 'approvals', highlight: overview.value.pendingStalls > 0 },
  { label: 'Listed stalls', value: overview.value.listedStalls, tab: 'stalls' },
  { label: 'Live reports', value: overview.value.liveReports, tab: 'reports' },
  { label: 'Live reports flagged', value: overview.value.flaggedReports, tab: 'reports', highlight: overview.value.flaggedReports > 0 },
  { label: 'Users', value: overview.value.users }
])

const TABS = [
  { value: 'approvals', label: 'Stall approvals' },
  { value: 'stalls', label: 'Stalls' },
  { value: 'reports', label: 'Reports' },
  { value: 'data', label: 'NEA data' }
]
const activeTab = ref('approvals')

// One confirm prompt open at a time, e.g. 'reject:<id>'; the button that is busy has the same key
const confirming = ref('')
const busy = ref('')
const actionError = ref({ key: '', message: '' })
const notice = ref('')

// Runs an approve/reject/remove/restore, then drops the item from its list and recounts the tiles
async function run(key, action, onDone) {
  busy.value = key
  actionError.value = { key: '', message: '' }
  try {
    await action()
    confirming.value = ''
    onDone()
    loadOverview()
  } catch (error) {
    actionError.value = { key, message: error.message }
  } finally {
    busy.value = ''
  }
}

// Stall approvals
const pending = ref([])
const pendingLoading = ref(true)
const pendingError = ref('')

async function loadPending() {
  pendingLoading.value = true
  pendingError.value = ''
  try {
    pending.value = await getAdminStalls({ status: 'pending' })
  } catch (error) {
    pendingError.value = error.message
  } finally {
    pendingLoading.value = false
  }
}

const dropPending = (stall) => { pending.value = pending.value.filter((item) => item._id !== stall._id) }

function approve(stall) {
  run(`approve:${stall._id}`, () => approveStall(stall._id), () => {
    dropPending(stall)
    notice.value = `${stall.name} is now listed at ${stall.hawkerCentre?.name || 'its centre'}.`
  })
}

function reject(stall) {
  run(`reject:${stall._id}`, () => rejectStall(stall._id), () => {
    dropPending(stall)
    notice.value = `${stall.name} was rejected and deleted.`
  })
}

// Listed and removed stalls
const STALL_VIEWS = [
  { value: 'listed', label: 'Listed' },
  { value: 'removed', label: 'Removed' }
]
const stallView = ref('listed')
const stallSearch = ref('')
const stalls = ref([])
const stallsLoading = ref(false)
const stallsError = ref('')
let stallsLoaded = false

async function loadStalls() {
  stallsLoading.value = true
  stallsError.value = ''
  try {
    stalls.value = await getAdminStalls({ status: stallView.value, search: stallSearch.value.trim() })
    stallsLoaded = true
  } catch (error) {
    stallsError.value = error.message
  } finally {
    stallsLoading.value = false
  }
}

watch(stallView, (value) => {
  if (!value) stallView.value = 'listed' // clicking the chosen view again keeps it
  else loadStalls()
})

let searchTimer
watch(stallSearch, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadStalls, SEARCH_DELAY_MS)
})

const dropStall = (stall) => { stalls.value = stalls.value.filter((item) => item._id !== stall._id) }

function remove(stall) {
  run(`remove:${stall._id}`, () => removeStall(stall._id), () => {
    dropStall(stall)
    notice.value = `${stall.name} was removed. You can bring it back from Removed.`
  })
}

function restore(stall) {
  run(`restore:${stall._id}`, () => restoreStall(stall._id), () => {
    dropStall(stall)
    notice.value = `${stall.name} is listed again.`
  })
}

// Reports
const REPORT_VIEWS = [
  { value: 'flagged', label: 'Flagged', icon: 'bi-flag' },
  { value: 'all', label: 'All recent' }
]
const reportView = ref('flagged')
const reports = ref([])
const hideThreshold = ref(3)
const reportsLoading = ref(false)
const reportsError = ref('')
let reportsLoaded = false

async function loadReports() {
  reportsLoading.value = true
  reportsError.value = ''
  try {
    const result = await getAdminReports({ flagged: reportView.value === 'flagged' })
    reports.value = result.reports
    hideThreshold.value = result.hideThreshold
    reportsLoaded = true
  } catch (error) {
    reportsError.value = error.message
  } finally {
    reportsLoading.value = false
  }
}

watch(reportView, (value) => {
  if (!value) reportView.value = 'flagged'
  else loadReports()
})

function reportState(report) {
  if (report.hidden) return { label: 'Hidden by flags', className: 'text-brick' }
  if (report.live) return { label: 'Live', className: 'text-success' }
  return { label: 'Expired', className: 'text-secondary' }
}

function removeReport(report) {
  run(`report:${report.id}`, () => deleteReport(report.id), () => {
    reports.value = reports.value.filter((item) => item.id !== report.id)
    notice.value = `The report on ${report.stall?.name || 'that stall'} was removed.`
  })
}

// NEA data
const importing = ref(false)
const importResult = ref('')
const importError = ref('')

async function runImport() {
  importing.value = true
  importResult.value = ''
  importError.value = ''
  try {
    const result = await importCentres()
    importResult.value = `Done: ${result.recordsFetched} centres fetched, ${result.recordsCreated} added, ${result.recordsUpdated} updated.`
  } catch (error) {
    importError.value = error.message
  } finally {
    importing.value = false
  }
}

// Each tab loads the first time it is opened
watch(activeTab, (tab) => {
  confirming.value = ''
  notice.value = ''
  if (tab === 'stalls' && !stallsLoaded) loadStalls()
  if (tab === 'reports' && !reportsLoaded) loadReports()
})

onMounted(() => {
  loadOverview()
  loadPending()
})

const stallDetails = (stall) => [stall.speciality, stall.cuisine, stall.unitNumber && `#${stall.unitNumber}`].filter(Boolean).join(' · ')
const addedByText = (stall) => stall.addedBy ? `${stall.addedBy.name} (${stall.addedBy.email})` : 'unknown user'
</script>

<template>
  <main class="container py-4">
    <h1 class="display-6 mb-2">Admin</h1>
    <p class="text-secondary mb-4">Approve the stalls diners add, and remove stalls and reports that shouldn't be here.</p>

    <!-- Overview -->
    <div v-if="tiles" class="row g-3 mb-4" data-testid="admin-overview">
      <div v-for="tile in tiles" :key="tile.label" class="col-6 col-md-4 col-lg">
        <component
          :is="tile.tab ? 'button' : 'div'"
          :type="tile.tab ? 'button' : undefined"
          class="hw-surface p-3 w-100 h-100 text-start tile"
          :class="{ 'tile-alert': tile.highlight }"
          v-on:click="tile.tab && (activeTab = tile.tab)"
        >
          <span class="d-block hw-mono fs-4" :class="{ 'text-brick': tile.highlight }">{{ tile.value.toLocaleString() }}</span>
          <span class="small text-secondary">{{ tile.label }}</span>
        </component>
      </div>
    </div>

    <ul class="nav nav-underline mb-3" role="tablist">
      <li v-for="tab in TABS" :key="tab.value" class="nav-item" role="presentation">
        <button
          type="button"
          class="nav-link"
          :class="{ active: activeTab === tab.value }"
          role="tab"
          :aria-selected="activeTab === tab.value"
          v-on:click="activeTab = tab.value"
        >
          {{ tab.label }}
          <span v-if="tab.value === 'approvals' && pending.length" class="badge rounded-pill text-bg-danger ms-1">{{ pending.length }}</span>
        </button>
      </li>
    </ul>

    <p v-if="notice" class="hw-surface p-3 small" role="status">{{ notice }}</p>

    <!-- Stall approvals -->
    <section v-if="activeTab === 'approvals'" aria-label="Stall approvals" data-testid="admin-approvals">
      <LoadingState v-if="pendingLoading" message="Loading stalls waiting for approval..." />
      <ErrorState v-else-if="pendingError" :message="pendingError" retryable @retry="loadPending" />
      <div v-else-if="!pending.length" class="hw-surface p-3">No stalls are waiting for approval.</div>
      <ul v-else class="list-unstyled d-grid gap-2 mb-0">
        <li v-for="stall in pending" :key="stall._id" class="hw-surface p-3" data-testid="admin-pending-stall">
          <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div class="min-w-0">
              <h2 class="h6 mb-1">{{ stall.name }}</h2>
              <p v-if="stallDetails(stall)" class="small text-secondary mb-1">{{ stallDetails(stall) }}</p>
              <p class="small mb-1">
                <i class="bi bi-shop me-1" aria-hidden="true"></i>
                <RouterLink v-if="stall.hawkerCentre" :to="`/hawker-centres/${stall.hawkerCentre._id}`">{{ stall.hawkerCentre.name }}</RouterLink>
              </p>
              <p class="small text-secondary mb-0">Added by {{ addedByText(stall) }} · {{ timeAgo(stall.createdAt) }}</p>
            </div>
            <div class="d-flex flex-wrap gap-2">
              <button type="button" class="btn btn-sm hw-btn-primary" :disabled="Boolean(busy)" v-on:click="approve(stall)">
                <i class="bi bi-check-lg me-1" aria-hidden="true"></i>{{ busy === `approve:${stall._id}` ? 'Approving...' : 'Approve' }}
              </button>
              <button v-if="confirming !== `reject:${stall._id}`" type="button" class="btn btn-sm btn-outline-dark" :disabled="Boolean(busy)" v-on:click="confirming = `reject:${stall._id}`">
                <i class="bi bi-x-lg me-1" aria-hidden="true"></i>Reject
              </button>
            </div>
          </div>
          <div v-if="confirming === `reject:${stall._id}`" class="alert alert-warning d-flex flex-wrap align-items-center gap-2 mt-3 mb-0">
            <span>Reject {{ stall.name }}? It will be deleted.</span>
            <button type="button" class="btn btn-sm btn-outline-dark" :disabled="Boolean(busy)" v-on:click="reject(stall)">
              {{ busy === `reject:${stall._id}` ? 'Rejecting...' : 'Reject' }}
            </button>
            <button type="button" class="btn btn-sm btn-link text-secondary" v-on:click="confirming = ''">Cancel</button>
          </div>
          <p v-if="actionError.key.endsWith(stall._id)" class="small text-brick mt-2 mb-0" role="alert">{{ actionError.message }}</p>
        </li>
      </ul>
    </section>

    <!-- Listed and removed stalls -->
    <section v-if="activeTab === 'stalls'" aria-label="Stalls" data-testid="admin-stalls">
      <div class="d-grid gap-2 mb-3">
        <SearchBar v-model="stallSearch" id="admin-stall-search" label="Search stalls" placeholder="Stall name or dish" />
        <FilterChips v-model="stallView" :options="STALL_VIEWS" label="Which stalls" small />
      </div>

      <LoadingState v-if="stallsLoading && !stalls.length" message="Loading stalls..." />
      <ErrorState v-else-if="stallsError" :message="stallsError" retryable @retry="loadStalls" />
      <div v-else-if="!stalls.length" class="hw-surface p-3">No {{ stallView }} stalls{{ stallSearch ? ' match your search' : '' }}.</div>
      <template v-else>
        <p class="small text-secondary">Newest first, showing up to 100. Search to find older ones.</p>
        <ul class="list-unstyled d-grid gap-2 mb-0" :class="{ 'opacity-50': stallsLoading }">
          <li v-for="stall in stalls" :key="stall._id" class="hw-surface p-3">
            <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
              <div class="min-w-0">
                <h2 class="h6 mb-1">
                  <RouterLink v-if="stallView === 'listed'" :to="`/stalls/${stall._id}`" class="text-reset">{{ stall.name }}</RouterLink>
                  <template v-else>{{ stall.name }}</template>
                </h2>
                <p class="small text-secondary mb-0">
                  {{ stall.hawkerCentre?.name }}<template v-if="stallDetails(stall)"> · {{ stallDetails(stall) }}</template>
                </p>
                <p class="small text-secondary mb-0">Added by {{ addedByText(stall) }}</p>
              </div>
              <button v-if="stallView === 'removed'" type="button" class="btn btn-sm btn-outline-dark" :disabled="Boolean(busy)" v-on:click="restore(stall)">
                <i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>{{ busy === `restore:${stall._id}` ? 'Restoring...' : 'Restore' }}
              </button>
              <button v-else-if="confirming !== `remove:${stall._id}`" type="button" class="btn btn-sm btn-outline-secondary" :disabled="Boolean(busy)" v-on:click="confirming = `remove:${stall._id}`">
                <i class="bi bi-trash me-1" aria-hidden="true"></i>Remove
              </button>
            </div>
            <div v-if="confirming === `remove:${stall._id}`" class="alert alert-warning d-flex flex-wrap align-items-center gap-2 mt-3 mb-0">
              <span>Remove {{ stall.name }}? It will be hidden everywhere; its reviews are kept.</span>
              <button type="button" class="btn btn-sm btn-outline-dark" :disabled="Boolean(busy)" v-on:click="remove(stall)">
                {{ busy === `remove:${stall._id}` ? 'Removing...' : 'Remove' }}
              </button>
              <button type="button" class="btn btn-sm btn-link text-secondary" v-on:click="confirming = ''">Cancel</button>
            </div>
            <p v-if="actionError.key.endsWith(stall._id)" class="small text-brick mt-2 mb-0" role="alert">{{ actionError.message }}</p>
          </li>
        </ul>
      </template>
    </section>

    <!-- Reports -->
    <section v-if="activeTab === 'reports'" aria-label="Reports" data-testid="admin-reports">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <FilterChips v-model="reportView" :options="REPORT_VIEWS" label="Which reports" small />
        <button type="button" class="btn btn-sm btn-outline-dark" v-on:click="loadReports">
          <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Refresh
        </button>
      </div>
      <p class="small text-secondary">
        Newest first, expired ones included. A report flagged by {{ hideThreshold }} users is hidden automatically; remove it to delete it for good.
      </p>

      <LoadingState v-if="reportsLoading && !reports.length" message="Loading reports..." />
      <ErrorState v-else-if="reportsError" :message="reportsError" retryable @retry="loadReports" />
      <div v-else-if="!reports.length" class="hw-surface p-3">No {{ reportView === 'flagged' ? 'flagged ' : '' }}reports.</div>
      <ul v-else class="list-unstyled d-grid gap-2 mb-0" :class="{ 'opacity-50': reportsLoading }">
        <li v-for="report in reports" :key="report.id" class="hw-surface p-3" data-testid="admin-report">
          <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div class="min-w-0">
              <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                <StatusBadge :status="report.status" />
                <span class="small fw-semibold" :class="reportState(report).className">{{ reportState(report).label }}</span>
                <span v-if="report.flagCount" class="small text-brick">
                  <i class="bi bi-flag-fill me-1" aria-hidden="true"></i>{{ report.flagCount }} flag{{ report.flagCount === 1 ? '' : 's' }}
                </span>
              </div>
              <p class="small mb-0">
                <strong>{{ report.stall?.name || 'Deleted stall' }}</strong>
                <span class="text-secondary"> · {{ report.hawkerCentre?.name || 'Deleted centre' }}</span>
              </p>
              <p class="small text-secondary mb-0">
                By {{ report.user ? `${report.user.name} (${report.user.email})` : 'deleted user' }} · {{ timeAgo(report.createdAt) }}
              </p>
            </div>
            <button v-if="confirming !== `report:${report.id}`" type="button" class="btn btn-sm btn-outline-secondary" :disabled="Boolean(busy)" v-on:click="confirming = `report:${report.id}`">
              <i class="bi bi-trash me-1" aria-hidden="true"></i>Remove
            </button>
          </div>
          <div v-if="confirming === `report:${report.id}`" class="alert alert-warning d-flex flex-wrap align-items-center gap-2 mt-3 mb-0">
            <span>Remove this report for good?</span>
            <button type="button" class="btn btn-sm btn-outline-dark" :disabled="Boolean(busy)" v-on:click="removeReport(report)">
              {{ busy === `report:${report.id}` ? 'Removing...' : 'Remove' }}
            </button>
            <button type="button" class="btn btn-sm btn-link text-secondary" v-on:click="confirming = ''">Cancel</button>
          </div>
          <p v-if="actionError.key === `report:${report.id}`" class="small text-brick mt-2 mb-0" role="alert">{{ actionError.message }}</p>
        </li>
      </ul>
    </section>

    <!-- NEA data -->
    <section v-if="activeTab === 'data'" class="hw-surface p-4" aria-label="NEA data">
      <h2 class="h6">Hawker centres and closures</h2>
      <p class="small text-secondary">
        The server imports NEA's centres and cleaning and works closures from data.gov.sg every week by itself.
        Refresh now if NEA has just published new closures. It takes a few seconds; nothing is deleted.
      </p>
      <button type="button" class="btn btn-sm hw-btn-primary" :disabled="importing" v-on:click="runImport">
        <i class="bi bi-cloud-download me-1" aria-hidden="true"></i>{{ importing ? 'Importing...' : 'Refresh NEA data now' }}
      </button>
      <p v-if="importResult" class="small mt-3 mb-0" role="status">{{ importResult }}</p>
      <p v-if="importError" class="small text-brick mt-3 mb-0" role="alert">{{ importError }}</p>
    </section>
  </main>
</template>

<style scoped>
.tile {
  color: inherit;
}

button.tile:hover,
button.tile:focus-visible {
  border-color: var(--line-strong);
  background: var(--sub);
}

.tile-alert {
  border-color: var(--brick);
}
</style>
