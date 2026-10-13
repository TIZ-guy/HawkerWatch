// Calls for the hawker-centre comment endpoints (backend/controllers/commentController.js).
import { apiRequest } from './apiClient.js'

// Newest first. Each comment is { _id, text, createdAt, updatedAt, user: { _id, name } or null }.
export const getComments = (centreId) => apiRequest(`/hawker-centres/${centreId}/comments`)

// Needs a login. Text is 1 to 500 characters. Returns the new comment.
export const addComment = (centreId, text) =>
  apiRequest(`/hawker-centres/${centreId}/comments`, { method: 'POST', body: { text } })

// Needs a login. Only the author can edit (403 otherwise). Returns the updated comment.
export const editComment = (commentId, text) => apiRequest(`/comments/${commentId}`, { method: 'PATCH', body: { text } })

// Needs a login. The author or an admin can delete (403 otherwise).
export const deleteComment = (commentId) => apiRequest(`/comments/${commentId}`, { method: 'DELETE' })
