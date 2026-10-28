// The logged-in user's favourites, shared by every component that calls useFavouriteStore().
// Loads automatically after login and empties on logout.
// Usage: const favourites = useFavouriteStore(), then favourites.items or favourites.find('Stall', stall._id)
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import * as favouriteService from '@/services/favouriteService.js'
import { useAuthStore } from '@/stores/useAuthStore.js'

// `target` is an object after GET (populated) but only an id after POST.
export const targetId = (favourite) => String(favourite.target?._id ?? favourite.target)

export const useFavouriteStore = defineStore('favourites', () => {
  // State
  const items = ref([])
  const loaded = ref(false)
  const error = ref('')
  // ids of targets with a request in progress, so buttons can't be double-clicked
  const pending = ref([])

  // Getters
  const count = computed(() => items.value.length)
  const centres = computed(() => items.value.filter((item) => item.targetType === 'HawkerCentre'))
  const stalls = computed(() => items.value.filter((item) => item.targetType === 'Stall'))

  // Actions
  let loading = null

  function load({ refresh = false } = {}) {
    if (loading) return loading
    // Already loaded: skip the request unless the page asks for fresh data
    if (loaded.value && !refresh) return Promise.resolve()

    error.value = ''
    loading = favouriteService
      .getFavourites()
      .then((list) => {
        items.value = list
        loaded.value = true
      })
      .catch((err) => { error.value = err.message })
      .finally(() => { loading = null })
    return loading
  }

  function find(targetType, id) {
    return items.value.find((favourite) => favourite.targetType === targetType && targetId(favourite) === String(id)) || null
  }

  function isPending(id) {
    return pending.value.includes(String(id))
  }

  // Adds or removes a favourite. Throws with the backend's message if it fails.
  async function toggle(targetType, id) {
    const key = String(id)
    if (isPending(key)) return
    pending.value.push(key)

    try {
      const existing = find(targetType, key)
      if (existing) {
        await favouriteService.removeFavourite(existing._id)
        items.value = items.value.filter((favourite) => favourite._id !== existing._id)
      } else {
        const created = await favouriteService.addFavourite(targetType, key)
        items.value = [created, ...items.value]
      }
    } finally {
      pending.value = pending.value.filter((item) => item !== key)
    }
  }

  async function remove(favouriteId) {
    await favouriteService.removeFavourite(favouriteId)
    items.value = items.value.filter((favourite) => favourite._id !== favouriteId)
  }

  async function updateAlert(favouriteId, alert) {
    const updated = await favouriteService.updateFavouriteAlert(favouriteId, alert)
    // Keep the filled-in target from the list; the update response only has its id.
    items.value = items.value.map((favourite) =>
      favourite._id === favouriteId ? { ...favourite, alert: updated.alert } : favourite
    )
  }

  // Follow the login: a new user gets their own list, logging out clears it
  const auth = useAuthStore()
  watch(
    () => auth.user?._id,
    (userId) => {
      items.value = []
      loaded.value = false
      error.value = ''
      if (userId) load()
    },
    { immediate: true }
  )

  return { items, loaded, error, pending, count, centres, stalls, load, find, isPending, toggle, remove, updateAlert }
})
