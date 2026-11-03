<script setup>
// Admin page: stalls diners added, waiting for an admin to approve (list them) or reject (delete them).
// Emits changed() after each approval or rejection (to recount the tiles) and manage-user(email).
import { onMounted, ref } from 'vue'
import AdminRow from './AdminRow.vue'
import ConfirmBar from './ConfirmBar.vue'
import LoadingState from '../LoadingState.vue'
import ErrorState from '../ErrorState.vue'
import { approveStall, getAdminStalls, rejectStall } from '../../services/adminService.js'
import { useAdminAction } from './useAdminAction.js'
import { addedByText, stallDetails } from '../../utils/admin.js'
import { timeAgo } from '../../utils/time.js'

const emit = defineEmits(['changed', 'manage-user'])
const { confirming, busy, notice, run, errorFor } = useAdminAction(() => emit('changed'))

const stalls = ref([])
const loading = ref(true)
const errorMessage = ref('')

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    stalls.value = await getAdminStalls({ status: 'pending' })
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}

const drop = (stall) => { stalls.value = stalls.value.filter((item) => item._id !== stall._id) }

function approve(stall) {
  run(`approve:${stall._id}`, () => approveStall(stall._id), () => {
    drop(stall)
    return `${stall.name} is now listed at ${stall.hawkerCentre?.name || 'its centre'}.`
  })
}

function reject(stall) {
  run(`reject:${stall._id}`, () => rejectStall(stall._id), () => {
    drop(stall)
    return `${stall.name} was rejected and deleted.`
  })
}

onMounted(load)
</script>

<template>
  <section aria-label="Stall approvals" data-testid="admin-approvals">
    <p v-if="notice" class="hw-surface p-3 small" role="status">{{ notice }}</p>

    <LoadingState v-if="loading" message="Loading stalls waiting for approval..." />
    <ErrorState v-else-if="errorMessage" :message="errorMessage" retryable @retry="load" />
    <div v-else-if="!stalls.length" class="hw-surface p-3">No stalls are waiting for approval.</div>
    <ul v-else class="list-unstyled d-grid gap-2 mb-0">
      <AdminRow v-for="stall in stalls" :key="stall._id" data-testid="admin-pending-stall">
        <h2 class="h6 mb-1">{{ stall.name }}</h2>
        <p v-if="stallDetails(stall)" class="small text-secondary mb-1">{{ stallDetails(stall) }}</p>
        <p class="small mb-1">
          <i class="bi bi-shop me-1" aria-hidden="true"></i>
          <RouterLink v-if="stall.hawkerCentre" :to="`/hawker-centres/${stall.hawkerCentre._id}`">{{ stall.hawkerCentre.name }}</RouterLink>
        </p>
        <p class="small text-secondary mb-0">
          Added by {{ addedByText(stall) }} · {{ timeAgo(stall.createdAt) }}
          <button v-if="stall.addedBy" type="button" class="btn btn-link btn-sm p-0 ms-1 align-baseline" v-on:click="emit('manage-user', stall.addedBy.email)">Manage user</button>
        </p>

        <template #actions>
          <button type="button" class="btn btn-sm hw-btn-primary" :disabled="Boolean(busy)" v-on:click="approve(stall)">
            <i class="bi bi-check-lg me-1" aria-hidden="true"></i>{{ busy === `approve:${stall._id}` ? 'Approving...' : 'Approve' }}
          </button>
          <button type="button" class="btn btn-sm btn-outline-dark" :disabled="Boolean(busy)" v-on:click="confirming = `reject:${stall._id}`">
            <i class="bi bi-x-lg me-1" aria-hidden="true"></i>Reject
          </button>
        </template>

        <template #footer>
          <ConfirmBar
            v-if="confirming === `reject:${stall._id}`"
            :message="`Reject ${stall.name}? It will be deleted.`"
            label="Reject"
            busy-label="Rejecting..."
            :busy="busy === `reject:${stall._id}`"
            @confirm="reject(stall)"
            @cancel="confirming = ''"
          />
          <p v-if="errorFor(`approve:${stall._id}`) || errorFor(`reject:${stall._id}`)" class="small text-brick mt-2 mb-0" role="alert">
            {{ errorFor(`approve:${stall._id}`) || errorFor(`reject:${stall._id}`) }}
          </p>
        </template>
      </AdminRow>
    </ul>
  </section>
</template>
