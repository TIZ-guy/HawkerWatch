<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/useAuthStore.js'
import PasswordInput from '../components/PasswordInput.vue'
import PasswordChecklist from '../components/PasswordChecklist.vue'
import GoogleSignInButton from '../components/GoogleSignInButton.vue'
import { meetsPasswordRules } from '../utils/passwordRules.js'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const form = reactive({ name: '', email: '', password: '', confirmPassword: '' })
const error = ref('')
const submitting = ref(false)

// An old error is out of date as soon as the user changes something
watch(form, () => { error.value = '' })

// Checked in the browser for quick feedback; the backend checks again.
const problem = computed(() => {
  if (!form.name || !form.email || !form.password) return 'Please fill in every field.'
  if (!meetsPasswordRules(form.password)) return 'Your password needs everything in the checklist below it.'
  if (form.password !== form.confirmPassword) return 'Passwords do not match.'
  return ''
})

async function submit() {
  error.value = problem.value
  if (error.value) return

  submitting.value = true
  try {
    await auth.register({ name: form.name, email: form.email, password: form.password })
    goBack()
  } catch (err) {
    error.value = err.message
  } finally {
    submitting.value = false
  }
}

const goBack = () => router.push(typeof route.query.redirect === 'string' ? route.query.redirect : '/')

// Signing up with Google logs straight in. If that Google email already has an account with
// two-factor login on, the Login page asks for the code.
async function onGoogleCredential(credential) {
  error.value = ''
  submitting.value = true
  try {
    const result = await auth.loginWithGoogle(credential)
    if (result.twoFactorRequired) {
      router.push({ path: '/login', query: route.query, state: { challengeToken: result.challengeToken } })
      return
    }
    goBack()
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
        <h1 class="h2 fw-bold mt-2 mb-4">Create your account</h1>

        <div class="hw-surface">
          <form class="p-4" novalidate @submit.prevent="submit">
            <div v-if="error" class="alert alert-warning py-2" role="alert" data-testid="register-error">{{ error }}</div>

            <div class="mb-3">
              <label for="register-name" class="form-label fw-semibold">Name</label>
              <input id="register-name" data-testid="register-name" v-model.trim="form.name" type="text" class="form-control"
                autocomplete="name" maxlength="60" required />
            </div>

            <div class="mb-3">
              <label for="register-email" class="form-label fw-semibold">Email</label>
              <input id="register-email" data-testid="register-email" v-model.trim="form.email" type="email" class="form-control"
                autocomplete="email" required />
            </div>

            <div class="mb-3">
              <label for="register-password" class="form-label fw-semibold">Password</label>
              <PasswordInput id="register-password" data-testid="register-password" v-model="form.password"
                autocomplete="new-password" aria-describedby="register-password-rules" required />
              <PasswordChecklist id="register-password-rules" :password="form.password" />
            </div>

            <div class="mb-4">
              <label for="register-confirm" class="form-label fw-semibold">Confirm password</label>
              <PasswordInput id="register-confirm" data-testid="register-confirm" v-model="form.confirmPassword" autocomplete="new-password" required />
            </div>

            <button type="submit" class="btn hw-btn-primary w-100" data-testid="register-submit" :disabled="submitting">
              <span v-if="submitting" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              {{ submitting ? 'Creating account…' : 'Create account' }}
            </button>

            <GoogleSignInButton text="signup_with" @credential="onGoogleCredential" @error="error = $event" />
          </form>
        </div>

        <p class="text-center text-secondary mt-3 mb-0">
          Already have an account?
          <RouterLink :to="{ path: '/login', query: route.query }" class="text-brick fw-semibold">Log in</RouterLink>
        </p>
      </div>
    </div>
  </main>
</template>
