<script setup>
// Reviews for one stall: a slideshow of every review photo, the average rating, a form to write or
// edit your own review (with up to 4 photos), and all the reviews (yours first, then newest first).
// Logged-in users can review a stall once. Admins can delete any review or photo.
// Clicking a photo in the slideshow scrolls to the review it came from and highlights it.
// Emits changed({ average, count }) after a review is added, edited or deleted, so the page can
// update the rating it shows elsewhere.
// A link ending in #reviews (the login redirect) scrolls here once the reviews have loaded.
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StarRating from './StarRating.vue'
import PhotoGallery from './PhotoGallery.vue'
import LoadingState from './LoadingState.vue'
import ErrorState from './ErrorState.vue'
import {
  addReview,
  addReviewPhotos,
  deleteReview,
  deleteReviewPhoto,
  getStallReviews,
  photoUrl,
  updateReview
} from '../services/reviewService.js'
import { useAuthStore } from '../stores/useAuthStore.js'
import { formatDate, timeAgo } from '../utils/time.js'
import { shrinkPhoto } from '../utils/photos.js'

const MAX_LENGTH = 500 // same limit as the backend (REVIEW_TEXT_MAX_LENGTH)
const MAX_PHOTOS = 4 // same limit as the backend (MAX_REVIEW_PHOTOS)
const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']

const props = defineProps({
  stallId: { type: String, required: true },
  stallName: { type: String, default: 'this stall' }
})
const emit = defineEmits(['changed'])

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const reviews = ref([])
const average = ref(null)
const count = ref(0)
const loading = ref(true)
const loadError = ref('')

// The review form, used both for writing a new review and editing your own
const editing = ref(false)
const formRating = ref(0)
const formText = ref('')
const keptPhotos = ref([]) // ids of photos already on your review that you are keeping
const newPhotos = ref([]) // [{ file, preview }] chosen in this form, not uploaded yet
const saving = ref(false)
const formError = ref('')

const confirmingDeleteId = ref('')
const deletingId = ref('')
const deleteError = ref('')

// The review that was just clicked in the slideshow, highlighted for a moment
const highlightedId = ref('')

// The logged-in user's own review, or null
const myReview = computed(() => {
  if (!auth.state.user) return null
  for (const review of reviews.value) {
    if (review.user && review.user._id === auth.state.user._id) return review
  }
  return null
})

// Your own review first, then everyone else's (already newest first from the backend)
const orderedReviews = computed(() => {
  const ordered = []
  if (myReview.value) ordered.push(myReview.value)
  for (const review of reviews.value) {
    if (review !== myReview.value) ordered.push(review)
  }
  return ordered
})

// Every photo from every review, for the slideshow
const galleryPhotos = computed(() => {
  const photos = []
  for (const review of reviews.value) {
    for (const photoId of review.photos) {
      photos.push({
        photoId: photoId,
        reviewId: review._id,
        rating: review.rating,
        name: review.user ? review.user.name : 'Deleted user'
      })
    }
  }
  return photos
})

const isAdmin = computed(() => auth.state.user?.role === 'admin')
const showForm = computed(() => Boolean(auth.state.user) && (!myReview.value || editing.value))
const photoCount = computed(() => keptPhotos.value.length + newPhotos.value.length)

function isMine(review) {
  return review === myReview.value
}

