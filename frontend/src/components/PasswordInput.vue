<script setup>
import { computed, ref } from 'vue'

defineOptions({ inheritAttrs: false })

const password = defineModel({ type: String, default: '' })

const props = defineProps({
  id: { type: String, required: true }
})

const visible = ref(false)
const capsLockOn = ref(false)
const capsLockId = computed(() => `${props.id}-capslock`)

function checkCapsLock(event) {
  capsLockOn.value = Boolean(event.getModifierState?.('CapsLock'))
}
</script>

<template>
  <div>
    <div class="input-group">
      <input
        :id="id"
        v-model="password"
        v-bind="$attrs"
        :type="visible ? 'text' : 'password'"
        class="form-control"
        autocapitalize="off"
        spellcheck="false"
        @keydown="checkCapsLock"
        @keyup="checkCapsLock"
        @blur="capsLockOn = false"
      />
      <button
        type="button"
        class="btn btn-outline-secondary"
        :aria-label="visible ? 'Hide password' : 'Show password'"
        :aria-pressed="visible"
        :aria-controls="id"
        :title="visible ? 'Hide password' : 'Show password'"
        @mousedown.prevent
        @click="visible = !visible"
      >
        <i class="bi" :class="visible ? 'bi-eye-slash' : 'bi-eye'" aria-hidden="true"></i>
      </button>
    </div>
    <div v-if="capsLockOn" :id="capsLockId" class="form-text text-warning-emphasis" role="status">
      <i class="bi bi-capslock-fill me-1" aria-hidden="true"></i>Caps Lock is on
    </div>
  </div>
</template>
