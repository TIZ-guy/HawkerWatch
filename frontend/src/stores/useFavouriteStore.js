import { reactive, readonly, watch } from 'vue'
import * as favouriteService from '../services/favouriteService.js'
import { useAuthStore } from './useAuthStore.js'

const state = reactive({
  items: [],
  loaded: false,
  error: '',
  pending: []
})

let loading = null

export const targetId = (favourite) => String(favourite.target?._id ?? favourite.target)

function load({ refresh = false } = {}) {
  if (loading) return loading
  if (state.loaded && !refresh) return Promise.resolve()

  state.error = ''
  loading = favouriteService
    .getFavourites()
    .then((items) => {
      state.items = items
      state.loaded = true
    })
    .catch((error) => { state.error = error.message })
    .finally(() => { loading = null })
  return loading
}

function find(targetType, id) {
  return state.items.find((favourite) => favourite.targetType === targetType && targetId(favourite) === String(id)) || null
}

function isPending(id) {
  return state.pending.includes(String(id))
}

async function toggle(targetType, id) {
  const key = String(id)
  if (isPending(key)) return
  state.pending.push(key)

  try {
    const existing = find(targetType, key)
    if (existing) {
      await favouriteService.removeFavourite(existing._id)
      state.items = state.items.filter((favourite) => favourite._id !== existing._id)
    } else {
      const created = await favouriteService.addFavourite(targetType, key)
      state.items = [created, ...state.items]
    }
  } finally {
    state.pending = state.pending.filter((item) => item !== key)
  }
}

async function remove(favouriteId) {
  await favouriteService.removeFavourite(favouriteId)
  state.items = state.items.filter((favourite) => favourite._id !== favouriteId)
}

async function updateAlert(favouriteId, alert) {
  const updated = await favouriteService.updateFavouriteAlert(favouriteId, alert)
  state.items = state.items.map((favourite) =>
    favourite._id === favouriteId ? { ...favourite, alert: updated.alert } : favourite
  )
}

const auth = useAuthStore()
watch(
  () => auth.state.user?._id,
  (userId) => {
    state.items = []
    state.loaded = false
    state.error = ''
    if (userId) load()
  },
  { immediate: true }
)

export function useFavouriteStore() {
  return { state: readonly(state), load, find, isPending, toggle, remove, updateAlert }
}
