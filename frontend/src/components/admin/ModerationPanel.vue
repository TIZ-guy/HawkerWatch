<script setup>
// Admin page: one queue for everything diners post — community reports, food updates, reviews and comments.
// Reports and food updates can be flagged by diners, so those open on the flagged ones. Reviews and comments
// can't be flagged, so they list the newest. Deleting is for good, and goes in the activity log.
// Emits changed() after each deletion (to recount the tiles) and manage-user(email) to open the author on Users.
import { computed, onMounted, ref, watch } from 'vue'
import AdminRow from './AdminRow.vue'
import ConfirmBar from './ConfirmBar.vue'
import FilterChips from '../FilterChips.vue'
import StatusBadge from '../StatusBadge.vue'
import LoadingState from '../LoadingState.vue'
import ErrorState from '../ErrorState.vue'
import {
  deleteFoodUpdate, deleteReport, getAdminComments, getAdminFoodUpdates, getAdminReports, getAdminReviews
} from '../../services/adminService.js'
import { deleteReview } from '../../services/reviewService.js'
import { deleteComment } from '../../services/commentService.js'
import { useAdminAction } from './useAdminAction.js'
import { personText } from '../../utils/admin.js'
import { foodUpdateDisplay } from '../../utils/foodUpdates.js'
import { timeAgo } from '../../utils/time.js'

// How each kind of post is loaded, deleted and named
const KINDS = {
  reports: { label: 'Reports', icon: 'bi-megaphone', flaggable: true, noun: 'report', remove: deleteReport },
  foodUpdates: { label: 'Food updates', icon: 'bi-egg-fried', flaggable: true, noun: 'food update', remove: deleteFoodUpdate },
  reviews: { label: 'Reviews', icon: 'bi-star', flaggable: false, noun: 'review', remove: deleteReview },
  comments: { label: 'Comments', icon: 'bi-chat-left-text', flaggable: false, noun: 'comment', remove: deleteComment }
}
const KIND_CHOICES = Object.entries(KINDS).map(([value, kind]) => ({ value, label: kind.label, icon: kind.icon }))
const SHOW_CHOICES = [
  { value: 'flagged', label: 'Flagged', icon: 'bi-flag' },
  { value: 'all', label: 'All recent' }
]
const HIDE_THRESHOLD = 3 // same as FLAG_HIDE_THRESHOLD in backend/utils/reportUtils.js and foodUpdateUtils.js

const emit = defineEmits(['changed', 'manage-user'])
const { confirming, busy, notice, run, errorFor } = useAdminAction(() => emit('changed'))

const kind = ref('reports')
const show = ref('flagged')
const items = ref([])
const loading = ref(true)
const errorMessage = ref('')
const flaggable = computed(() => KINDS[kind.value].flaggable)

// Every kind of post as the same shape, so the list is drawn one way:
// { id, user, createdAt, title, subtitle, link, text, flagCount, state, status?, foodType?, rating? }
function stateOf(post) {
  if (post.hidden) return { label: 'Hidden by flags', className: 'text-brick' }
  if (post.live) return { label: 'Live', className: 'text-success' }
  return { label: 'Expired', className: 'text-secondary' }
}

async function fetchItems() {
  const flagged = show.value === 'flagged'
  if (kind.value === 'reports') {
    const { reports } = await getAdminReports({ flagged })
    return reports.map((report) => ({
      ...report,
      title: report.stall?.name || 'Deleted stall',
      subtitle: report.hawkerCentre?.name,
      link: report.hawkerCentre && report.stall && `/hawker-centres/${report.hawkerCentre._id}#stall-${report.stall._id}`,
      state: stateOf(report)
    }))
  }
  if (kind.value === 'foodUpdates') {
    const updates = await getAdminFoodUpdates({ flagged })
    return updates.map((update) => ({
      ...update,
      foodType: update.type,
      title: update.stall?.name || 'Deleted stall',
      subtitle: update.hawkerCentre?.name,
      link: update.stall && `/stalls/${update.stall._id}`,
      text: update.note,
      state: stateOf(update)
    }))
  }
  if (kind.value === 'reviews') {
    const reviews = await getAdminReviews()
    return reviews.map((review) => ({
      ...review,
      title: review.stall?.name || 'Deleted stall',
      subtitle: review.stall?.hawkerCentre?.name,
      link: review.stall && `/stalls/${review.stall._id}#reviews`,
      extra: review.photoCount ? `${review.photoCount} photo${review.photoCount === 1 ? '' : 's'}` : ''
    }))
  }
  const comments = await getAdminComments()
  return comments.map((comment) => ({
    ...comment,
    title: comment.hawkerCentre?.name || 'Deleted centre',
    link: comment.hawkerCentre && `/hawker-centres/${comment.hawkerCentre._id}#comments`
  }))
}

let latestRequest = 0
async function load() {
  const request = ++latestRequest
  loading.value = true
  errorMessage.value = ''
  try {
    const found = await fetchItems()
    if (request === latestRequest) items.value = found
  } catch (error) {
    if (request === latestRequest) errorMessage.value = error.message
  } finally {
    if (request === latestRequest) loading.value = false
  }
}

