import { useEffect, useState } from 'react'
import axios from 'axios'
import { Newspaper, ExternalLink } from 'lucide-react'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '')

function timeAgo(iso) {
  if (!iso) return ''
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// Read-only headlines for the selected symbol. Public endpoint, no auth.
// Fail-soft by contract: the API returns [] instead of an error, so this
// panel never breaks the detail view — it just renders an empty state.
export default function NewsPanel({ symbol }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!symbol) return
    let cancelled = false
    setLoading(true)
    axios
      .get(`${API_BASE}/stock-api/news/${symbol}`)
      .then(({ data }) => {
        if (!cancelled) setItems(data.news || [])
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [symbol])

  return (
    <div className="p-5 sm:p-6 border-t border-[rgba(255,255,255,0.08)] bg-[#09090B]">
      <div className="flex items-center gap-2 mb-4">
        <Newspaper className="w-4 h-4 text-[#3B82F6]" />
        <h3 className="text-sm font-semibold text-[#F5F7FA] m-0">
          Latest News — {symbol}
        </h3>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-3 rounded bg-[rgba(255,255,255,0.08)] w-3/4 mb-2" />
              <div className="h-2 rounded bg-[rgba(255,255,255,0.05)] w-1/4" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs font-mono text-text-muted m-0">
          No recent headlines for {symbol}.
        </p>
      ) : (
        <ul className="flex flex-col gap-3 m-0 p-0 list-none">
          {items.map((item, i) => (
            <li key={`${item.link || item.title}-${i}`} className="min-w-0">
              {item.link ? (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-1.5 text-xs font-medium text-[#F5F7FA] hover:text-[#3B82F6] transition leading-snug"
                >
                  <span className="min-w-0">{item.title}</span>
                  <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 text-text-muted group-hover:text-[#3B82F6] transition" />
                </a>
              ) : (
                <p className="text-xs font-medium text-[#F5F7FA] leading-snug m-0">{item.title}</p>
              )}
              <p className="text-[10px] font-mono uppercase text-text-muted mt-1 m-0">
                {item.publisher}
                {item.publishedAt ? ` • ${timeAgo(item.publishedAt)}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
