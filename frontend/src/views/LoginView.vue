<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/useAuthStore.js'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const form = reactive({ email: '', password: '' })
const error = ref('')
const submitting = ref(false)

async function submit() {
  // Checked here rather than by disabling the button, because browser autofill
  // can fill the boxes without Vue noticing until the user clicks.
  if (!form.email || !form.password) {
    error.value = 'Please enter your email and password.'
    return
  }
  error.value = ''
  submitting.value = true
  try {
    await auth.login(form)
    // Pages that need a login send people here with ?redirect=/where-they-were
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
        <span class="eyebrow">Welcome back</span>
        <h1 class="h2 fw-bold mt-2 mb-4">Log in to HawkerWatch</h1>

        <div class="card border-0 shadow-sm">
          <form class="card-body p-4" novalidate @submit.prevent="submit">
            <div v-if="error" class="alert alert-danger py-2" role="alert">{{ error }}</div>

            <div class="mb-3">
              <label for="login-email" class="form-label fw-semibold">Email</label>
              <input id="login-email" v-model.trim="form.email" type="email" class="form-control"
                autocomplete="email" required />
            </div>

            <div class="mb-4">
              <label for="login-password" class="form-label fw-semibold">Password</label>
              <input id="login-password" v-model="form.password" type="password" class="form-control"
                autocomplete="current-password" required />
            </div>

            <button type="submit" class="btn btn-danger w-100" :disabled="submitting">
              <span v-if="submitting" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              {{ submitting ? 'Logging in…' : 'Log in' }}
            </button>
          </form>
        </div>

        <p class="text-center text-secondary mt-3 mb-0">
          New to HawkerWatch?
          <RouterLink :to="{ path: '/register', query: route.query }" class="text-danger fw-semibold">Create an account</RouterLink>
        </p>
      </div>
    </div>
  </main>
</template>
