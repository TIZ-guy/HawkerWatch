// Calls for the hawker-centre comment endpoints (backend/controllers/commentController.js).
import axios from 'axios'
import { API_URL, toError } from './apiClient.js'

// Newest first. Each comment is { _id, text, createdAt, updatedAt, user: { _id, name } or null }.
export async function getComments(centreId) {
  try {
    const response = await axios.get(`${API_URL}/hawker-centres/${centreId}/comments`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// Needs a login. Text is 1 to 500 characters. Returns the new comment.
export async function addComment(centreId, text) {
  try {
    const response = await axios.post(`${API_URL}/hawker-centres/${centreId}/comments`, { text })
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// Needs a login. Only the author can edit (403 otherwise). Returns the updated comment.
export async function editComment(commentId, text) {
  try {
    const response = await axios.patch(`${API_URL}/comments/${commentId}`, { text })
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// Needs a login. The author or an admin can delete (403 otherwise).
export async function deleteComment(commentId) {
  try {
    const response = await axios.delete(`${API_URL}/comments/${commentId}`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}
