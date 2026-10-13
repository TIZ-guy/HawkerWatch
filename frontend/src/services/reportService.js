import axios from 'axios'
import { API_URL, toError } from './apiClient.js'

export async function submitReport(stallId, status) {
  try {
    const response = await axios.post(`${API_URL}/reports`, { stallId, status })
    return response.data.data.report
  } catch (error) {
    throw toError(error)
  }
}

export async function flagReport(reportId) {
  try {
    const response = await axios.post(`${API_URL}/reports/${reportId}/flag`)
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}
