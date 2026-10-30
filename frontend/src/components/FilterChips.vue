<script setup>
// Toggleable chips. options: [{ value, label, icon? }]
// multiple: v-model is an array of selected values; otherwise a single value ('' when none).
const selected = defineModel({ type: [Array, String], default: () => [] })

const props = defineProps({
  options: { type: Array, required: true },
  multiple: { type: Boolean, default: false },
  label: { type: String, default: 'Filters' },
  small: { type: Boolean, default: false }
})

function isSelected(value) {
  return props.multiple ? selected.value.includes(value) : selected.value === value
}

function toggle(value) {
  if (props.multiple) {
    selected.value = isSelected(value)
      ? selected.value.filter((item) => item !== value)
      : [...selected.value, value]
  } else {
    selected.value = isSelected(value) ? '' : value
  }
}
</script>

<template>
  <div class="d-flex flex-wrap gap-2" role="group" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="hw-chip"
      :class="{ 'py-1': small }"
      :aria-pressed="isSelected(option.value)"
      :title="option.title"
      @click="toggle(option.value)"
    >
      <i v-if="option.icon" class="bi me-1" :class="option.icon" aria-hidden="true"></i>{{ option.label }}
    </button>
  </div>
</template>