watch(kind, (value, previous) => {
  if (!value) {
    kind.value = previous // clicking the chosen kind again keeps it
    return
  }
  confirming.value = ''
  notice.value = ''
  items.value = []
  load()
})
watch(show, (value, previous) => {
  if (!value) show.value = previous
  else load()
})

function remove(item) {
  const { noun, remove: removeItem } = KINDS[kind.value]
  run(`delete:${item.id}`, () => removeItem(item.id), () => {
    items.value = items.value.filter((other) => other.id !== item.id)
    return `The ${noun} by ${item.user?.name || 'a deleted user'} was deleted.`
  })
}

const emptyText = computed(() => {
  const noun = KINDS[kind.value].label.toLowerCase()
  return flaggable.value && show.value === 'flagged' ? `No flagged ${noun}.` : `No ${noun} yet.`
})

onMounted(load)
</script>

<template>
  <section aria-label="Moderation" data-testid="admin-moderation">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
      <FilterChips v-model="kind" :options="KIND_CHOICES" label="What to moderate" small />
      <button type="button" class="btn btn-sm btn-outline-dark" v-on:click="load">
        <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Refresh
      </button>
    </div>
    <FilterChips v-if="flaggable" v-model="show" class="mb-2" :options="SHOW_CHOICES" label="Which ones" small />
    <p class="small text-secondary">
      <template v-if="flaggable">
        Newest first, expired ones included. Diners' flags hide one automatically once {{ HIDE_THRESHOLD }} people flag it; delete it to remove it for good.
      </template>
      <template v-else>Newest first. Diners can't flag {{ KINDS[kind].label.toLowerCase() }}, so check the recent ones here.</template>
    </p>
    <p v-if="notice" class="hw-surface p-3 small" role="status">{{ notice }}</p>

    <LoadingState v-if="loading && !items.length" message="Loading..." />
    <ErrorState v-else-if="errorMessage" :message="errorMessage" retryable @retry="load" />
    <div v-else-if="!items.length" class="hw-surface p-3">{{ emptyText }}</div>
    <ul v-else class="list-unstyled d-grid gap-2 mb-0" :class="{ 'opacity-50': loading }">
      <AdminRow v-for="item in items" :key="item.id" data-testid="admin-moderation-item">
        <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
          <StatusBadge v-if="item.status" :status="item.status" />
          <span v-if="item.foodType" class="small fw-semibold">
            <i class="bi me-1" :class="foodUpdateDisplay(item.foodType).icon" aria-hidden="true"></i>{{ foodUpdateDisplay(item.foodType).label }}
          </span>
          <span v-if="item.rating" class="small fw-semibold" :aria-label="`${item.rating} stars`">
            <i class="bi bi-star-fill text-warning me-1" aria-hidden="true"></i>{{ item.rating }}
          </span>
          <span v-if="item.state" class="small fw-semibold" :class="item.state.className">{{ item.state.label }}</span>
          <span v-if="item.flagCount" class="small text-brick">
            <i class="bi bi-flag-fill me-1" aria-hidden="true"></i>{{ item.flagCount }} flag{{ item.flagCount === 1 ? '' : 's' }}
          </span>
        </div>
        <p class="small mb-0">
          <RouterLink v-if="item.link" :to="item.link" class="fw-semibold text-reset">{{ item.title }}</RouterLink>
          <strong v-else>{{ item.title }}</strong>
          <span v-if="item.subtitle" class="text-secondary"> · {{ item.subtitle }}</span>
          <span v-if="item.extra" class="text-secondary"> · {{ item.extra }}</span>
        </p>
        <p v-if="item.text" class="small mb-0 mt-1 post-text">{{ item.text }}</p>
        <p class="small text-secondary mb-0 mt-1">
          By {{ personText(item.user) }} · {{ timeAgo(item.createdAt) }}
          <button v-if="item.user" type="button" class="btn btn-link btn-sm p-0 ms-1 align-baseline" v-on:click="emit('manage-user', item.user.email)">Manage user</button>
        </p>

        <template #actions>
          <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="Boolean(busy)" v-on:click="confirming = `delete:${item.id}`">
            <i class="bi bi-trash me-1" aria-hidden="true"></i>Delete
          </button>
        </template>

        <template #footer>
          <ConfirmBar
            v-if="confirming === `delete:${item.id}`"
            :message="`Delete this ${KINDS[kind].noun} for good?`"
            label="Delete"
            busy-label="Deleting..."
            :busy="busy === `delete:${item.id}`"
            @confirm="remove(item)"
            @cancel="confirming = ''"
          />
          <p v-if="errorFor(`delete:${item.id}`)" class="small text-brick mt-2 mb-0" role="alert">{{ errorFor(`delete:${item.id}`) }}</p>
        </template>
      </AdminRow>
    </ul>
  </section>
</template>

<style scoped>
.post-text {
  white-space: pre-line;
  overflow-wrap: anywhere;
}
</style>
