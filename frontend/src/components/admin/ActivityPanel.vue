<script setup>
// Admin page: the activity log — which admin approved, removed, deleted or banned what, and when.
import { onMounted, ref } from 'vue'
import AdminRow from './AdminRow.vue'
import LoadingState from '../LoadingState.vue'
import ErrorState from '../ErrorState.vue'
import { getActivity } from '../../services/adminService.js'
import { ACTION_ICONS, formatDateTime } from '../../utils/admin.js'
import { timeAgo } from '../../utils/time.js'

const entries = ref([])
const loading = ref(true)
const errorMessage = ref('')

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    entries.value = await getActivity()
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section aria-label="Activity log" data-testid="admin-activity">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <p class="small text-secondary mb-0">The newest 100 admin actions, including deletions made on stall and centre pages.</p>
      <button type="button" class="btn btn-sm btn-outline-dark" v-on:click="load">
        <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Refresh
      </button>
    </div>

    <LoadingState v-if="loading && !entries.length" message="Loading the activity log..." />
    <ErrorState v-else-if="errorMessage" :message="errorMessage" retryable @retry="load" />
    <div v-else-if="!entries.length" class="hw-surface p-3">No admin actions yet.</div>
    <ul v-else class="list-unstyled d-grid gap-2 mb-0" :class="{ 'opacity-50': loading }">
      <AdminRow v-for="entry in entries" :key="entry._id" data-testid="admin-activity-entry">
        <div class="d-flex gap-2">
          <i class="bi text-secondary" :class="ACTION_ICONS[entry.action] || 'bi-dot'" aria-hidden="true"></i>
          <div class="min-w-0">
            <p class="small mb-0 text-break">{{ entry.summary }}</p>
            <p class="small text-secondary mb-0">
              By {{ entry.admin ? entry.admin.name : 'a deleted admin' }} ·
              <time :datetime="entry.createdAt" :title="formatDateTime(entry.createdAt)">{{ timeAgo(entry.createdAt) }}</time>
            </p>
          </div>
        </div>
      </AdminRow>
    </ul>
  </section>
</template>
