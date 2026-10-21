<script setup>
// Form for adding a stall to a centre, or editing a stall's details.
// No official stall list exists, so stalls are added by users.
// Add:  <StallForm :centre-id="centre._id" v-on:saved="onAdded" v-on:cancel="..." />
// Edit: <StallForm :stall="stall" v-on:saved="onUpdated" v-on:cancel="..." />
// Emits saved(stall) after a successful save, or cancel.
import { computed, ref } from 'vue'
import { addStall, updateStall } from '../services/hawkerService.js'

const props = defineProps({
  centreId: { type: String, default: '' }, // for adding
  stall: { type: Object, default: null } // for editing
})
const emit = defineEmits(['saved', 'cancel'])

const editing = computed(() => Boolean(props.stall))

const name = ref(props.stall ? props.stall.name : '')
const cuisine = ref(props.stall?.cuisine || '')
const unitNumber = ref(props.stall?.unitNumber || '')
const saving = ref(false)
const errorMessage = ref('')

async function save() {
  errorMessage.value = ''
  if (name.value.trim().length < 2) {
    errorMessage.value = 'Enter the stall name.'
    return
  }
  saving.value = true
  const details = { name: name.value, cuisine: cuisine.value, unitNumber: unitNumber.value }
  try {
    if (editing.value) {
      emit('saved', await updateStall(props.stall._id, details))
    } else {
      emit('saved', await addStall(props.centreId, details))
    }
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="card border-0 shadow-sm" v-on:submit.prevent="save">
    <div class="card-body p-4">
      <h3 class="h6 mb-3">{{ editing ? 'Edit stall details' : 'Add a stall' }}</h3>
      <p v-if="!editing" class="small text-secondary">
        Stall names aren't published officially, so diners add them. Please only add stalls that are really here.
      </p>

      <div class="row g-3">
        <div class="col-md-6">
          <label :for="`stall-name-${stall?._id || 'new'}`" class="form-label small fw-semibold">Stall name</label>
          <input :id="`stall-name-${stall?._id || 'new'}`" v-model="name" type="text" class="form-control" maxlength="60" placeholder="e.g. Ah Hock Chicken Rice" required />
        </div>
        <div class="col-6 col-md-3">
          <label :for="`stall-cuisine-${stall?._id || 'new'}`" class="form-label small fw-semibold">Cuisine <span class="fw-normal text-secondary">(optional)</span></label>
          <input :id="`stall-cuisine-${stall?._id || 'new'}`" v-model="cuisine" type="text" class="form-control" maxlength="40" placeholder="e.g. Chicken rice" />
        </div>
        <div class="col-6 col-md-3">
          <label :for="`stall-unit-${stall?._id || 'new'}`" class="form-label small fw-semibold">Unit no. <span class="fw-normal text-secondary">(optional)</span></label>
          <div class="input-group">
            <span class="input-group-text">#</span>
            <input :id="`stall-unit-${stall?._id || 'new'}`" v-model="unitNumber" type="text" class="form-control" maxlength="10" placeholder="01-23" />
          </div>
        </div>
      </div>

      <p v-if="errorMessage" class="small text-danger mt-3 mb-0" role="alert">{{ errorMessage }}</p>

      <div class="d-flex justify-content-end gap-2 mt-3">
        <button type="button" class="btn btn-sm btn-link text-secondary" v-on:click="emit('cancel')">Cancel</button>
        <button type="submit" class="btn btn-sm btn-danger" :disabled="saving">
          {{ saving ? 'Saving...' : editing ? 'Save changes' : 'Add stall' }}
        </button>
      </div>
    </div>
  </form>
</template>
