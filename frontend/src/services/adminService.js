// Calls for the admin page (backend/routes/adminRoutes.js). Every call needs an admin login (403 otherwise).
import axios from 'axios'
import { API_URL, toError } from './apiClient.js'

// { pendingStalls, listedStalls, removedStalls, users, liveReports, flaggedReports }
export async function getOverview() {
  try {
    const response = await axios.get(`${API_URL}/admin/overview`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// status: 'pending' (waiting for approval), 'listed' or 'removed'. Newest first, up to 100.
// Each stall has hawkerCentre { _id, name } and addedBy { _id, name, email } (or null).
export async function getAdminStalls({ status, search } = {}) {
  try {
    const response = await axios.get(`${API_URL}/admin/stalls`, { params: { status, search: search || undefined } })
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

export async function approveStall(stallId) {
  try {
    const response = await axios.post(`${API_URL}/admin/stalls/${stallId}/approve`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// Deletes a stall that was waiting for approval
export async function rejectStall(stallId) {
  try {
    const response = await axios.post(`${API_URL}/admin/stalls/${stallId}/reject`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// Brings back a removed stall. 409 if another stall at the centre has its name now.
export async function restoreStall(stallId) {
  try {
    const response = await axios.post(`${API_URL}/admin/stalls/${stallId}/restore`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// Newest reports, expired ones included. flagged: true for only reports flagged at least once.
// Returns { reports, hideThreshold }; each report has user { name, email }, flagCount, live and hidden.
export async function getAdminReports({ flagged } = {}) {
  try {
    const response = await axios.get(`${API_URL}/admin/reports`, { params: { flagged: flagged ? 'true' : undefined } })
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// Deletes a report for good
export async function deleteReport(reportId) {
  try {
    const response = await axios.delete(`${API_URL}/reports/${reportId}`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// Imports NEA's hawker centres and closures from data.gov.sg now. Takes a few seconds.
// Returns { status, recordsFetched, recordsCreated, recordsUpdated, ... }.
export async function importCentres() {
  try {
    const response = await axios.post(`${API_URL}/admin/import-centres`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}
