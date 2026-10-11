// Calls for the favourites endpoints (backend/routes/favouriteRoutes.js). All need a login.
import { apiRequest } from './apiClient.js'

// The user's favourites, newest first, with `target` filled in with the stall or centre.
export const getFavourites = () => apiRequest('/favourites')

// targetType: 'Stall' or 'HawkerCentre'. The returned favourite has `target` as an id only.
export const addFavourite = (targetType, target) =>
  apiRequest('/favourites', { method: 'POST', body: { targetType, target } })

export const removeFavourite = (id) => apiRequest(`/favourites/${id}`, { method: 'DELETE' })

// alert: { enabled, days: [0-6, 0 = Sunday], time: 'HH:mm' }
export const updateFavouriteAlert = (id, alert) =>
  apiRequest(`/favourites/${id}/alert`, { method: 'PATCH', body: alert })
