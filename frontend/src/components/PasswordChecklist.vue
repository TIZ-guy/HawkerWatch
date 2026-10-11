<script setup>
// Live list of the password rules, ticked off as the user types.
// Usage: <PasswordChecklist id="register-password-rules" :password="form.password" />
// Point the password input's aria-describedby at the same id so screen readers announce the rules.
import { computed } from 'vue'
import { PASSWORD_RULES } from '../utils/passwordRules.js'

const props = defineProps({
  password: { type: String, default: '' }
})

const rules = computed(() => PASSWORD_RULES.map((rule) => ({ ...rule, met: rule.test(props.password) })))
</script>

<template>
  <ul class="list-unstyled small mt-2 mb-0">
    <li v-for="rule in rules" :key="rule.id" :class="rule.met ? 'text-success' : 'text-secondary'">
      <i class="bi me-1" :class="rule.met ? 'bi-check-circle-fill' : 'bi-circle'" aria-hidden="true"></i>
      {{ rule.label }}
      <span class="visually-hidden">{{ rule.met ? '(done)' : '(still needed)' }}</span>
    </li>
  </ul>
</template>
