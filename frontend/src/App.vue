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
      <RouterLink class="navbar-brand fw-bold text-danger" to="/">
        <i class="bi bi-geo-alt-fill me-2"></i>HawkerWatch
      </RouterLink>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div id="mainNav" class="collapse navbar-collapse">
        <div class="navbar-nav ms-auto gap-lg-2 align-items-lg-center">
          <RouterLink class="nav-link" to="/">Discover</RouterLink>
          <RouterLink class="nav-link" to="/map">Explore Map</RouterLink>
          <RouterLink class="nav-link" to="/reports">Community reports</RouterLink>
          <RouterLink class="nav-link" to="/favourites">Favourites</RouterLink>
          <RouterLink class="nav-link" to="/profile">Profile</RouterLink>

          <!-- Hidden until we know whether the user is logged in, so the buttons don't flicker -->
          <template v-if="auth.state.checked">
            <template v-if="auth.state.user">
              <span class="navbar-text ms-lg-2">
                <i class="bi bi-person-circle me-1"></i>{{ auth.state.user.name }}
              </span>
              <button type="button" class="btn btn-outline-danger btn-sm" :disabled="loggingOut" @click="logOut">
                Log out
              </button>
            </template>
            <RouterLink v-else class="btn btn-danger btn-sm ms-lg-2" to="/login">Log in</RouterLink>
          </template>
        </div>
      </div>
    </div>
  </nav>

  <RouterView />
</template>
