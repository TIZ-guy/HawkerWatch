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

async function login(credentials) {
  state.user = await authService.login(credentials)
}

async function register(details) {
  state.user = await authService.register(details)
}

async function logout() {
  await authService.logout()
  state.user = null
}

export function useAuthStore() {
  return { state: readonly(state), loadCurrentUser, login, register, logout }
}
