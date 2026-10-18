// News client. Fail-soft by backend contract: both news routes return 200 with
// an honest `stale` flag when the provider is unreachable, so callers only
// guard genuine network failures.
import axios from 'axios'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '')

// General market news: the default view. Broader financial markets, business,
// macroeconomic and sector reporting — not one feed per held symbol.
export async function fetchGeneralNews({ limit = 40, signal } = {}) {
  const { data } = await axios.get(`${API_BASE}/stock-api/news`, {
    params: { limit },
    signal
  })
  return {
    items: data.news || [],
    fetchedAt: data.fetchedAt || null,
    stale: Boolean(data.stale),
    cached: Boolean(data.cached)
  }
}

// Stock-specific news. Attribution still comes from the provider's own
// `relatedTickers` — the query only narrows retrieval, so `attributedTo` is
// reported separately and may be lower than the item count.
export async function fetchStockNews(symbol, { limit = 20, signal } = {}) {
  const { data } = await axios.get(`${API_BASE}/stock-api/news/${encodeURIComponent(symbol)}`, {
    params: { limit },
    signal
  })
  return {
    items: data.news || [],
    attributedTo: typeof data.attributedTo === 'number' ? data.attributedTo : 0,
    fetchedAt: data.fetchedAt || null,
    stale: Boolean(data.stale),
    cached: Boolean(data.cached)
  }
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

// Absolute date, for the title attribute. The relative label ("22m ago") reads
// as a publication time; the tooltip carries the exact one so a headline that
// is genuinely old is never mistaken for a fresh fetch.
export function absoluteTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}
