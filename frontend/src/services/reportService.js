// Calls for the community report endpoints (backend/routes/reportRoutes.js).
import { apiRequest } from './apiClient.js'

// Needs a login. One report per user per stall every 15 minutes (409 otherwise).
// Returns { id, stall, hawkerCentre, status, createdAt, expiresAt, flagCount }.
export const submitReport = (stallId, status) =>
  apiRequest('/reports', { method: 'POST', body: { stallId, status } }).then((data) => data.report)

// Needs a login. Can't flag your own report (400) or the same report twice (409).
// Returns { flagCount, hidden }; hidden is true once enough users have flagged it.
export const flagReport = (reportId) => apiRequest(`/reports/${reportId}/flag`, { method: 'POST' })
