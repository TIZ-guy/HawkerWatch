import { apiRequest } from './apiClient.js'

export const register = ({ name, email, password }) =>
  apiRequest('/auth/register', { method: 'POST', body: { name, email, password } }).then((data) => data.user)

export const login = ({ email, password }) =>
  apiRequest('/auth/login', { method: 'POST', body: { email, password } }).then((data) => data.user)

export const getCurrentUser = () => apiRequest('/auth/me').then((data) => data.user)

export const updateMe = ({ name }) =>
  apiRequest('/auth/me', { method: 'PATCH', body: { name } }).then((data) => data.user)

export const changePassword = ({ currentPassword, newPassword }) =>
  apiRequest('/auth/password', { method: 'PATCH', body: { currentPassword, newPassword } })

export const logout =() => apiRequest('/auth/logout', { method: 'POST' })
