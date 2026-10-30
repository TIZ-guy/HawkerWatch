<script setup>
// Search input with a clear button. Usage: <SearchBar v-model="search" label="Find a centre or stall" />
const search = defineModel({ type: String, default: '' })

defineProps({
  id: { type: String, default: 'search' },
  label: { type: String, default: 'Search' },
  placeholder: { type: String, default: 'Search' }
})
</script>

<template>
  <div>
    <label :for="id" class="form-label hw-label">{{ label }}</label>
    <div class="input-group">
      <span class="input-group-text"><i class="bi bi-search" aria-hidden="true"></i></span>
      <input :id="id" v-model.trim="search" type="search" class="form-control" :placeholder="placeholder" autocomplete="off" />
      <button v-if="search" type="button" class="btn btn-outline-secondary" aria-label="Clear search" @click="search = ''">
        <i class="bi bi-x-lg" aria-hidden="true"></i>
      </button>
    </div>
  </div>
</template>
