// Calls for the hawker-centre and stall endpoints (backend/routes/hawkerCentreRoutes.js, stallRoutes.js).
// Axios turns `params` into the query string (?search=...&cuisine=...) and leaves out undefined values.
import axios from 'axios'
import { API_URL, toError } from './apiClient.js'

// Optional: search (name or address), lat + lng + radius (metres) for nearest-first results.
export async function getHawkerCentres({ search, lat, lng, radius } = {}) {
  try {
    const response = await axios.get(`${API_URL}/hawker-centres`, { params: { search, lat, lng, radius } })
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

export async function getHawkerCentre(id) {
  try {
    const response = await axios.get(`${API_URL}/hawker-centres/${id}`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// Each stall includes liveReport: its newest live community report, or null.
export async function getHawkerCentreStalls(id, { search, cuisine } = {}) {
  try {
    const response = await axios.get(`${API_URL}/hawker-centres/${id}/stalls`, { params: { search, cuisine } })
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// { windowMinutes, stallsReported, byStatus: { OPEN: 0, ... }, latestReportAt }
export async function getCommunitySummary(id) {
  try {
    const response = await axios.get(`${API_URL}/hawker-centres/${id}/community-summary`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// Stalls across all centres. Each includes hawkerCentre: { _id, name, address }.
export async function getStalls({ search, cuisine } = {}) {
  try {
    const response = await axios.get(`${API_URL}/stalls`, { params: { search, cuisine } })
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

export async function getStall(id) {
  try {
    const response = await axios.get(`${API_URL}/stalls/${id}`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// Live reports for one stall, newest first.
export async function getStallReports(id) {
  try {
    const response = await axios.get(`${API_URL}/stalls/${id}/reports`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}
