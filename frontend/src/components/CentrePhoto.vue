<script setup>
// A centre's NEA photo, or a plain placeholder when it has none, at a fixed height so rows line up.
// Usage: <CentrePhoto :centre="centre" />  (thumbnail)  or  <CentrePhoto :centre="centre" size="banner" />
// The banner shows the whole photo (most NEA photos are small, 430x320) on a blurred copy of itself,
// so it isn't cropped or stretched; selecting it opens the photo larger in a Bootstrap modal.
import { computed, onBeforeUnmount } from 'vue'

const props = defineProps({
  centre: { type: Object, required: true },
  size: { type: String, default: 'thumb' } // 'thumb' | 'banner'
})

const modalId = computed(() => `centre-photo-${props.centre._id}`)

// If the user leaves the page with the photo still open (e.g. the browser's Back button), Bootstrap's
// dark backdrop would stay on screen and the page couldn't scroll, so tidy up what the modal added.
onBeforeUnmount(() => {
  if (!document.getElementById(modalId.value)?.classList.contains('show')) return
  for (const backdrop of document.querySelectorAll('.modal-backdrop')) backdrop.remove()
  document.body.classList.remove('modal-open')
  document.body.style.removeProperty('overflow')
  document.body.style.removeProperty('padding-right')
})
// Used by the blurred fill behind the photo (see .banner-button::before)
const fillStyle = computed(() => ({ '--photo': `url("${props.centre.photoUrl}")` }))
</script>

<template>
  <!-- Banner: the whole photo, which opens larger when selected -->
  <template v-if="size === 'banner' && centre.photoUrl">
    <button
      type="button"
      class="banner-button hw-photo-banner"
      :style="fillStyle"
      data-bs-toggle="modal"
      :data-bs-target="`#${modalId}`"
      :aria-label="`View the photo of ${centre.name} larger`"
    >
      <img :src="centre.photoUrl" alt="" class="banner-image" />
      <span class="expand-hint small"><i class="bi bi-arrows-fullscreen me-1" aria-hidden="true"></i>View photo</span>
    </button>

    <div :id="modalId" class="modal fade" tabindex="-1" :aria-labelledby="`${modalId}-title`" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h2 :id="`${modalId}-title`" class="modal-title h6">{{ centre.name }}</h2>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-0">
            <img :src="centre.photoUrl" :alt="`Photo of ${centre.name}`" class="d-block w-100" />
          </div>
          <div class="modal-footer py-2">
            <span class="small text-secondary me-auto">Photo: NEA</span>
          </div>
        </div>
      </div>
    </div>
  </template>

  <!-- Thumbnail (alt="" is right: the centre name is always next to it) -->
  <img
    v-else-if="centre.photoUrl"
    :src="centre.photoUrl"
    alt=""
    loading="lazy"
    class="hw-photo"
    :class="size === 'banner' ? 'hw-photo-banner' : 'hw-photo-thumb'"
  />

  <div
    v-else
    class="hw-photo hw-photo-none"
    :class="size === 'banner' ? 'hw-photo-banner' : 'hw-photo-thumb'"
    aria-hidden="true"
  >
    <i class="bi bi-shop"></i>
  </div>
</template>

<style scoped>
.banner-button {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  padding: 0;
  border: 1px solid var(--line);
  overflow: hidden;
  background: var(--sub);
  cursor: zoom-in;
}

/* A blurred, enlarged copy of the photo fills the space either side of it */
.banner-button::before {
  content: "";
  position: absolute;
  inset: -20px;
  background: var(--photo) center / cover no-repeat;
  filter: blur(18px);
  opacity: 0.55;
}

/* The photo itself, always whole: scaled to fit inside the banner (a 430x320 NEA photo is only
   enlarged a little, so it stays sharp), with the blurred fill showing either side */
.banner-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.expand-hint {
  position: absolute;
  right: 0.75rem;
  bottom: 0.75rem;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: rgba(26, 26, 25, 0.75);
  color: #fff;
}

.banner-button:hover .expand-hint,
.banner-button:focus-visible .expand-hint {
  background: var(--ink);
}
</style>
