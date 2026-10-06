<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const pageTitle = computed(() => {
  if (route.path === '/map') return 'Explore the map'
  if (route.path === '/favourites') return 'Your favourites'
  if (route.path === '/profile') return 'Your profile'
  return 'What are you craving today?'
})
</script>

<template>
  <main class="container py-5">
    <span class="eyebrow">Singapore food, checked before you go</span>
    <h1 class="display-5 fw-bold mt-2 mb-3">{{ pageTitle }}</h1>
    <p class="lead text-secondary col-lg-7">
      Find official centre information and clearly labelled community updates for a smarter hawker run.
    </p>
    <div class="row g-4 mt-2">
      <div class="col-md-7">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body p-4">
            <label for="search" class="form-label fw-semibold">Find a centre or stall</label>
            <div class="input-group">
              <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
              <input id="search" class="form-control" placeholder="Search hawker centres or stalls" />
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-5">
        <div class="card border-0 shadow-sm h-100 accent-card">
          <div class="card-body p-4">
            <p class="text-uppercase small fw-bold mb-2">Community pulse</p>
            <h2 class="h4">Updates with a timestamp</h2>
            <p class="mb-0 text-secondary">Crowd and queue information is community submitted and may expire after 60 minutes.</p>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
