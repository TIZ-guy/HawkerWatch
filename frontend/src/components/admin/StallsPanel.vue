<script setup>
// Admin page: listed stalls (to remove) and removed stalls (to restore), with a search.
// Emits changed() after each removal or restore, and manage-user(email).
import { onMounted, ref, watch } from 'vue'
import AdminRow from './AdminRow.vue'
import ConfirmBar from './ConfirmBar.vue'
import FilterChips from '../FilterChips.vue'
import SearchBar from '../SearchBar.vue'
import LoadingState from '../LoadingState.vue'
import ErrorState from '../ErrorState.vue'
import { removeStall } from '../../services/hawkerService.js'
import { getAdminStalls, restoreStall } from '../../services/adminService.js'
import { useAdminAction } from './useAdminAction.js'
import { addedByText, stallDetails } from '../../utils/admin.js'

const SEARCH_DELAY_MS = 300
const VIEWS = [
  { value: 'listed', label: 'Listed' },
  { value: 'removed', label: 'Removed' }
]

const emit = defineEmits(['changed', 'manage-user'])
const { confirming, busy, notice, run, errorFor } = useAdminAction(() => emit('changed'))

const view = ref('listed')
const search = ref('')
const stalls = ref([])
const loading = ref(true)
const errorMessage = ref('')

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    stalls.value = await getAdminStalls({ status: view.value, search: search.value.trim() })
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}

watch(view, (value, previous) => {
  if (!value) view.value = previous // clicking the chosen view again keeps it
  else load()
})

let searchTimer
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(load, SEARCH_DELAY_MS)
})

const drop = (stall) => { stalls.value = stalls.value.filter((item) => item._id !== stall._id) }

function remove(stall) {
  run(`remove:${stall._id}`, () => removeStall(stall._id), () => {
    drop(stall)
    return `${stall.name} was removed. You can bring it back from Removed.`
  })
}

function restore(stall) {
  run(`restore:${stall._id}`, () => restoreStall(stall._id), () => {
    drop(stall)
    return `${stall.name} is listed again.`
  })
}

onMounted(load)
</script>

<template>
  <section aria-label="Stalls" data-testid="admin-stalls">
    <div class="d-grid gap-2 mb-3">
      <SearchBar v-model="search" id="admin-stall-search" label="Search stalls" placeholder="Stall name or dish" />
      <FilterChips v-model="view" :options="VIEWS" label="Which stalls" small />
    </div>
    <p v-if="notice" class="hw-surface p-3 small" role="status">{{ notice }}</p>

    <LoadingState v-if="loading && !stalls.length" message="Loading stalls..." />
    <ErrorState v-else-if="errorMessage" :message="errorMessage" retryable @retry="load" />
    <div v-else-if="!stalls.length" class="hw-surface p-3">No {{ view }} stalls{{ search ? ' match your search' : '' }}.</div>
    <template v-else>
      <p class="small text-secondary">Newest first, showing up to 100. Search to find older ones.</p>
      <ul class="list-unstyled d-grid gap-2 mb-0" :class="{ 'opacity-50': loading }">
        <AdminRow v-for="stall in stalls" :key="stall._id">
          <h2 class="h6 mb-1">
            <RouterLink v-if="view === 'listed'" :to="`/stalls/${stall._id}`" class="text-reset">{{ stall.name }}</RouterLink>
            <template v-else>{{ stall.name }}</template>
          </h2>
          <p class="small text-secondary mb-0">
            {{ stall.hawkerCentre?.name }}<template v-if="stallDetails(stall)"> · {{ stallDetails(stall) }}</template>
          </p>
          <p class="small text-secondary mb-0">
            Added by {{ addedByText(stall) }}
            <button v-if="stall.addedBy" type="button" class="btn btn-link btn-sm p-0 ms-1 align-baseline" v-on:click="emit('manage-user', stall.addedBy.email)">Manage user</button>
          </p>

          <template #actions>
            <button v-if="view === 'removed'" type="button" class="btn btn-sm btn-outline-dark" :disabled="Boolean(busy)" v-on:click="restore(stall)">
              <i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>{{ busy === `restore:${stall._id}` ? 'Restoring...' : 'Restore' }}
            </button>
            <button v-else type="button" class="btn btn-sm btn-outline-secondary" :disabled="Boolean(busy)" v-on:click="confirming = `remove:${stall._id}`">
              <i class="bi bi-trash me-1" aria-hidden="true"></i>Remove
            </button>
          </template>

          <template #footer>
            <ConfirmBar
              v-if="confirming === `remove:${stall._id}`"
              :message="`Remove ${stall.name}? It will be hidden everywhere; its reviews are kept.`"
              label="Remove"
              busy-label="Removing..."
              :busy="busy === `remove:${stall._id}`"
              @confirm="remove(stall)"
              @cancel="confirming = ''"
            />
            <p v-if="errorFor(`remove:${stall._id}`) || errorFor(`restore:${stall._id}`)" class="small text-brick mt-2 mb-0" role="alert">
              {{ errorFor(`remove:${stall._id}`) || errorFor(`restore:${stall._id}`) }}
            </p>
          </template>
        </AdminRow>
      </ul>
    </template>
  </section>
</template>
