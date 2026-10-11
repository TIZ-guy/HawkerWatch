// Shared helper for calling the HawkerWatch backend.
// In development Vite forwards /api to the backend (see vite.config.js).
// Set VITE_API_URL in frontend/.env only if the API lives somewhere else.
const BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Returns the response's `data` on success, throws an Error with the backend's message otherwise.
// Usage: const data = await apiRequest('/hawker-centres')
//        await apiRequest('/favourites', { method: 'POST', body: { stallId } })
export async function apiRequest(path, { method = 'GET', body } = {}) {
  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      // Sends the login cookie with every request. Without this the backend sees everyone as logged out.
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    })
  } catch {
    throw new Error("Can't reach the server. Please check your connection and try again.")
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success) {
    const error = new Error(payload?.message || 'Something went wrong. Please try again.')
    error.status = response.status
    throw error
  }
  return payload.data
}
