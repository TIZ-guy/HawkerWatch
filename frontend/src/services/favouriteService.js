// Calls for the favourites endpoints (backend/routes/favouriteRoutes.js). All need a login.
import axios from 'axios'
import { API_URL, toError } from './apiClient.js'

// The user's favourites, newest first, with `target` filled in with the stall or centre.
export async function getFavourites() {
  try {
    const response = await axios.get(`${API_URL}/favourites`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// targetType: 'Stall' or 'HawkerCentre'. The returned favourite has `target` as an id only.
export async function addFavourite(targetType, target) {
  try {
    const response = await axios.post(`${API_URL}/favourites`, { targetType, target })
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

export async function removeFavourite(id) {
  try {
    const response = await axios.delete(`${API_URL}/favourites/${id}`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// alert: { enabled, days: [0-6, 0 = Sunday], time: 'HH:mm' }
export async function updateFavouriteAlert(id, alert) {
  try {
    const response = await axios.patch(`${API_URL}/favourites/${id}/alert`, alert)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}
