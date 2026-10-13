import axios from 'axios'
import { API_URL, toError } from './apiClient.js'

export async function getFavourites() {
  try {
    const response = await axios.get(`${API_URL}/favourites`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

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

export async function updateFavouriteAlert(id, alert) {
  try {
    const response = await axios.patch(`${API_URL}/favourites/${id}/alert`, alert)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}
