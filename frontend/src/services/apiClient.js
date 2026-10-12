// Shared settings for calling the HawkerWatch backend with Axios.
// In development Vite forwards /api to the backend (see vite.config.js).
// Set VITE_API_URL in frontend/.env only if the API lives somewhere else.
//
// Every service calls axios directly, for example:
//   const response = await axios.get(`${API_URL}/hawker-centres`)
//   return response.data.data
// The backend always answers { success: true, data } or { success: false, message }.
import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || '/api'

// Sends the login cookie with every request. Without this the backend sees everyone as logged out.
axios.defaults.withCredentials = true

// Turns an Axios error into an Error with the backend's message, which the pages show to the user.
// error.status is the HTTP status (e.g. 404), so pages can react to specific errors.
// Usage: catch (error) { throw toError(error) }
export function toError(error) {
  // No response at all means the request never reached the server.
  if (!error.response) {
    return new Error("Can't reach the server. Please check your connection and try again.")
  }
  const friendly = new Error(error.response.data?.message || 'Something went wrong. Please try again.')
  friendly.status = error.response.status
  return friendly
}
