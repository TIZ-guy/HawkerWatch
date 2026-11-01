<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/useAuthStore.js'

const auth = useAuthStore()
const router = useRouter()
const loggingOut = ref(false)

async function logOut() {
  loggingOut.value = true
  try {
    await auth.logout()
    router.push('/')
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <nav class="navbar navbar-expand-lg bg-white border-bottom sticky-top">
    <div class="container py-2">
      <RouterLink class="navbar-brand fw-bold hw-title" to="/">Hawker<span class="text-brick">Watch</span></RouterLink>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div id="mainNav" class="collapse navbar-collapse">
        <div class="navbar-nav ms-auto gap-lg-2 align-items-lg-center">
          <RouterLink class="nav-link" to="/">Discover</RouterLink>
          <RouterLink class="nav-link" to="/map">Map</RouterLink>
          <RouterLink class="nav-link" to="/reports">Reports</RouterLink>
          <RouterLink class="nav-link" to="/favourites">Saved</RouterLink>
          <RouterLink class="nav-link" to="/profile">Profile</RouterLink>

          <!-- Hidden until we know whether the user is logged in, so the buttons don't flicker -->
          <template v-if="auth.checked">
            <template v-if="auth.user">
              <span class="navbar-text ms-lg-2 small" data-testid="nav-user-name">{{ auth.user.name }}</span>
              <button type="button" class="btn btn-outline-dark btn-sm" data-testid="nav-logout" :disabled="loggingOut" @click="logOut">
                Log out
              </button>
            </template>
            <RouterLink v-else class="btn hw-btn-primary btn-sm ms-lg-2" data-testid="nav-login" to="/login">Log in</RouterLink>
          </template>
        </div>
      </div>
    </div>
  </nav>

  <RouterView />
</template>
