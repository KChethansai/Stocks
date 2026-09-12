import axios from 'axios'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '')

// Fail-soft by backend contract: /stock-api/news/:symbol returns 200 with
// [] when Yahoo is unavailable, so callers only guard network errors.
export async function fetchNews(symbol) {
  const { data } = await axios.get(`${API_BASE}/stock-api/news/${symbol}`)
  return data.news || []
}

export function timeAgo(iso) {
  if (!iso) return ''
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
