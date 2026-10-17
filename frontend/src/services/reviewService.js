// Calls for the stall review endpoints (backend/controllers/reviewController.js).
import axios from 'axios'
import { API_URL, toError } from './apiClient.js'

// { average, count, reviews } for one stall. average is null when there are no reviews.
// Each review is { _id, rating, text, photos: [photoId], createdAt, editedAt, user: { _id, name } or null }, newest first.
export async function getStallReviews(stallId) {
  try {
    const response = await axios.get(`${API_URL}/stalls/${stallId}/reviews`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// Needs a login. rating is 1 to 5; text is optional (up to 500 characters).
// One review per user per stall (409 otherwise). Returns the new review.
export async function addReview(stallId, rating, text) {
  try {
    const response = await axios.post(`${API_URL}/stalls/${stallId}/reviews`, { rating, text })
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// Needs a login. Only the author can edit (403 otherwise). Returns the updated review.
export async function updateReview(reviewId, rating, text) {
  try {
    const response = await axios.patch(`${API_URL}/reviews/${reviewId}`, { rating, text })
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// Needs a login. The author or an admin can delete (403 otherwise).
export async function deleteReview(reviewId) {
  try {
    const response = await axios.delete(`${API_URL}/reviews/${reviewId}`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// Needs a login. Adds photos (File or Blob objects) to the user's own review, at most 4 per review.
// Sent as multipart/form-data, which is how browsers upload files. Returns the updated review.
export async function addReviewPhotos(reviewId, photos) {
  const form = new FormData()
  for (const photo of photos) {
    form.append('photos', photo, 'photo.jpg')
  }
  try {
    const response = await axios.post(`${API_URL}/reviews/${reviewId}/photos`, form)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// Needs a login. The author or an admin can remove a photo.
export async function deleteReviewPhoto(reviewId, photoId) {
  try {
    const response = await axios.delete(`${API_URL}/reviews/${reviewId}/photos/${photoId}`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// The address of a photo's image, for <img :src="photoUrl(id)">
export function photoUrl(photoId) {
  return `${API_URL}/review-photos/${photoId}`
}