async function loadReviews() {
  loadError.value = ''
  try {
    const data = await getStallReviews(props.stallId)
    reviews.value = data.reviews
    average.value = data.average
    count.value = data.count
  } catch (error) {
    loadError.value = error.message
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadReviews()
  if (route.hash === '#reviews') {
    document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
})

function goToLogin() {
  router.push({ path: '/login', query: { redirect: `${route.path}#reviews` } })
}

// Slideshow click: scroll to that review and highlight it for a few seconds
function goToReview(reviewId) {
  highlightedId.value = reviewId
  document.getElementById(`review-${reviewId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(() => {
    if (highlightedId.value === reviewId) highlightedId.value = ''
  }, 3000)
}

function clearNewPhotos() {
  for (const photo of newPhotos.value) {
    URL.revokeObjectURL(photo.preview) // frees the memory used by the preview
  }
  newPhotos.value = []
}

function resetForm() {
  editing.value = false
  formRating.value = 0
  formText.value = ''
  keptPhotos.value = []
  clearNewPhotos()
  formError.value = ''
}

function startEdit() {
  formRating.value = myReview.value.rating
  formText.value = myReview.value.text
  keptPhotos.value = [...myReview.value.photos]
  clearNewPhotos()
  formError.value = ''
  confirmingDeleteId.value = ''
  editing.value = true
}

// Photos picked with the file input. Only the first few are kept so the review stays within MAX_PHOTOS.
function onPhotosChosen(event) {
  formError.value = ''
  const files = Array.from(event.target.files)
  for (const file of files) {
    if (photoCount.value >= MAX_PHOTOS) {
      formError.value = `You can add up to ${MAX_PHOTOS} photos.`
      break
    }
    if (!file.type.startsWith('image/')) {
      formError.value = 'Only photos can be added.'
      continue
    }
    newPhotos.value.push({ file: file, preview: URL.createObjectURL(file) })
  }
  event.target.value = '' // lets the same photo be chosen again after removing it
}

function removeNewPhoto(position) {
  URL.revokeObjectURL(newPhotos.value[position].preview)
  newPhotos.value.splice(position, 1)
}

function removeKeptPhoto(photoId) {
  keptPhotos.value = keptPhotos.value.filter((id) => id !== photoId)
}

async function saveReview() {
  formError.value = ''
  if (formRating.value < 1) {
    formError.value = 'Choose a star rating first.'
    return
  }
  saving.value = true
  try {
    // 1. Save the stars and text
    let review
    if (myReview.value) {
      review = await updateReview(myReview.value._id, formRating.value, formText.value)
    } else {
      review = await addReview(props.stallId, formRating.value, formText.value)
    }

    // 2. Remove photos taken off the review while editing
    for (const photoId of review.photos) {
      if (!keptPhotos.value.includes(photoId)) {
        await deleteReviewPhoto(review._id, photoId)
      }
    }

    // 3. Shrink and upload the new photos
    if (newPhotos.value.length) {
      const shrunk = []
      for (const photo of newPhotos.value) {
        shrunk.push(await shrinkPhoto(photo.file))
      }
      await addReviewPhotos(review._id, shrunk)
    }

    resetForm()
  } catch (error) {
    formError.value = error.message
  } finally {
    saving.value = false
    await loadReviews() // reload so the average, the list and the photos include the change
    emit('changed', { average: average.value, count: count.value })
  }
}

function startDelete(review) {
  editing.value = false
  deleteError.value = ''
  confirmingDeleteId.value = review._id
}

async function confirmDelete(review) {
  deletingId.value = review._id
  deleteError.value = ''
  try {
    await deleteReview(review._id)
    confirmingDeleteId.value = ''
    await loadReviews()
    emit('changed', { average: average.value, count: count.value })
  } catch (error) {
    deleteError.value = error.message
  } finally {
    deletingId.value = ''
  }
}

// Admins can remove a single photo from someone else's review
async function adminRemovePhoto(review, photoId) {
  deleteError.value = ''
  try {
    await deleteReviewPhoto(review._id, photoId)
    await loadReviews()
  } catch (error) {
    deleteError.value = error.message
  }
}
</script>

<template>
  <section id="reviews" aria-labelledby="reviews-heading">
    <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-3">
      <h2 id="reviews-heading" class="h3 mb-0">Reviews</h2>
      <StarRating v-if="average !== null" :rating="average" :count="count" />
    </div>

    <LoadingState v-if="loading" message="Loading reviews..." />

    <ErrorState v-else-if="loadError" :message="loadError" retryable v-on:retry="loadReviews" />

    <template v-else>
      <PhotoGallery v-if="galleryPhotos.length" class="mb-4" :photos="galleryPhotos" v-on:select="goToReview" />

      <!-- Writing a new review, or editing your own -->
      <div v-if="showForm" class="card border-0 shadow-sm mb-4">
        <form class="card-body p-4" v-on:submit.prevent="saveReview">
          <fieldset>
            <legend class="small fw-semibold mb-1">
              {{ myReview ? 'Edit your review' : `Rate ${stallName}` }}
            </legend>
            <div class="d-flex align-items-center gap-1">
              <button
                v-for="star in 5"
                :key="star"
                type="button"
                class="btn btn-link p-0 star-button"
                :aria-label="`${star} star${star === 1 ? '' : 's'}: ${STAR_LABELS[star]}`"
                :aria-pressed="formRating === star"
                v-on:click="formRating = star"
              >
                <i class="bi" :class="star <= formRating ? 'bi-star-fill' : 'bi-star'" aria-hidden="true"></i>
              </button>
              <span class="small text-secondary ms-2">{{ STAR_LABELS[formRating] || 'Tap a star' }}</span>
            </div>
          </fieldset>

          <label for="review-text" class="form-label small fw-semibold mt-3">Your review (optional)</label>
          <textarea
            id="review-text"
            v-model="formText"
            class="form-control"
            rows="3"
            :maxlength="MAX_LENGTH"
            placeholder="What did you order? How was it?"
          ></textarea>
          <div class="small text-secondary text-end mt-1">{{ formText.length }} / {{ MAX_LENGTH }}</div>

          <!-- Photos: ones already on the review, then newly chosen ones -->
          <p class="form-label small fw-semibold mt-2 mb-2">Photos (optional, up to {{ MAX_PHOTOS }})</p>
          <div class="d-flex flex-wrap gap-2">
            <div v-for="photoId in keptPhotos" :key="photoId" class="thumb-wrapper">
              <img :src="photoUrl(photoId)" alt="Photo on your review" class="thumb" />
              <button type="button" class="remove-photo" aria-label="Remove this photo" v-on:click="removeKeptPhoto(photoId)">
                <i class="bi bi-x" aria-hidden="true"></i>
              </button>
            </div>
            <div v-for="(photo, position) in newPhotos" :key="photo.preview" class="thumb-wrapper">
              <img :src="photo.preview" alt="New photo to upload" class="thumb" />
              <button type="button" class="remove-photo" aria-label="Remove this photo" v-on:click="removeNewPhoto(position)">
                <i class="bi bi-x" aria-hidden="true"></i>
              </button>
            </div>
            <template v-if="photoCount < MAX_PHOTOS">
              <input id="review-photos" type="file" accept="image/*" multiple class="visually-hidden" v-on:change="onPhotosChosen" />
              <label class="add-photo" for="review-photos">
                <i class="bi bi-camera fs-4" aria-hidden="true"></i>
                <span class="small">Add photo</span>
              </label>
            </template>
          </div>

          <div class="d-flex justify-content-end gap-2 mt-3">
            <button v-if="myReview" type="button" class="btn btn-sm btn-link text-secondary" v-on:click="resetForm">Cancel</button>
            <button type="submit" class="btn btn-sm btn-danger" :disabled="saving">
              {{ saving ? 'Saving...' : myReview ? 'Save changes' : 'Post review' }}
            </button>
          </div>
          <p v-if="formError" class="small text-danger mt-2 mb-0" role="alert">{{ formError }}</p>
        </form>
      </div>

      <!-- Logged out -->
      <div v-else-if="!auth.state.user" class="card border-0 shadow-sm mb-4">
        <div class="card-body p-4 d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span class="text-secondary">Log in to rate and review {{ stallName }}.</span>
          <button type="button" class="btn btn-sm btn-outline-danger" v-on:click="goToLogin">Log in to review</button>
        </div>
      </div>

      <!-- All the reviews; your own first (hidden while you edit it above) -->
      <ul v-if="orderedReviews.length" class="list-unstyled d-flex flex-column gap-3 mb-0">
        <template v-for="review in orderedReviews" :key="review._id">
          <li
            v-if="!(isMine(review) && editing)"
            :id="`review-${review._id}`"
            class="card border-0 shadow-sm review-card"
            :class="{ 'my-review': isMine(review), highlighted: highlightedId === review._id }"
          >
            <div class="card-body p-3">
              <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-1">
                <span v-if="isMine(review)" class="fw-semibold">Your review</span>
                <span v-else class="fw-semibold">
                  <i class="bi bi-person-circle me-1 text-secondary" aria-hidden="true"></i>{{ review.user ? review.user.name : 'Deleted user' }}
                </span>
                <span class="small text-secondary" :title="formatDate(review.createdAt)">
                  {{ timeAgo(review.createdAt) }}<span v-if="review.editedAt"> · edited</span>
                </span>
              </div>
              <StarRating :rating="review.rating" :show-number="false" />
              <p v-if="review.text" class="review-text mt-1 mb-0">{{ review.text }}</p>

              <!-- The review's photos; click one to open it full size -->
              <div v-if="review.photos.length" class="d-flex flex-wrap gap-2 mt-2">
                <div v-for="photoId in review.photos" :key="photoId" class="thumb-wrapper">
                  <a :href="photoUrl(photoId)" target="_blank" rel="noopener" :aria-label="'Open photo full size'">
                    <img :src="photoUrl(photoId)" alt="Photo from this review" class="thumb" loading="lazy" />
                  </a>
                  <button
                    v-if="isAdmin && !isMine(review)"
                    type="button"
                    class="remove-photo"
                    aria-label="Remove this photo (admin)"
                    v-on:click="adminRemovePhoto(review, photoId)"
                  >
                    <i class="bi bi-x" aria-hidden="true"></i>
                  </button>
                </div>
              </div>

              <!-- Edit and delete: your own review, or delete as an admin -->
              <template v-if="isMine(review) || isAdmin">
                <div v-if="confirmingDeleteId === review._id" class="d-flex flex-wrap align-items-center gap-2 mt-2">
                  <span class="small">{{ isMine(review) ? 'Delete your review?' : 'Delete this review?' }}</span>
                  <button type="button" class="btn btn-sm btn-danger" :disabled="deletingId === review._id" v-on:click="confirmDelete(review)">
                    {{ deletingId === review._id ? 'Deleting...' : 'Delete' }}
                  </button>
                  <button type="button" class="btn btn-sm btn-link text-secondary" v-on:click="confirmingDeleteId = ''">Cancel</button>
                </div>
                <div v-else class="d-flex gap-3 mt-2">
                  <button v-if="isMine(review)" type="button" class="btn btn-link btn-sm p-0 text-secondary" v-on:click="startEdit">
                    <i class="bi bi-pencil me-1" aria-hidden="true"></i>Edit
                  </button>
                  <button type="button" class="btn btn-link btn-sm p-0 text-secondary" v-on:click="startDelete(review)">
                    <i class="bi bi-trash me-1" aria-hidden="true"></i>{{ isMine(review) ? 'Delete' : 'Delete (admin)' }}
                  </button>
                </div>
                <p v-if="deleteError && confirmingDeleteId === review._id" class="small text-danger mt-2 mb-0" role="alert">{{ deleteError }}</p>
              </template>
            </div>
          </li>
        </template>
      </ul>

      <div v-else class="alert alert-light border">No reviews yet. Be the first to rate {{ stallName }}.</div>
    </template>
  </section>
</template>

<style scoped>
.star-button {
  color: #f5a623;
  font-size: 1.5rem;
  line-height: 1;
  text-decoration: none;
}

.review-card {
  transition: box-shadow 0.3s;
}

.my-review {
  border-left: 4px solid var(--hw-orange) !important;
}

/* The review picked in the slideshow */
.highlighted {
  outline: 3px solid var(--hw-orange);
  outline-offset: 2px;
}

/* Keeps the line breaks people type */
.review-text {
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.thumb-wrapper {
  position: relative;
}

.thumb,
.add-photo {
  width: 88px;
  height: 88px;
  border-radius: 0.5rem;
}

.thumb {
  display: block;
  object-fit: cover;
}

.add-photo {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed #ccc;
  color: #6c757d;
  cursor: pointer;
}

.add-photo:hover {
  border-color: var(--hw-orange);
  color: var(--hw-orange);
}

/* Shows the focus ring on the label when the hidden file input has keyboard focus */
#review-photos:focus-visible + .add-photo {
  outline: 2px solid var(--hw-orange);
}

.remove-photo {
  position: absolute;
  top: -0.4rem;
  right: -0.4rem;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: #fff;
  background: rgba(0, 0, 0, 0.7);
  line-height: 1;
}
</style>
