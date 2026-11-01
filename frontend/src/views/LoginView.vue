<script setup>
import { nextTick, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/useAuthStore.js'
import PasswordInput from '../components/PasswordInput.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const form = reactive({ email: '', password: '' })
const error = ref('')
const submitting = ref(false)

// Step 2 for accounts with two-factor login: set when the password was right but a code is needed.
const challengeToken = ref('')
const code = ref('')
const codeInput = ref(null)

// Pages that need a login send people here with ?redirect=/where-they-were
const goBack = () => router.push(typeof route.query.redirect === 'string' ? route.query.redirect : '/')

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
    const result = await auth.login(form)
    if (result.twoFactorRequired) {
      challengeToken.value = result.challengeToken
      await nextTick()
      codeInput.value?.focus()
      return
    }
    goBack()
  } catch (err) {
    error.value = err.message
  } finally {
    submitting.value = false
  }
}

async function submitCode() {
  if (!code.value.trim()) {
    error.value = 'Please enter the 6-digit code from your authenticator app.'
    return
  }
  error.value = ''
  submitting.value = true
  try {
    await auth.loginTwoFactor({ challengeToken: challengeToken.value, code: code.value })
    goBack()
  } catch (err) {
    error.value = err.message
    code.value = ''
    // The code step only lasts 5 minutes; after that the password is needed again.
    if (err.message.includes('timed out')) challengeToken.value = ''
  } finally {
    submitting.value = false
  }
}

function startOver() {
  challengeToken.value = ''
  code.value = ''
  form.password = ''
  error.value = ''
}
</script>

<template>
  <main class="container py-5">
    <div class="row justify-content-center">
      <div class="col-sm-10 col-md-7 col-lg-5">
        <h1 class="h2 fw-bold mt-2 mb-4">Log in to HawkerWatch</h1>

        <div class="hw-surface">
          <form v-if="!challengeToken" class="p-4" novalidate @submit.prevent="submit">
            <div v-if="error" class="alert alert-warning py-2" role="alert" data-testid="login-error">{{ error }}</div>

            <div class="mb-3">
              <label for="login-email" class="form-label fw-semibold">Email</label>
              <input id="login-email" data-testid="login-email" v-model.trim="form.email" type="email" class="form-control"
                autocomplete="email" required />
            </div>

            <div class="mb-4">
              <label for="login-password" class="form-label fw-semibold">Password</label>
              <PasswordInput id="login-password" data-testid="login-password" v-model="form.password" autocomplete="current-password" required />
            </div>

            <button type="submit" class="btn hw-btn-primary w-100" data-testid="login-submit" :disabled="submitting">
              <span v-if="submitting" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              {{ submitting ? 'Logging in…' : 'Log in' }}
            </button>
          </form>

          <form v-else class="p-4" novalidate @submit.prevent="submitCode">
            <div v-if="error" class="alert alert-warning py-2" role="alert">{{ error }}</div>

            <h2 class="h5"><i class="bi bi-shield-lock me-2" aria-hidden="true"></i>Two-factor login</h2>
            <p class="text-secondary small">Open your authenticator app and enter the 6-digit code for HawkerWatch.</p>

            <div class="mb-4">
              <label for="login-code" class="form-label fw-semibold">Code</label>
              <input id="login-code" ref="codeInput" v-model.trim="code" class="form-control form-control-lg text-center"
                inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="123456" required />
            </div>

            <button type="submit" class="btn hw-btn-primary w-100" :disabled="submitting">
              <span v-if="submitting" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              {{ submitting ? 'Checking…' : 'Verify' }}
            </button>
            <button type="button" class="btn btn-link text-secondary w-100 mt-2" @click="startOver">
              Use a different account
            </button>
          </form>
        </div>

        <p class="text-center text-secondary mt-3 mb-0">
          New to HawkerWatch?
          <RouterLink :to="{ path: '/register', query: route.query }" class="text-brick fw-semibold">Create an account</RouterLink>
        </p>
      </div>
    </div>
  </main>
</template>
