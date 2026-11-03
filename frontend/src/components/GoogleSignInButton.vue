<script setup>
// "Continue with Google" with an "or" line above it, for the Login and Register pages.
// Uses the client ID from src/utils/googleSignIn.js (or VITE_GOOGLE_CLIENT_ID in frontend/.env).
// Emits credential (the ID token to send to the backend) or error (a message to show).
import { onMounted, ref } from 'vue'
import { GOOGLE_CLIENT_ID, renderGoogleButton } from '../utils/googleSignIn.js'

const props = defineProps({
  // Google's wording: 'continue_with' ("Continue with Google") or 'signup_with' ("Sign up with Google")
  text: { type: String, default: 'continue_with' }
})
const emit = defineEmits(['credential', 'error'])

const box = ref(null)

onMounted(() => {
  if (!box.value) return
  renderGoogleButton(box.value, (credential) => emit('credential', credential), props.text)
    .catch((err) => emit('error', err.message))
})
</script>

<template>
  <div v-if="GOOGLE_CLIENT_ID">
    <div class="d-flex align-items-center gap-3 my-3 text-secondary small" aria-hidden="true">
      <hr class="flex-grow-1 m-0" /> or <hr class="flex-grow-1 m-0" />
    </div>
    <div ref="box" class="d-flex justify-content-center" style="min-height: 44px"></div>
  </div>
</template>
