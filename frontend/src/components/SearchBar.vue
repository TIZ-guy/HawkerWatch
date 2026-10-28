<script setup>
// Search input with a clear button. Usage: <SearchBar v-model="search" label="Find a centre or stall" />
// find-button adds a Find button; pressing it or Enter emits submit, so the page can search straight away.
const search = defineModel({ type: String, default: '' })

defineProps({
  id: { type: String, default: 'search' },
  label: { type: String, default: 'Search' },
  placeholder: { type: String, default: 'Search' },
  findButton: { type: Boolean, default: false }
})

const emit = defineEmits(['submit'])
</script>

<template>
  <div>
    <label :for="id" class="form-label fw-semibold">{{ label }}</label>
    <form class="input-group" role="search" @submit.prevent="emit('submit', search)">
      <span class="input-group-text bg-white"><i class="bi bi-search" aria-hidden="true"></i></span>
      <input :id="id" v-model.trim="search" type="search" class="form-control" :placeholder="placeholder" autocomplete="off" />
      <button v-if="search" type="button" class="btn btn-outline-secondary" aria-label="Clear search" @click="search = ''">
        <i class="bi bi-x-lg" aria-hidden="true"></i>
      </button>
      <button v-if="findButton" type="submit" class="btn btn-outline-secondary">Find</button>
    </form>
  </div>
</template>
