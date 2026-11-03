<script setup>
// Admin page: find users, suspend or ban them from posting (and lift bans), and make them admins or not.
// You can't ban yourself or change your own role, and admins can't be banned until their admin role is removed.
// v-model:search lets other panels open a user here ("Manage user"). Emits changed() after each change.
import { onMounted, ref, watch } from 'vue'
import AdminRow from './AdminRow.vue'
import ConfirmBar from './ConfirmBar.vue'
import FilterChips from '../FilterChips.vue'
import SearchBar from '../SearchBar.vue'
import LoadingState from '../LoadingState.vue'
import ErrorState from '../ErrorState.vue'
import { banUser, getAdminUsers, setUserRole, unbanUser } from '../../services/adminService.js'
import { useAuthStore } from '../../stores/useAuthStore.js'
import { useAdminAction } from './useAdminAction.js'
import { banText, formatDateTime } from '../../utils/admin.js'

const SEARCH_DELAY_MS = 300
const FILTERS = [
  { value: 'admins', label: 'Admins', icon: 'bi-shield-lock' },
  { value: 'banned', label: 'Banned', icon: 'bi-slash-circle' }
]
const BAN_LENGTHS = [
  { value: '1', label: '1 day' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: 'permanent', label: 'Permanently' }
]
const BAN_REASON_MAX_LENGTH = 200 // same as backend/utils/banUtils.js

const search = defineModel('search', { type: String, default: '' })
const emit = defineEmits(['changed'])
const auth = useAuthStore()
const { confirming, busy, notice, run, errorFor } = useAdminAction(() => emit('changed'))

const filter = ref('')
const users = ref([])
const loading = ref(true)
const errorMessage = ref('')

let latestRequest = 0
async function load() {
  const request = ++latestRequest
  loading.value = true
  errorMessage.value = ''
  try {
    const found = await getAdminUsers({ search: search.value.trim(), filter: filter.value })
    if (request === latestRequest) users.value = found
  } catch (error) {
    if (request === latestRequest) errorMessage.value = error.message
  } finally {
    if (request === latestRequest) loading.value = false
  }
}

watch(filter, load)

let searchTimer
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(load, SEARCH_DELAY_MS)
})

const isMe = (user) => String(user._id) === String(auth.user?._id)

// Puts the changed user back in the list, keeping the post counts the list came with
function replace(user, changes) {
  users.value = users.value.map((item) => (item._id === user._id ? { ...item, ...changes } : item))
}

// Ban form, shown in the confirm bar
const banLength = ref('7')
const banReason = ref('')
watch(banLength, (value, previous) => { if (!value) banLength.value = previous }) // clicking the chosen length again keeps it

function startBan(user) {
  banLength.value = '7'
  banReason.value = ''
  confirming.value = `ban:${user._id}`
}

function ban(user) {
  const days = banLength.value === 'permanent' ? null : Number(banLength.value)
  run(`ban:${user._id}`, () => banUser(user._id, { days, reason: banReason.value }), (updated) => {
    replace(user, updated)
    return days ? `${user.name} can't post for ${days} day${days === 1 ? '' : 's'}.` : `${user.name} is banned from posting.`
  })
}

function unban(user) {
  run(`unban:${user._id}`, () => unbanUser(user._id), (updated) => {
    replace(user, updated)
    return `${user.name} can post again.`
  })
}

function changeRole(user) {
  const role = user.role === 'admin' ? 'user' : 'admin'
  run(`role:${user._id}`, () => setUserRole(user._id, role), (updated) => {
    // Making someone an admin also lifts their ban (admins can't be banned)
    replace(user, role === 'admin' ? { ...updated, banned: false, permanentBan: false } : updated)
    return role === 'admin' ? `${user.name} is now an admin.` : `${user.name} is no longer an admin.`
  })
}

const postCounts = (posts) => [
  `${posts.reports} report${posts.reports === 1 ? '' : 's'}`,
  `${posts.reviews} review${posts.reviews === 1 ? '' : 's'}`,
  `${posts.comments} comment${posts.comments === 1 ? '' : 's'}`
].join(' · ')

onMounted(load)
</script>

