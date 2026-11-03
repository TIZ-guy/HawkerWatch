<script setup>
// Admin page (admins only). Each tab is a panel in components/admin/:
// approve stalls diners added, remove and restore stalls, moderate everything diners post,
// suspend users or make them admins, and see the activity log. The NEA data refresh is here too.
import { computed, onMounted, ref } from 'vue'
import ApprovalsPanel from '../components/admin/ApprovalsPanel.vue'
import StallsPanel from '../components/admin/StallsPanel.vue'
import ModerationPanel from '../components/admin/ModerationPanel.vue'
import UsersPanel from '../components/admin/UsersPanel.vue'
import ActivityPanel from '../components/admin/ActivityPanel.vue'
import { getOverview, importCentres } from '../services/adminService.js'

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
  { label: 'Live reports', value: overview.value.liveReports, tab: 'moderation' },
  {
    label: 'Live posts flagged',
    value: overview.value.flaggedReports + overview.value.flaggedFoodUpdates,
    tab: 'moderation',
    highlight: overview.value.flaggedReports + overview.value.flaggedFoodUpdates > 0
  },
  { label: 'Users', value: overview.value.users, tab: 'users' },
  { label: 'Banned users', value: overview.value.bannedUsers, tab: 'users' }
])

const TABS = [
  { value: 'approvals', label: 'Stall approvals' },
  { value: 'stalls', label: 'Stalls' },
  { value: 'moderation', label: 'Moderation' },
  { value: 'users', label: 'Users' },
  { value: 'activity', label: 'Activity log' },
  { value: 'data', label: 'NEA data' }
]
const activeTab = ref('approvals')

// "Manage user" on any post or stall opens that person on the Users tab
const userSearch = ref('')
function manageUser(email) {
  userSearch.value = email
  activeTab.value = 'users'
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

onMounted(loadOverview)
</script>

<template>
  <main class="container py-4">
    <h1 class="display-6 mb-2">Admin</h1>
    <p class="text-secondary mb-4">Approve the stalls diners add, moderate what they post, and manage users.</p>

    <!-- Overview -->
    <div v-if="tiles" class="row g-3 mb-4" data-testid="admin-overview">
      <div v-for="tile in tiles" :key="tile.label" class="col-6 col-md-4 col-xl-2">
        <button
          type="button"
          class="hw-surface p-3 w-100 h-100 text-start tile"
          :class="{ 'tile-alert': tile.highlight }"
          v-on:click="activeTab = tile.tab"
        >
          <span class="d-block hw-mono fs-4" :class="{ 'text-brick': tile.highlight }">{{ tile.value.toLocaleString() }}</span>
          <span class="small text-secondary">{{ tile.label }}</span>
        </button>
      </div>
    </div>

    <ul class="nav nav-underline mb-3 flex-nowrap overflow-x-auto" role="tablist">
      <li v-for="tab in TABS" :key="tab.value" class="nav-item" role="presentation">
        <button
          type="button"
          class="nav-link text-nowrap"
          :class="{ active: activeTab === tab.value }"
          role="tab"
          :aria-selected="activeTab === tab.value"
          v-on:click="activeTab = tab.value"
        >
          {{ tab.label }}
          <span v-if="tab.value === 'approvals' && overview?.pendingStalls" class="badge rounded-pill text-bg-danger ms-1">{{ overview.pendingStalls }}</span>
        </button>
      </li>
    </ul>

    <ApprovalsPanel v-if="activeTab === 'approvals'" @changed="loadOverview" @manage-user="manageUser" />
    <StallsPanel v-else-if="activeTab === 'stalls'" @changed="loadOverview" @manage-user="manageUser" />
    <ModerationPanel v-else-if="activeTab === 'moderation'" @changed="loadOverview" @manage-user="manageUser" />
    <UsersPanel v-else-if="activeTab === 'users'" v-model:search="userSearch" @changed="loadOverview" />
    <ActivityPanel v-else-if="activeTab === 'activity'" />

    <section v-else class="hw-surface p-4" aria-label="NEA data">
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

.tile:hover,
.tile:focus-visible {
  border-color: var(--line-strong);
  background: var(--sub);
}

.tile-alert {
  border-color: var(--brick);
}
</style>
