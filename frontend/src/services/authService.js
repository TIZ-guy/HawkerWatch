// Calls for the auth endpoints (backend/routes/authRoutes.js). Login is kept in an httpOnly cookie.
import axios from 'axios'
import { API_URL, toError } from './apiClient.js'

export async function register({ name, email, password }) {
  try {
    const response = await axios.post(`${API_URL}/auth/register`, { name, email, password })
    return response.data.data.user
  } catch (error) {
    throw toError(error)
  }
}

// Returns { user } when logged in, or { twoFactorRequired: true, challengeToken } when the account
// has two-factor login on and loginTwoFactor() must be called next with a code.
export async function login({ email, password }) {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, { email, password })
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

// credential is the ID token from Google's button. Same answer shape as login().
export async function loginWithGoogle(credential) {
  try {
    const response = await axios.post(`${API_URL}/auth/google`, { credential })
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

export async function loginTwoFactor({ challengeToken, code }) {
  try {
    const response = await axios.post(`${API_URL}/auth/login/2fa`, { challengeToken, code })
    return response.data.data.user
  } catch (error) {
    throw toError(error)
  }
}

// Returns { secret, otpauthUrl, qrCode } for the authenticator app.
export async function startTwoFactorSetup() {
  try {
    const response = await axios.post(`${API_URL}/auth/2fa/setup`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

export async function enableTwoFactor({ code }) {
  try {
    const response = await axios.post(`${API_URL}/auth/2fa/enable`, { code })
    return response.data.data.user
  } catch (error) {
    throw toError(error)
  }
}

export async function disableTwoFactor({ password, code }) {
  try {
    const response = await axios.post(`${API_URL}/auth/2fa/disable`, { password, code })
    return response.data.data.user
  } catch (error) {
    throw toError(error)
  }
}

export async function getCurrentUser() {
  try {
    const response = await axios.get(`${API_URL}/auth/me`)
    return response.data.data.user
  } catch (error) {
    throw toError(error)
  }
}

export async function updateMe({ name }) {
  try {
    const response = await axios.patch(`${API_URL}/auth/me`, { name })
    return response.data.data.user
  } catch (error) {
    throw toError(error)
  }
}

export async function changePassword({ currentPassword, newPassword }) {
  try {
    const response = await axios.patch(`${API_URL}/auth/password`, { currentPassword, newPassword })
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

export async function logout() {
  try {
    const response = await axios.post(`${API_URL}/auth/logout`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}
