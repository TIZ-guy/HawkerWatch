// Calls for the community report endpoints (backend/routes/reportRoutes.js).
import axios from 'axios'
import { API_URL, toError } from './apiClient.js'

// Needs a login. One report per user per stall every 15 minutes (409 otherwise).
// Returns { id, stall, hawkerCentre, status, createdAt, expiresAt, flagCount }.
export async function submitReport(stallId, status) {
  try {
    const response = await axios.post(`${API_URL}/reports`, { stallId, status })
    return response.data.data.report
  } catch (error) {
    throw toError(error)
  }
}

// Needs a login. Can't flag your own report (400) or the same report twice (409).
// Returns { flagCount, hidden }; hidden is true once enough users have flagged it.
export async function flagReport(reportId) {
  try {
    const response = await axios.post(`${API_URL}/reports/${reportId}/flag`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}
