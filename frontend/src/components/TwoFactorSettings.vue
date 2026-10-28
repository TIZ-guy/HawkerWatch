<script setup>
// Profile page card for turning two-factor login (authenticator app) on and off.
import { computed, ref } from 'vue'
import { useAuthStore } from '../stores/useAuthStore.js'
import PasswordInput from './PasswordInput.vue'

const auth = useAuthStore()
const enabled = computed(() => Boolean(auth.user?.twoFactorEnabled))

// Turning on: setup holds { secret, qrCode } after "Set up" is pressed, until a correct code is entered.
const setup = ref(null)
const code = ref('')
// Turning off: needs the password and a current code.
const turningOff = ref(false)
const password = ref('')

const busy = ref(false)
const message = ref('')
const error = ref('')

// Runs one action with the busy flag, message and error handled the same way.
async function run(action, successMessage) {
  error.value = ''
  message.value = ''
  busy.value = true
  try {
    await action()
    if (successMessage) message.value = successMessage
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

// Phones and tablets get an "Open in authenticator app" button instead of a QR code they can't scan.
const onPhone = window.matchMedia('(pointer: coarse)').matches

const copied = ref(false)
async function copyKey() {
  try {
    await navigator.clipboard.writeText(setup.value.secret)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    error.value = 'Copying failed. Press and hold the key to copy it instead.'
  }
}

const startSetup = () => run(async () => { setup.value = await auth.startTwoFactorSetup() })

const confirmSetup = () => run(async () => {
  await auth.enableTwoFactor(code.value)
  setup.value = null
  code.value = ''
}, 'Two-factor login is on. You will need a code from your app each time you log in.')

const turnOff = () => run(async () => {
  await auth.disableTwoFactor({ password: password.value, code: code.value })
  turningOff.value = false
  password.value = code.value = ''
}, 'Two-factor login is off.')

function cancel() {
  setup.value = null
  turningOff.value = false
  password.value = code.value = error.value = ''
}
</script>

<template>
  <section class="card border-0 shadow-sm" aria-labelledby="two-factor-heading">
    <div class="card-body p-4 d-grid gap-3">
      <div class="d-flex align-items-center justify-content-between gap-2">
        <h2 id="two-factor-heading" class="h5 mb-0">Two-factor login</h2>
        <span class="badge" :class="enabled ? 'text-bg-success' : 'text-bg-secondary'">{{ enabled ? 'On' : 'Off' }}</span>
      </div>

      <p class="small text-secondary mb-0">
        Asks for a 6-digit code from an authenticator app (such as Google Authenticator or Microsoft Authenticator)
        after your password, so a stolen password alone can't get into your account.
      </p>

      <!-- Off, not started -->
      <div v-if="!enabled && !setup">
        <button type="button" class="btn btn-danger" :disabled="busy" @click="startSetup">
          {{ busy ? 'Starting...' : 'Set up two-factor login' }}
        </button>
      </div>

      <!-- Setting up: scan, then confirm with a code -->
      <form v-else-if="!enabled && setup" class="d-grid gap-3" @submit.prevent="confirmSetup">
        <div class="small">
          <p class="fw-semibold mb-1">1. Get an authenticator app (free)</p>
          <p class="text-secondary mb-1">If you don't have one yet, install either of these on your phone:</p>
          <ul class="text-secondary mb-0 ps-3">
            <li>
              <strong>Google Authenticator</strong>:
              <a href="https://apps.apple.com/app/google-authenticator/id388497605" target="_blank" rel="noopener">iPhone</a>
              ·
              <a href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noopener">Android</a>
            </li>
            <li>
              <strong>Microsoft Authenticator</strong>:
              <a href="https://apps.apple.com/app/microsoft-authenticator/id983156458" target="_blank" rel="noopener">iPhone</a>
              ·
              <a href="https://play.google.com/store/apps/details?id=com.azure.authenticator" target="_blank" rel="noopener">Android</a>
            </li>
          </ul>
        </div>

        <!-- On a phone the QR code is on the same screen as the camera, so it can't be scanned:
             open the app directly instead, or copy the key. -->
        <div v-if="onPhone" class="small d-grid gap-2">
          <p class="fw-semibold mb-0">2. Add HawkerWatch to the app</p>
          <a :href="setup.otpauthUrl" class="btn btn-outline-danger">
            <i class="bi bi-box-arrow-up-right me-2" aria-hidden="true"></i>Open in authenticator app
          </a>
          <p class="text-secondary mb-0">
            Nothing happened? In the app, tap <strong>+</strong>, then <strong>Enter a setup key</strong>, and paste this key:
          </p>
          <div class="input-group">
            <input class="form-control font-monospace" :value="setup.secret" readonly aria-label="Setup key" />
            <button type="button" class="btn btn-outline-secondary" @click="copyKey">{{ copied ? 'Copied' : 'Copy' }}</button>
          </div>
          <p class="text-secondary mb-0">Use <strong>Time based</strong> if the app asks.</p>
        </div>

        <div v-else class="small d-grid gap-2">
          <p class="fw-semibold mb-0">2. Scan this QR code with the app</p>
          <p class="text-secondary mb-0">
            In the app, tap <strong>+</strong>, then <strong>Scan a QR code</strong>, and point your phone at this screen.
          </p>
          <img :src="setup.qrCode" alt="QR code to add HawkerWatch to your authenticator app"
            class="border rounded mx-auto d-block" width="180" height="180" />
          <details>
            <summary class="text-secondary">Can't scan? Enter a key instead</summary>
            <p class="text-secondary mt-2 mb-1">In the app, tap <strong>+</strong>, then <strong>Enter a setup key</strong>, and type:</p>
            <code class="d-block user-select-all text-break">{{ setup.secret }}</code>
          </details>
        </div>

        <p class="small fw-semibold mb-0">3. Type the 6-digit code the app now shows for HawkerWatch</p>
        <div>
          <label for="two-factor-setup-code" class="form-label">Code from the app</label>
          <input id="two-factor-setup-code" v-model.trim="code" class="form-control" inputmode="numeric"
            autocomplete="one-time-code" maxlength="7" placeholder="123456" required />
        </div>
        <div class="d-flex flex-wrap gap-2">
          <button type="submit" class="btn btn-danger" :disabled="busy">{{ busy ? 'Checking...' : 'Turn on' }}</button>
          <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="cancel">Cancel</button>
        </div>
      </form>

      <!-- On -->
      <div v-else-if="enabled && !turningOff">
        <button type="button" class="btn btn-outline-danger" @click="turningOff = true; message = ''">
          Turn off two-factor login
        </button>
      </div>

      <!-- Turning off: password and a code -->
      <form v-else class="d-grid gap-3" @submit.prevent="turnOff">
        <div>
          <label for="two-factor-off-password" class="form-label">Password</label>
          <PasswordInput id="two-factor-off-password" v-model="password" autocomplete="current-password" required />
        </div>
        <div>
          <label for="two-factor-off-code" class="form-label">Code from the app</label>
          <input id="two-factor-off-code" v-model.trim="code" class="form-control" inputmode="numeric"
            autocomplete="one-time-code" maxlength="7" placeholder="123456" required />
        </div>
        <div class="d-flex flex-wrap gap-2">
          <button type="submit" class="btn btn-danger" :disabled="busy">{{ busy ? 'Checking...' : 'Turn off' }}</button>
          <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="cancel">Cancel</button>
        </div>
      </form>

      <p v-if="message" class="small text-success mb-0" role="status">{{ message }}</p>
      <p v-if="error" class="small text-danger mb-0" role="alert">{{ error }}</p>
    </div>
  </section>
</template>
