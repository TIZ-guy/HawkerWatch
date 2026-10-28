// Who is logged in, shared by every component that calls useAuthStore().
// Usage in a component: const auth = useAuthStore(), then auth.user (null when logged out) or auth.isLoggedIn.
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as authService from '@/services/authService.js'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref(null)
  // false until we've asked the backend whether the login cookie is still valid
  const checked = ref(false)

  // Getters
  const isLoggedIn = computed(() => Boolean(user.value))
  const isAdmin = computed(() => user.value?.role === 'admin')

  // Actions
  let checking = null

  // Asks the backend once per page load; later calls reuse the same answer.
  function loadCurrentUser() {
    checking ||= authService
      .getCurrentUser()
      .then((current) => { user.value = current })
      .catch(() => { user.value = null })
      .finally(() => { checked.value = true })
    return checking
  }

  // Returns { twoFactorRequired: true, challengeToken } when a code is still needed (see loginTwoFactor).
  async function login(credentials) {
    const result = await authService.login(credentials)
    if (result.user) user.value = result.user
    return result
  }

  async function loginTwoFactor(details) {
    user.value = await authService.loginTwoFactor(details)
  }

  async function enableTwoFactor(code) {
    user.value = await authService.enableTwoFactor({ code })
  }

  async function disableTwoFactor(details) {
    user.value = await authService.disableTwoFactor(details)
  }

  async function register(details) {
    user.value = await authService.register(details)
  }

  async function updateName(name) {
    user.value = await authService.updateMe({ name })
  }

  async function changePassword(passwords) {
    await authService.changePassword(passwords)
  }

  async function logout() {
    await authService.logout()
    user.value = null
  }

  return {
    user, checked, isLoggedIn, isAdmin,
    loadCurrentUser, login, loginTwoFactor, register, updateName, changePassword, logout,
    startTwoFactorSetup: authService.startTwoFactorSetup, enableTwoFactor, disableTwoFactor
  }
})
