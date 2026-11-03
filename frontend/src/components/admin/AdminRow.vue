<script setup>
// One item in a list on the Admin page. The details go on the left and the action buttons always sit
// at the top right, however long the details are, so every admin list lines up the same way.
// On narrow screens the buttons stack in a column instead of wrapping under the details.
//   <AdminRow>
//     details...
//     <template #actions><button ...>Remove</button></template>
//     <template #footer><ConfirmBar ... /></template>
//   </AdminRow>
</script>

<template>
  <li class="hw-surface p-3">
    <div class="d-flex align-items-start gap-3">
      <div class="flex-grow-1 min-w-0">
        <slot />
      </div>
      <div v-if="$slots.actions" class="admin-actions d-flex flex-column flex-sm-row gap-2 flex-shrink-0">
        <slot name="actions" />
      </div>
    </div>
    <slot name="footer" />
  </li>
</template>

<style scoped>
/* Button labels stay on one line, so the button column keeps one width */
.admin-actions :deep(.btn) {
  white-space: nowrap;
}
</style>
