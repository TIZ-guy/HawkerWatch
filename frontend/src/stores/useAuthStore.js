// Who is logged in, shared by every component that calls useAuthStore().
// Usage in a component: const auth = useAuthStore(), then auth.state.user (null when logged out).
import { reactive, readonly } from 'vue'
import * as authService from '../services/authService.js'

const state = reactive({
  user: null,
  // false until we've asked the backend whether the login cookie is still valid
  checked: false
})

let checking = null

// Asks the backend once per page load; later calls reuse the same answer.
function loadCurrentUser() {
  checking ||= authService
    .getCurrentUser()
    .then((user) => { state.user = user })
    .catch(() => { state.user = null })
    .finally(() => { state.checked = true })
  return checking
}

// Returns { twoFactorRequired: true, challengeToken } when a code is still needed (see loginTwoFactor).
async function login(credentials) {
  const result = await authService.login(credentials)
  if (result.user) state.user = result.user
  return result
}

async function loginTwoFactor(details) {
  state.user = await authService.loginTwoFactor(details)
}

async function enableTwoFactor(code) {
  state.user = await authService.enableTwoFactor({ code })
}

async function disableTwoFactor(details) {
  state.user = await authService.disableTwoFactor(details)
}

async function register(details) {
  state.user = await authService.register(details)
}

async function updateName(name) {
  state.user = await authService.updateMe({ name })
}

async function changePassword(passwords) {
  await authService.changePassword(passwords)
}

async function logout() {
  await authService.logout()
  state.user = null
}

export function useAuthStore() {
  return {
    state: readonly(state), loadCurrentUser, login, loginTwoFactor, register, updateName, changePassword, logout,
    startTwoFactorSetup: authService.startTwoFactorSetup, enableTwoFactor, disableTwoFactor
  }
}
