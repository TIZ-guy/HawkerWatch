<script setup>
// Search box for a postal code, address or place (e.g. "289876" or "Bedok MRT"), using OneMap.
// One match is picked straight away; several matches are listed for the user to choose from.
// Emits picked({ name, address, postalCode, lat, lng, label }) where label is short text to show,
// and cleared() when the user removes the place.
// Usage: <PlaceSearch :place="place" v-on:picked="usePlace" v-on:cleared="place = null" />
import { ref } from 'vue'
import { searchPlaces } from '../services/locationService.js'

const props = defineProps({
  // The place currently in use (shown with a Clear button), or null
  place: { type: Object, default: null },
  inputId: { type: String, default: 'place-search' },
  // Visible label above the box, styled like SearchBar's. Empty keeps it for screen readers only.
  label: { type: String, default: '' }
})
const emit = defineEmits(['picked', 'cleared'])

const text = ref('')
const matches = ref([])
const searching = ref(false)
const errorMessage = ref('')

// "289876" or "ADAM FOOD CENTRE (289876)" -> what to show once a place is chosen
function labelFor(place) {
  if (!place.postalCode) return place.name
  return place.name === place.postalCode ? place.postalCode : `${place.name} (${place.postalCode})`
}

function pick(place) {
  matches.value = []
  text.value = ''
  emit('picked', { ...place, label: labelFor(place) })
}

async function search() {
  errorMessage.value = ''
  matches.value = []
  const searchText = text.value.trim()
  if (searchText.length < 2) {
    errorMessage.value = 'Enter a postal code or place name.'
    return
  }
  searching.value = true
  try {
    const found = await searchPlaces(searchText)
    if (found.length === 0) {
      errorMessage.value = `No place in Singapore matches "${searchText}".`
    } else if (found.length === 1 || /^\d{6}$/.test(searchText)) {
      pick(found[0]) // a full postal code points to one place, so take the best match
    } else {
      matches.value = found
    }
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    searching.value = false
  }
}
</script>

<template>
  <div class="place-search">
    <!-- Kept outside the input group: Bootstrap only rounds the first box in a group, and a hidden label there would square off the left side -->
    <label :for="props.place ? null : inputId" :class="props.label ? 'form-label fw-semibold' : 'visually-hidden'">
      {{ props.label || 'Postal code or place' }}
    </label>

    <!-- A place is in use: show it in the same box shape as the search, so the layout doesn't jump -->
    <div v-if="props.place" class="input-group">
      <span class="input-group-text bg-white"><i class="bi bi-pin-map-fill text-danger" aria-hidden="true"></i></span>
      <span class="form-control text-truncate" :title="props.place.label">{{ props.place.label }}</span>
      <button type="button" class="btn btn-outline-secondary" aria-label="Clear place" v-on:click="emit('cleared')">
        <i class="bi bi-x-lg" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Otherwise: the search box -->
    <form v-else class="input-group" role="search" v-on:submit.prevent="search">
      <span class="input-group-text bg-white"><i class="bi bi-pin-map" aria-hidden="true"></i></span>
      <input
        :id="inputId"
        v-model="text"
        type="search"
        class="form-control"
        placeholder="Postal code or place, e.g. 289876"
        maxlength="60"
        autocomplete="postal-code"
      />
      <button type="submit" class="btn btn-outline-secondary" :disabled="searching">
        <span v-if="searching" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
        <span :class="{ 'visually-hidden': searching }">Find</span>
      </button>
    </form>

    <p v-if="errorMessage" class="small text-danger mt-2 mb-0" role="alert">{{ errorMessage }}</p>

    <!-- Several matches: let the user choose -->
    <div v-if="matches.length" class="mt-2">
      <p class="small text-secondary mb-1">Did you mean:</p>
      <div class="list-group">
        <button
          v-for="match in matches"
          :key="`${match.lat},${match.lng}`"
          type="button"
          class="list-group-item list-group-item-action small"
          v-on:click="pick(match)"
        >
          <span class="fw-semibold">{{ match.name }}</span>
          <span class="d-block text-secondary">{{ match.address }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
