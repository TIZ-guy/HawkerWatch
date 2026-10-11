// Calls for the community report endpoints (backend/routes/reportRoutes.js).
import { apiRequest } from './apiClient.js'

// Needs a login. One report per user per stall every 15 minutes (409 otherwise).
// Returns { id, stall, hawkerCentre, status, createdAt, expiresAt, flagCount }.
export const submitReport = (stallId, status) =>
  apiRequest('/reports', { method: 'POST', body: { stallId, status } }).then((data) => data.report)
