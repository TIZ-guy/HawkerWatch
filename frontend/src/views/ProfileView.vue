<script setup>
// Account details, name and password changes, two-factor login, and favourite reminders (logged-in users only).
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import FavouriteAlertEditor from '../components/FavouriteAlertEditor.vue'
import LoadingState from '../components/LoadingState.vue'
import ErrorState from '../components/ErrorState.vue'
import PasswordInput from '../components/PasswordInput.vue'
import PasswordChecklist from '../components/PasswordChecklist.vue'
import TwoFactorSettings from '../components/TwoFactorSettings.vue'
import { useAuthStore } from '../stores/useAuthStore.js'
import { useFavouriteStore } from '../stores/useFavouriteStore.js'
import { meetsPasswordRules } from '../utils/passwordRules.js'

const auth = useAuthStore()
const favourites = useFavouriteStore()
const route = useRoute()

const user = computed(() => auth.user)
const memberSince = computed(() =>
  user.value?.createdAt
    ? new Date(user.value.createdAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''
)

// Name
const name = ref(user.value?.name || '')
const savingName = ref(false)
const nameMessage = ref('')
const nameError = ref('')
const nameChanged = computed(() => name.value.trim() && name.value.trim() !== user.value?.name)

async function saveName() {
  nameMessage.value = ''
  nameError.value = ''
  savingName.value = true
  try {
    await auth.updateName(name.value.trim())
    name.value = user.value.name
    nameMessage.value = 'Name updated'
  } catch (error) {
    nameError.value = error.message
  } finally {
    savingName.value = false
  }
}

// Password
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const savingPassword = ref(false)
const passwordMessage = ref('')
const passwordError = ref('')

// An old error is out of date as soon as the user changes a password field
watch([currentPassword, newPassword, confirmPassword], () => { passwordError.value = '' })

async function savePassword() {
  passwordMessage.value = ''
  passwordError.value = ''
  if (!meetsPasswordRules(newPassword.value)) {
    passwordError.value = 'Your new password needs everything in the checklist.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = "The new passwords don't match."
    return
  }

  savingPassword.value = true
  try {
    await auth.changePassword({ currentPassword: currentPassword.value, newPassword: newPassword.value })
    currentPassword.value = newPassword.value = confirmPassword.value = ''
    passwordMessage.value = 'Password changed'
  } catch (error) {
    passwordError.value = error.message
  } finally {
    savingPassword.value = false
  }
}

// Reminders: "Edit" links on the Favourites page open /profile#alerts
const favouritesWithTargets = computed(() => favourites.items.filter((item) => item.target))
const loadingFavourites = ref(true)

onMounted(async () => {
  await favourites.load({ refresh: true })
  loadingFavourites.value = false
  if (route.hash === '#alerts') {
    await nextTick()
    document.getElementById('alerts')?.scrollIntoView({ behavior: 'smooth' })
  }
})
</script>

<template>
  <main class="container py-5">
    <h1 class="display-6 mb-4">Your profile</h1>

    <div class="row g-4 align-items-start">
      <div class="col-lg-5 d-grid gap-4">
        <section class="hw-surface" aria-labelledby="account-heading">
          <div class="p-4">
            <h2 id="account-heading" class="hw-section-title mb-3">Account details</h2>
            <dl class="row mb-0">
              <dt class="col-sm-4 text-secondary fw-normal">Name</dt>
              <dd class="col-sm-8">{{ user?.name }}</dd>
              <dt class="col-sm-4 text-secondary fw-normal">Email</dt>
              <dd class="col-sm-8">{{ user?.email }}</dd>
              <template v-if="memberSince">
                <dt class="col-sm-4 text-secondary fw-normal">Member since</dt>
                <dd class="col-sm-8 mb-0">{{ memberSince }}</dd>
              </template>
            </dl>
          </div>
        </section>

        <section class="hw-surface" aria-labelledby="name-heading">
          <form class="p-4" @submit.prevent="saveName">
            <h2 id="name-heading" class="hw-section-title mb-3">Change name</h2>
            <label for="profile-name" class="form-label">Display name</label>
            <input id="profile-name" v-model="name" class="form-control" maxlength="60" autocomplete="name" required />
            <div class="d-flex flex-wrap align-items-center gap-3 mt-3">
              <button type="submit" class="btn hw-btn-primary" :disabled="!nameChanged || savingName">
                {{ savingName ? 'Saving...' : 'Save name' }}
              </button>
              <span v-if="nameMessage" class="small text-secondary" role="status">{{ nameMessage }}</span>
              <span v-if="nameError" class="small text-brick" role="alert">{{ nameError }}</span>
            </div>
          </form>
        </section>

        <section class="hw-surface" aria-labelledby="password-heading">
          <form class="p-4 d-grid gap-3" @submit.prevent="savePassword">
            <h2 id="password-heading" class="hw-section-title mb-0">Change password</h2>
            <div>
              <label for="current-password" class="form-label">Current password</label>
              <PasswordInput id="current-password" v-model="currentPassword" autocomplete="current-password" required />
            </div>
            <div>
              <label for="new-password" class="form-label">New password</label>
              <PasswordInput id="new-password" v-model="newPassword" autocomplete="new-password"
                aria-describedby="new-password-rules" required />
              <PasswordChecklist id="new-password-rules" :password="newPassword" />
            </div>
            <div>
              <label for="confirm-password" class="form-label">Confirm new password</label>
              <PasswordInput id="confirm-password" v-model="confirmPassword" autocomplete="new-password" required />
            </div>
            <div class="d-flex flex-wrap align-items-center gap-3">
              <button type="submit" class="btn hw-btn-primary" :disabled="savingPassword">
                {{ savingPassword ? 'Saving...' : 'Change password' }}
              </button>
              <span v-if="passwordMessage" class="small text-secondary" role="status">{{ passwordMessage }}</span>
              <span v-if="passwordError" class="small text-brick" role="alert">{{ passwordError }}</span>
            </div>
          </form>
        </section>

        <TwoFactorSettings />
      </div>

      <section id="alerts" class="col-lg-7" aria-labelledby="alerts-heading">
        <div class="hw-surface">
          <div class="p-4">
            <h2 id="alerts-heading" class="hw-section-title mb-1">Favourite reminders</h2>
            <p class="small text-secondary mb-3">
              Choose when you usually visit each favourite. At that time the
              <i class="bi bi-bell" aria-label="bell"></i> in the menu shows one reminder listing every favourite
              set for it, while HawkerWatch is open.
            </p>

            <LoadingState v-if="loadingFavourites" message="Loading your favourites..." />
            <ErrorState v-else-if="favourites.error" :message="favourites.error" />
            <p v-else-if="!favouritesWithTargets.length" class="text-secondary mb-0">
              You haven't saved any favourites yet. Select the <i class="bi bi-heart" aria-label="heart"></i> on a
              <RouterLink to="/">hawker centre or stall</RouterLink> to add one.
            </p>
            <template v-else>
              <FavouriteAlertEditor v-for="favourite in favouritesWithTargets" :key="favourite._id" :favourite="favourite" />
            </template>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
