// Calls for the hawker-centre and stall endpoints (backend/routes/hawkerCentreRoutes.js, stallRoutes.js).
import { apiRequest } from './apiClient.js'

// Builds "?a=1&b=2", leaving out empty values. Returns '' when nothing is set.
function toQuery(params = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

// Optional: search (name or address), lat + lng + radius (metres) for nearest-first results.
export const getHawkerCentres = ({ search, lat, lng, radius } = {}) =>
  apiRequest(`/hawker-centres${toQuery({ search, lat, lng, radius })}`)

export const getHawkerCentre = (id) => apiRequest(`/hawker-centres/${id}`)

// Each stall includes liveReport: its newest live community report, or null.
export const getHawkerCentreStalls = (id, { search, cuisine } = {}) =>
  apiRequest(`/hawker-centres/${id}/stalls${toQuery({ search, cuisine })}`)

// { windowMinutes, stallsReported, byStatus: { OPEN: 0, ... }, latestReportAt }
export const getCommunitySummary = (id) => apiRequest(`/hawker-centres/${id}/community-summary`)

// Stalls across all centres. Each includes hawkerCentre: { _id, name, address }.
export const getStalls = ({ search, cuisine } = {}) => apiRequest(`/stalls${toQuery({ search, cuisine })}`)

export const getStall = (id) => apiRequest(`/stalls/${id}`)

// Live reports for one stall, newest first.
export const getStallReports = (id) => apiRequest(`/stalls/${id}/reports`)
