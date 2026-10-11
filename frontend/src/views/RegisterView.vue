<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/useAuthStore.js'

// Matches the backend's limits in authController.js
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 72

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const form = reactive({ name: '', email: '', password: '', confirmPassword: '' })
const error = ref('')
const submitting = ref(false)

// Checked in the browser for quick feedback; the backend checks again.
const problem = computed(() => {
  if (!form.name || !form.email || !form.password) return 'Please fill in every field.'
  if (form.password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  if (form.password.length > MAX_PASSWORD_LENGTH) return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`
  if (form.password !== form.confirmPassword) return 'Passwords do not match.'
  return ''
})

async function submit() {
  error.value = problem.value
  if (error.value) return

  submitting.value = true
  try {
    await auth.register({ name: form.name, email: form.email, password: form.password })
    router.push(typeof route.query.redirect === 'string' ? route.query.redirect : '/')
  } catch (err) {
    error.value = err.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="container py-5">
    <div class="row justify-content-center">
      <div class="col-sm-10 col-md-7 col-lg-5">
        <span class="eyebrow">Join the community</span>
        <h1 class="h2 fw-bold mt-2 mb-4">Create your account</h1>

        <div class="card border-0 shadow-sm">
          <form class="card-body p-4" novalidate @submit.prevent="submit">
            <div v-if="error" class="alert alert-danger py-2" role="alert">{{ error }}</div>

            <div class="mb-3">
              <label for="register-name" class="form-label fw-semibold">Name</label>
              <input id="register-name" v-model.trim="form.name" type="text" class="form-control"
                autocomplete="name" maxlength="60" required />
            </div>

            <div class="mb-3">
              <label for="register-email" class="form-label fw-semibold">Email</label>
              <input id="register-email" v-model.trim="form.email" type="email" class="form-control"
                autocomplete="email" required />
            </div>

            <div class="mb-3">
              <label for="register-password" class="form-label fw-semibold">Password</label>
              <input id="register-password" v-model="form.password" type="password" class="form-control"
                autocomplete="new-password" aria-describedby="register-password-help" required />
              <div id="register-password-help" class="form-text">At least {{ MIN_PASSWORD_LENGTH }} characters.</div>
            </div>

            <div class="mb-4">
              <label for="register-confirm" class="form-label fw-semibold">Confirm password</label>
              <input id="register-confirm" v-model="form.confirmPassword" type="password" class="form-control"
                autocomplete="new-password" required />
            </div>

            <button type="submit" class="btn btn-danger w-100" :disabled="submitting">
              <span v-if="submitting" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              {{ submitting ? 'Creating account…' : 'Create account' }}
            </button>
          </form>
        </div>

        <p class="text-center text-secondary mt-3 mb-0">
          Already have an account?
          <RouterLink :to="{ path: '/login', query: route.query }" class="text-danger fw-semibold">Log in</RouterLink>
        </p>
      </div>
    </div>
  </main>
</template>
