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

// Newest food updates, expired ones included. flagged: true for only updates flagged at least once.
// Each has user { name, email }, stall, hawkerCentre, type, note, flagCount, live and hidden.
export async function getAdminFoodUpdates({ flagged } = {}) {
  try {
    const response = await axios.get(`${API_URL}/admin/food-updates`, { params: { flagged: flagged ? 'true' : undefined } })
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// Deletes a food update for good
export async function deleteFoodUpdate(id) {
  try {
    const response = await axios.delete(`${API_URL}/food-updates/${id}`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// Newest reviews, each with stall { name, hawkerCentre { name } }, user { name, email }, rating, text and photoCount.
// Delete one with deleteReview in reviewService.js.
export async function getAdminReviews() {
  try {
    const response = await axios.get(`${API_URL}/admin/reviews`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// Newest centre comments, each with hawkerCentre { name } and user { name, email }.
// Delete one with deleteComment in commentService.js.
export async function getAdminComments() {
  try {
    const response = await axios.get(`${API_URL}/admin/comments`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// filter: 'admins', 'banned' or nothing for everyone. Newest first, up to 100.
// Each user has role, bannedUntil, banReason, banned, permanentBan and posts { reports, reviews, comments }.
export async function getAdminUsers({ search, filter } = {}) {
  try {
    const response = await axios.get(`${API_URL}/admin/users`, { params: { search: search || undefined, filter: filter || undefined } })
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// role: 'admin' or 'user'. You can't change your own role.
export async function setUserRole(userId, role) {
  try {
    const response = await axios.patch(`${API_URL}/admin/users/${userId}/role`, { role })
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// days: 1 to 365, or null for a permanent ban. Banned users can't post anything until the ban ends.
export async function banUser(userId, { days, reason }) {
  try {
    const response = await axios.post(`${API_URL}/admin/users/${userId}/ban`, { days, reason })
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

export async function unbanUser(userId) {
  try {
    const response = await axios.post(`${API_URL}/admin/users/${userId}/unban`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// The admin activity log, newest first: [{ action, summary, admin { name, email }, subjectUser, createdAt }]
export async function getActivity() {
  try {
    const response = await axios.get(`${API_URL}/admin/activity`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}
