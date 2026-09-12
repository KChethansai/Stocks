import axios from 'axios'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '')

export async function fetchPriceAlerts() {
  const { data } = await axios.get(`${API_BASE}/alert-api/alerts`, {
    withCredentials: true
  })
  return data.alerts || []
}

export async function createPriceAlert({ symbol, targetPrice, direction }) {
  const { data } = await axios.post(
    `${API_BASE}/alert-api/alerts`,
    { symbol, targetPrice, direction },
    { withCredentials: true }
  )
  return data.alert
}

export async function deletePriceAlert(id) {
  const { data } = await axios.delete(`${API_BASE}/alert-api/alerts/${id}`, {
    withCredentials: true
  })
  return data
}
