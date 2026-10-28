import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useAuthStore } from '@/stores/useAuthStore.js'
import { useFavouriteStore } from '@/stores/useFavouriteStore.js'
import * as favouriteService from '@/services/favouriteService.js'

// Pretend backend, so the store's logic is tested without a server
vi.mock('@/services/favouriteService.js', () => ({
  getFavourites: vi.fn(),
  addFavourite: vi.fn(),
  removeFavourite: vi.fn(),
  updateFavouriteAlert: vi.fn()
}))

const CENTRE = { _id: 'f1', targetType: 'HawkerCentre', target: { _id: 'c1', name: 'Maxwell' } }
const STALL = { _id: 'f2', targetType: 'Stall', target: { _id: 's1', name: 'Tian Tian' } }

// Logging in is what makes the favourites store fetch, so most tests start here
async function loggedInStore(items = [CENTRE, STALL]) {
  favouriteService.getFavourites.mockResolvedValue(items)
  const favourites = useFavouriteStore()
  useAuthStore().user = { _id: 'u1', name: 'Demo' }
  await nextTick()
  await favourites.load()
  return favourites
}

describe('useFavouriteStore', () => {
  beforeEach(() => {
    // A fresh Pinia per test, so one test's favourites don't leak into the next
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('stays empty and does not fetch while logged out', () => {
    const favourites = useFavouriteStore()

    expect(favourites.items).toEqual([])
    expect(favouriteService.getFavourites).not.toHaveBeenCalled()
  })

  it('loads the favourites once someone logs in, and splits them into centres and stalls', async () => {
    const favourites = await loggedInStore()

    expect(favouriteService.getFavourites).toHaveBeenCalledTimes(1)
    expect(favourites.count).toBe(2)
    expect(favourites.centres).toEqual([CENTRE])
    expect(favourites.stalls).toEqual([STALL])
  })

  it('does not fetch again when already loaded, unless asked to refresh', async () => {
    const favourites = await loggedInStore()

    await favourites.load()
    expect(favouriteService.getFavourites).toHaveBeenCalledTimes(1)

    await favourites.load({ refresh: true })
    expect(favouriteService.getFavourites).toHaveBeenCalledTimes(2)
  })

  it('finds a favourite by what it points at', async () => {
    const favourites = await loggedInStore()

    expect(favourites.find('Stall', 's1')).toEqual(STALL)
    expect(favourites.find('Stall', 'c1')).toBeNull()
  })

  it('toggle adds a favourite that is not saved yet', async () => {
    const favourites = await loggedInStore([])
    const created = { _id: 'f3', targetType: 'Stall', target: 's9' }
    favouriteService.addFavourite.mockResolvedValue(created)

    await favourites.toggle('Stall', 's9')

    expect(favouriteService.addFavourite).toHaveBeenCalledWith('Stall', 's9')
    expect(favourites.items).toEqual([created])
  })

  it('toggle removes a favourite that is already saved', async () => {
    const favourites = await loggedInStore()
    favouriteService.removeFavourite.mockResolvedValue()

    await favourites.toggle('Stall', 's1')

    expect(favouriteService.removeFavourite).toHaveBeenCalledWith('f2')
    expect(favourites.items).toEqual([CENTRE])
  })

  it('keeps the list unchanged and clears pending when the backend refuses', async () => {
    const favourites = await loggedInStore([])
    favouriteService.addFavourite.mockRejectedValue(new Error('Too many requests'))

    await expect(favourites.toggle('Stall', 's9')).rejects.toThrow('Too many requests')

    expect(favourites.items).toEqual([])
    expect(favourites.isPending('s9')).toBe(false)
  })

  it('shows the error message when loading fails', async () => {
    favouriteService.getFavourites.mockRejectedValue(new Error('Server unavailable'))
    const favourites = useFavouriteStore()

    await favourites.load()

    expect(favourites.error).toBe('Server unavailable')
    expect(favourites.loaded).toBe(false)
  })

  it('empties the list when the user logs out', async () => {
    const favourites = await loggedInStore()

    useAuthStore().user = null
    await nextTick()

    expect(favourites.items).toEqual([])
  })
})