<template>
  <section aria-label="Users" data-testid="admin-users">
    <div class="d-grid gap-2 mb-3">
      <SearchBar v-model="search" id="admin-user-search" label="Search users" placeholder="Name or email" />
      <FilterChips v-model="filter" :options="FILTERS" label="Which users" small />
    </div>
    <p class="small text-secondary">
      Suspended and banned users can still log in and browse, but can't post reports, food updates, reviews, comments or stalls.
    </p>
    <p v-if="notice" class="hw-surface p-3 small" role="status">{{ notice }}</p>

    <LoadingState v-if="loading && !users.length" message="Loading users..." />
    <ErrorState v-else-if="errorMessage" :message="errorMessage" retryable @retry="load" />
    <div v-else-if="!users.length" class="hw-surface p-3">No users match.</div>
    <ul v-else class="list-unstyled d-grid gap-2 mb-0" :class="{ 'opacity-50': loading }">
      <AdminRow v-for="user in users" :key="user._id" data-testid="admin-user">
        <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
          <h2 class="h6 mb-0">{{ user.name }}</h2>
          <span v-if="user.role === 'admin'" class="badge text-bg-dark">Admin</span>
          <span v-if="isMe(user)" class="badge text-bg-light border">You</span>
          <span v-if="user.banned" class="badge text-bg-danger">{{ banText(user) }}</span>
        </div>
        <p class="small mb-0 text-break">{{ user.email }}</p>
        <p class="small text-secondary mb-0">Joined {{ formatDateTime(user.createdAt) }} · {{ postCounts(user.posts) }}</p>
        <p v-if="user.banned && user.banReason" class="small text-brick mb-0">Reason: {{ user.banReason }}</p>

        <template v-if="!isMe(user)" #actions>
          <template v-if="user.role !== 'admin'">
            <button v-if="user.banned" type="button" class="btn btn-sm btn-outline-dark" :disabled="Boolean(busy)" v-on:click="unban(user)">
              <i class="bi bi-person-check me-1" aria-hidden="true"></i>{{ busy === `unban:${user._id}` ? 'Lifting...' : 'Lift ban' }}
            </button>
            <button v-else type="button" class="btn btn-sm btn-outline-secondary" :disabled="Boolean(busy)" v-on:click="startBan(user)">
              <i class="bi bi-slash-circle me-1" aria-hidden="true"></i>Suspend
            </button>
          </template>
          <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="Boolean(busy)" v-on:click="confirming = `role:${user._id}`">
            <i class="bi bi-shield-lock me-1" aria-hidden="true"></i>{{ user.role === 'admin' ? 'Remove admin' : 'Make admin' }}
          </button>
        </template>

        <template #footer>
          <ConfirmBar
            v-if="confirming === `ban:${user._id}`"
            :message="`Stop ${user.name} posting?`"
            label="Suspend"
            busy-label="Suspending..."
            :busy="busy === `ban:${user._id}`"
            @confirm="ban(user)"
            @cancel="confirming = ''"
          >
            <div class="d-grid gap-2 mb-3">
              <FilterChips v-model="banLength" :options="BAN_LENGTHS" label="How long" small />
              <label :for="`ban-reason-${user._id}`" class="visually-hidden">Reason</label>
              <input
                :id="`ban-reason-${user._id}`"
                v-model="banReason"
                type="text"
                class="form-control form-control-sm"
                :maxlength="BAN_REASON_MAX_LENGTH"
                placeholder="Reason, shown to the user (optional)"
              />
            </div>
          </ConfirmBar>
          <ConfirmBar
            v-if="confirming === `role:${user._id}`"
            :message="user.role === 'admin'
              ? `Remove ${user.name}'s admin role? They will lose access to this page.`
              : `Make ${user.name} an admin? They will be able to do everything on this page.`"
            :label="user.role === 'admin' ? 'Remove admin' : 'Make admin'"
            busy-label="Saving..."
            :busy="busy === `role:${user._id}`"
            @confirm="changeRole(user)"
            @cancel="confirming = ''"
          />
          <p v-for="key in [`ban:${user._id}`, `unban:${user._id}`, `role:${user._id}`]" v-show="errorFor(key)" :key="key" class="small text-brick mt-2 mb-0" role="alert">
            {{ errorFor(key) }}
          </p>
        </template>
      </AdminRow>
    </ul>
  </section>
</template>
