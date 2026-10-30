<script setup>
// Heart toggle for a stall or centre. Logged-out users are sent to log in and brought back.
// Usage: <FavouriteButton target-type="Stall" :target-id="stall._id" :name="stall.name" />
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/useAuthStore.js'
import { useFavouriteStore } from '../stores/useFavouriteStore.js'

const props = defineProps({
  targetType: { type: String, required: true }, // 'Stall' or 'HawkerCentre'
  targetId: { type: String, required: true },
  name: { type: String, default: '' },
  // Shows "Save" / "Saved" next to the heart
  withLabel: { type: Boolean, default: false }
})

const auth = useAuthStore()
const favourites = useFavouriteStore()
const route = useRoute()
const router = useRouter()
const errorMessage = ref('')

const saved = computed(() => Boolean(favourites.find(props.targetType, props.targetId)))
const busy = computed(() => favourites.isPending(props.targetId))
const label = computed(() => `${saved.value ? 'Remove' : 'Save'} ${props.name || 'this'} ${saved.value ? 'from' : 'to'} favourites`)

async function onClick() {
  errorMessage.value = ''
  if (!auth.user) {
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  try {
    await favourites.toggle(props.targetType, props.targetId)
  } catch (error) {
    errorMessage.value = error.message
  }
}
</script>

<template>
  <span class="favourite-button d-inline-flex align-items-center gap-2">
    <button
      type="button"
      class="btn btn-sm fav-btn"
      :class="withLabel ? '' : 'rounded-circle icon-only'"
      :aria-pressed="saved"
      :aria-label="label"
      :title="label"
      :disabled="busy"
      @click.stop.prevent="onClick"
    >
      <i class="bi" :class="saved ? 'bi-heart-fill text-brick' : 'bi-heart'" aria-hidden="true"></i>
      <span v-if="withLabel" class="ms-1">{{ saved ? 'Saved' : 'Save' }}</span>
    </button>
    <span v-if="errorMessage" class="small text-brick" role="alert">{{ errorMessage }}</span>
  </span>
</template>

<style scoped>
/* Sits above a card's stretched link, so clicking the heart doesn't open the card. */
.favourite-button {
  position: relative;
  z-index: 2;
}

/* Neutral outline; when saved, only the heart is coloured */
.fav-btn {
  border: 1px solid var(--line-strong);
  background: var(--bg);
  color: var(--ink);
}

.fav-btn:hover,
.fav-btn:focus-visible {
  background: var(--sub);
  border-color: var(--dim);
  color: var(--ink);
}

.icon-only {
  width: 2rem;
  height: 2rem;
  padding: 0;
}
</style>
