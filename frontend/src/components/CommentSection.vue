<script setup>
// Comments on one hawker centre (from /hawker-centres/:id/comments), newest first.
// Logged-in users can post, and edit or delete their own comments. Admins can delete any comment.
// A link ending in #comments (the login redirect) scrolls here once the comments have loaded.
import { nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LoadingState from './LoadingState.vue'
import ErrorState from './ErrorState.vue'
import { addComment, deleteComment, editComment, getComments } from '../services/commentService.js'
import { useAuthStore } from '../stores/useAuthStore.js'
import { formatDate, timeAgo } from '../utils/time.js'

const MAX_LENGTH = 500 // same limit as the backend (COMMENT_MAX_LENGTH)

const props = defineProps({
  centreId: { type: String, required: true }
})

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const comments = ref([])
const loading = ref(true)
const loadError = ref('')

const newText = ref('')
const posting = ref(false)
const postError = ref('')

const editingId = ref('')
const editText = ref('')
const saving = ref(false)
const editError = ref('')

const confirmingDeleteId = ref('')
const deletingId = ref('')
const deleteError = ref({ id: '', message: '' })

const isMine = (comment) => Boolean(auth.user) && comment.user?._id === auth.user._id
const canDelete = (comment) => isMine(comment) || auth.isAdmin
const wasEdited = (comment) => new Date(comment.updatedAt) > new Date(comment.createdAt)

async function load(id) {
  loading.value = true
  loadError.value = ''
  try {
    const result = await getComments(id)
    if (id === props.centreId) comments.value = result
  } catch (error) {
    if (id === props.centreId) loadError.value = error.message
  } finally {
    if (id === props.centreId) loading.value = false
  }

  if (route.hash === '#comments') {
    await nextTick()
    document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function goToLogin() {
  router.push({ path: '/login', query: { redirect: `${route.path}#comments` } })
}

async function post() {
  postError.value = ''
  if (!newText.value.trim()) {
    postError.value = 'Write something first.'
    return
  }
  posting.value = true
  try {
    const comment = await addComment(props.centreId, newText.value)
    comments.value = [comment, ...comments.value]
    newText.value = ''
  } catch (error) {
    postError.value = error.message
  } finally {
    posting.value = false
  }
}

function startEdit(comment) {
  confirmingDeleteId.value = ''
  editingId.value = comment._id
  editText.value = comment.text
  editError.value = ''
}

async function saveEdit(comment) {
  editError.value = ''
  if (!editText.value.trim()) {
    editError.value = 'A comment cannot be empty. Delete it instead.'
    return
  }
  saving.value = true
  try {
    const updated = await editComment(comment._id, editText.value)
    comments.value = comments.value.map((item) => (item._id === comment._id ? updated : item))
    editingId.value = ''
  } catch (error) {
    editError.value = error.message
  } finally {
    saving.value = false
  }
}

function startDelete(comment) {
  editingId.value = ''
  deleteError.value = { id: '', message: '' }
  confirmingDeleteId.value = comment._id
}

async function confirmDelete(comment) {
  deletingId.value = comment._id
  try {
    await deleteComment(comment._id)
    comments.value = comments.value.filter((item) => item._id !== comment._id)
    confirmingDeleteId.value = ''
  } catch (error) {
    deleteError.value = { id: comment._id, message: error.message }
  } finally {
    deletingId.value = ''
  }
}

watch(() => props.centreId, (id) => {
  comments.value = []
  newText.value = ''
  editingId.value = ''
  confirmingDeleteId.value = ''
  load(id)
}, { immediate: true })
</script>

<template>
  <section id="comments" aria-labelledby="comments-heading">
    <h2 id="comments-heading" class="h3 mb-3">
      Comments <span v-if="!loading && !loadError" class="text-secondary fs-5">({{ comments.length }})</span>
    </h2>

    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body p-4">
        <form v-if="auth.user" @submit.prevent="post">
          <label for="new-comment" class="form-label small fw-semibold">Share a tip about this centre</label>
          <textarea
            id="new-comment"
            v-model="newText"
            class="form-control"
            rows="3"
            :maxlength="MAX_LENGTH"
            placeholder="e.g. Go before 11:30, the lunch crowd builds quickly."
          ></textarea>
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-2">
            <span class="small text-secondary">{{ newText.length }} / {{ MAX_LENGTH }}</span>
            <button type="submit" class="btn btn-sm btn-danger" :disabled="posting">
              {{ posting ? 'Posting...' : 'Post comment' }}
            </button>
          </div>
          <p v-if="postError" class="small text-danger mt-2 mb-0" role="alert">{{ postError }}</p>
        </form>

        <div v-else class="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span class="text-secondary">Log in to share a tip about this centre.</span>
          <button type="button" class="btn btn-sm btn-outline-danger" @click="goToLogin">Log in to comment</button>
        </div>
      </div>
    </div>

    <LoadingState v-if="loading" message="Loading comments..." />

    <ErrorState v-else-if="loadError" :message="loadError" retryable @retry="load(centreId)" />

    <ul v-else-if="comments.length" class="list-unstyled d-flex flex-column gap-3 mb-0">
      <li v-for="comment in comments" :key="comment._id" class="card border-0 shadow-sm">
        <div class="card-body p-3">
          <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-1">
            <span class="fw-semibold">
              <i class="bi bi-person-circle me-1 text-secondary" aria-hidden="true"></i>{{ comment.user?.name || 'Deleted user' }}
              <span v-if="isMine(comment)" class="badge text-bg-light border ms-1">You</span>
            </span>
            <span class="small text-secondary" :title="formatDate(comment.createdAt)">
              {{ timeAgo(comment.createdAt) }}<span v-if="wasEdited(comment)"> · edited</span>
            </span>
          </div>

          <form v-if="editingId === comment._id" @submit.prevent="saveEdit(comment)">
            <label :for="`edit-${comment._id}`" class="visually-hidden">Edit your comment</label>
            <textarea :id="`edit-${comment._id}`" v-model="editText" class="form-control" rows="3" :maxlength="MAX_LENGTH"></textarea>
            <p v-if="editError" class="small text-danger mt-2 mb-0" role="alert">{{ editError }}</p>
            <div class="d-flex gap-2 mt-2">
              <button type="submit" class="btn btn-sm btn-danger" :disabled="saving">{{ saving ? 'Saving...' : 'Save' }}</button>
              <button type="button" class="btn btn-sm btn-link text-secondary" @click="editingId = ''">Cancel</button>
            </div>
          </form>

          <template v-else>
            <p class="comment-text mb-0">{{ comment.text }}</p>

            <div v-if="confirmingDeleteId === comment._id" class="d-flex flex-wrap align-items-center gap-2 mt-2">
              <span class="small">Delete this comment?</span>
              <button type="button" class="btn btn-sm btn-danger" :disabled="deletingId === comment._id" @click="confirmDelete(comment)">
                {{ deletingId === comment._id ? 'Deleting...' : 'Delete' }}
              </button>
              <button type="button" class="btn btn-sm btn-link text-secondary" @click="confirmingDeleteId = ''">Cancel</button>
            </div>
            <div v-else-if="canDelete(comment)" class="d-flex gap-3 mt-2">
              <button v-if="isMine(comment)" type="button" class="btn btn-link btn-sm p-0 text-secondary" @click="startEdit(comment)">
                <i class="bi bi-pencil me-1" aria-hidden="true"></i>Edit
              </button>
              <button type="button" class="btn btn-link btn-sm p-0 text-secondary" @click="startDelete(comment)">
                <i class="bi bi-trash me-1" aria-hidden="true"></i>Delete
              </button>
            </div>
            <p v-if="deleteError.id === comment._id" class="small text-danger mt-2 mb-0" role="alert">{{ deleteError.message }}</p>
          </template>
        </div>
      </li>
    </ul>

    <div v-else class="alert alert-light border">No comments yet. Be the first to share a tip.</div>
  </section>
</template>

<style scoped>
/* Keeps the line breaks people type */
.comment-text {
  white-space: pre-line;
  overflow-wrap: anywhere;
}
</style>
