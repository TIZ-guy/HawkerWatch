<script setup>
// Slideshow of every photo in a stall's reviews. It moves to the next photo by itself every few
// seconds, and pauses while the mouse is over it or a button in it has focus.
// Clicking a photo emits select(reviewId) so the page can jump to the review it came from.
// Usage: <PhotoGallery :photos="[{ photoId, reviewId, rating, name }]" v-on:select="goToReview" />
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import StarRating from './StarRating.vue'
import { photoUrl } from '../services/reviewService.js'

const SECONDS_PER_PHOTO = 4

const props = defineProps({
  photos: { type: Array, required: true }
})
const emit = defineEmits(['select'])

const index = ref(0)
const paused = ref(false)
let timer = null

const current = computed(() => props.photos[index.value])

function next() {
  index.value = (index.value + 1) % props.photos.length
}

function previous() {
  index.value = (index.value - 1 + props.photos.length) % props.photos.length
}

function goTo(position) {
  index.value = position
}

onMounted(() => {
  // People who have asked their device for less motion get no automatic sliding
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) return

  timer = setInterval(() => {
    if (!paused.value && props.photos.length > 1) next()
  }, SECONDS_PER_PHOTO * 1000)
})

onUnmounted(() => {
  clearInterval(timer)
})

// If photos are removed (e.g. a review is deleted), stay within the list
watch(() => props.photos.length, (length) => {
  if (index.value >= length) index.value = 0
})
</script>

<template>
  <section
    v-if="photos.length"
    class="photo-gallery hw-surface overflow-hidden"
    aria-roledescription="carousel"
    aria-label="Photos from reviews"
    v-on:mouseenter="paused = true"
    v-on:mouseleave="paused = false"
    v-on:focusin="paused = true"
    v-on:focusout="paused = false"
  >
    <div class="position-relative">
      <button
        type="button"
        class="photo-button"
        :aria-label="`Photo ${index + 1} of ${photos.length}, from ${current.name}'s review. Go to the review`"
        v-on:click="emit('select', current.reviewId)"
      >
        <!-- A blurred copy fills the space beside photos narrower than the slideshow -->
        <img :src="photoUrl(current.photoId)" alt="" class="photo-backdrop" aria-hidden="true" />
        <img :src="photoUrl(current.photoId)" :alt="`Photo from ${current.name}'s review`" class="photo" />
      </button>

      <div class="photo-caption">
        <StarRating :rating="current.rating" :show-number="false" />
        <span class="small">{{ current.name }} · <span class="text-decoration-underline">See review</span></span>
      </div>

      <template v-if="photos.length > 1">
        <button type="button" class="nav-button start-0 ms-2" aria-label="Previous photo" v-on:click="previous">
          <i class="bi bi-chevron-left" aria-hidden="true"></i>
        </button>
        <button type="button" class="nav-button end-0 me-2" aria-label="Next photo" v-on:click="next">
          <i class="bi bi-chevron-right" aria-hidden="true"></i>
        </button>
      </template>
    </div>

    <div v-if="photos.length > 1" class="d-flex justify-content-center flex-wrap gap-2 py-2">
      <button
        v-for="(photo, position) in photos"
        :key="photo.photoId"
        type="button"
        class="dot"
        :class="{ active: position === index }"
        :aria-label="`Show photo ${position + 1}`"
        :aria-current="position === index"
        v-on:click="goTo(position)"
      ></button>
    </div>
  </section>
</template>

<style scoped>
.photo-button {
  position: relative;
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  overflow: hidden;
  background: #222;
  cursor: pointer;
}

/* contain shows the whole photo instead of cropping it to the slideshow's shape */
.photo {
  position: relative;
  display: block;
  width: 100%;
  height: 320px;
  object-fit: contain;
}

.photo-backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(24px) brightness(0.7);
  transform: scale(1.1); /* hides the soft edges the blur leaves */
}

.photo-caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 1rem 0.75rem;
  color: #fff;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  pointer-events: none; /* clicks go through to the photo */
}

.nav-button {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 2.5rem;
  height: 2.5rem;
  border: 0;
  border-radius: 50%;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
}

.nav-button:hover,
.nav-button:focus-visible {
  background: rgba(0, 0, 0, 0.75);
}

.dot {
  width: 0.6rem;
  height: 0.6rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #ccc;
}

.dot.active {
  background: var(--line-strong);
}

@media (max-width: 576px) {
  .photo {
    height: 220px;
  }
}
</style>
