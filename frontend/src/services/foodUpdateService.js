// Calls for the food update endpoints (backend/routes/foodUpdateRoutes.js).
import axios from 'axios'
import { API_URL, toError } from './apiClient.js'

// Needs a login. One update per user per stall every 15 minutes (409 otherwise).
// position { lat, lng } is needed while the location check is on (403 if too far from the centre).
// note is optional (up to 140 characters). Returns { id, stall, hawkerCentre, type, note, createdAt, expiresAt, flagCount }.
export async function submitFoodUpdate(stallId, type, note, position) {
  try {
    const response = await axios.post(`${API_URL}/food-updates`, { stallId, type, note, lat: position?.lat, lng: position?.lng })
    return response.data.data.foodUpdate
  } catch (error) {
    throw toError(error)
  }
}

// Today's live food updates for one stall, newest first. Each has an id, type, note, createdAt and expiresAt.
export async function getFoodUpdates(stallId) {
  try {
    const response = await axios.get(`${API_URL}/food-updates`, { params: { stallId } })
    return response.data.data.foodUpdates
  } catch (error) {
    throw toError(error)
  }
}

// Needs a login. Can't flag your own update (400) or the same one twice (409).
// Returns { flagCount, hidden }; hidden is true once enough users have flagged it.
export async function flagFoodUpdate(id) {
  try {
    const response = await axios.post(`${API_URL}/food-updates/${id}/flag`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}
