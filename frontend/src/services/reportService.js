// Calls for the community report endpoints (backend/routes/reportRoutes.js).
import axios from 'axios'
import { API_URL, toError } from './apiClient.js'

// Needs a login. One report per user per stall every 15 minutes (409 otherwise).
// position { lat, lng } is needed while the location check is on (403 if too far from the centre).
// Returns { id, stall, hawkerCentre, status, createdAt, expiresAt, flagCount }.
export async function submitReport(stallId, status, position) {
  try {
    const response = await axios.post(`${API_URL}/reports`, { stallId, status, lat: position?.lat, lng: position?.lng })
    return response.data.data.report
  } catch (error) {
    throw toError(error)
  }
}

// A stall's current status and how much to trust it, from the live reports (GET /api/reports?stallId=).
// Returns { status, confidence (0-100), level ('high', 'medium' or 'low'), reportCount, lastReportedAt },
// or null when the stall has no live reports.
export async function getStallSummary(stallId) {
  try {
    const response = await axios.get(`${API_URL}/reports`, { params: { stallId } })
    return response.data.data.summary
  } catch (error) {
    throw toError(error)
  }
}

// { locationCheck, maxDistanceMetres }. Asked once per page load.
let settingsRequest = null
export function getReportSettings() {
  settingsRequest ||= axios
    .get(`${API_URL}/reports/settings`)
    .then((response) => response.data.data)
    .catch((error) => {
      settingsRequest = null
      throw toError(error)
    })
  return settingsRequest
}

// Newest live reports across every centre, each with stall { name, ... } and hawkerCentre { name }.
export async function getRecentReports({ status } = {}) {
  try {
    const response = await axios.get(`${API_URL}/reports/recent`, { params: { status } })
    return response.data.data.reports
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
