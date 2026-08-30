import axios from 'axios'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '')

export async function fetchPrediction(symbol, horizon = 1) {
  const { data } = await axios.get(
    `${API_BASE}/ml-api/predict/${symbol}?horizon=${horizon}`,
    { withCredentials: true }
  )
  return data.prediction
}

export async function fetchAccuracy(symbol) {
  const { data } = await axios.get(`${API_BASE}/ml-api/accuracy/${symbol}`, { withCredentials: true })
  return data
}

export async function fetchAutomationRules() {
  const { data } = await axios.get(`${API_BASE}/ml-api/automation`, {
    withCredentials: true
  })
  return data.rules || []
}

export async function saveAutomationRule(payload) {
  const { data } = await axios.post(`${API_BASE}/ml-api/automation`, payload, {
    withCredentials: true
  })
  return data.rule
}

export async function patchAutomationRule(symbol, updates) {
  const { data } = await axios.patch(`${API_BASE}/ml-api/automation/${symbol}`, updates, {
    withCredentials: true
  })
  return data.rule
}