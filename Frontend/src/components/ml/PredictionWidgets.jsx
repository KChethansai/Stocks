import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  Bot
} from 'lucide-react'
import axios from 'axios'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '')

// Paper-automation controls for a symbol (alert / auto-buy / auto-sell
// rules on virtual balance). This panel intentionally carries no forecast
// presentation: no direction call, no signal counts, no accuracy claims.
// Prediction APIs, the trained model, and the dedicated Forecast accuracy
// page are untouched.
export function AutomationPanel({
  symbol,
  automationRule,
  onSaveAutomation,
  onToggleAutomation
}) {
  const [action, setAction] = useState(automationRule?.action || 'ALERT')
  const [threshold, setThreshold] = useState(automationRule?.confidenceThreshold ?? 0.65)
  const [quantity, setQuantity] = useState(automationRule?.quantity ?? 1)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (automationRule) {
      setAction(automationRule.action)
      setThreshold(automationRule.confidenceThreshold)
      setQuantity(automationRule.quantity)
    }
  }, [automationRule])

  const handleSave = async () => {
    if (!onSaveAutomation || !symbol) return
    setSaving(true)
    await onSaveAutomation({
      symbol,
      action,
      direction: action === 'BUY' ? 'UP' : action === 'SELL' ? 'DOWN' : 'ANY',
      confidenceThreshold: Number(threshold),
      quantity: Number(quantity),
      enabled: true
    })
    setSaving(false)
  }

  return (
    <div className="cc-panel p-4 sm:p-5 space-y-4 relative overflow-hidden">
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-[var(--brass)]/10 blur-2xl pointer-events-none" />

      <div className="flex items-center gap-2 relative">
        <Bot className="w-4 h-4 text-[var(--stone)]" />
        <h3 className="font-display font-bold text-base text-[#ECE9E2]">
          Paper automation
        </h3>
        {automationRule?.enabled && (
          <button
            type="button"
            onClick={() => onToggleAutomation?.(symbol, false)}
            className="ml-auto mf-meta font-mono text-[var(--loss)] hover:underline"
          >
            Disable
          </button>
        )}
      </div>
      <p className="mf-meta relative">
        Auto-trade or alert when confidence clears your threshold — virtual balance only.
        Model signals have not beaten trivial baselines; auto-buy/sell requires a trained model and fresh quotes, and never uses experimental models.
      </p>
      <div className="grid grid-cols-3 gap-2 relative">
        <Select
          value={action}
          onChange={setAction}
          ariaLabel="Automation action"
          className="w-full"
          options={[
            { value: 'ALERT', label: 'Alert' },
            { value: 'BUY', label: 'Auto-buy' },
            { value: 'SELL', label: 'Auto-sell' }
          ]}
        />
        <input
          type="number"
          min={0.3}
          max={0.95}
          step={0.05}
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className="bg-[#0B0C0E] border border-white/10 rounded-lg px-2 py-2 text-xs font-mono text-[#ECE9E2]"
          title="Confidence threshold"
          aria-label="Confidence threshold"
        />
        <input
          type="number"
          min={1}
          max={1000}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="bg-[#0B0C0E] border border-white/10 rounded-lg px-2 py-2 text-xs font-mono text-[#ECE9E2]"
          title="Quantity"
          aria-label="Quantity"
        />
      </div>
      <Button
        type="button"
        variant="primary"
        disabled={saving}
        onClick={handleSave}
        className="w-full py-2 text-xs relative"
      >
        {saving ? 'Saving…' : automationRule ? 'Update rule' : 'Enable automation'}
      </Button>
    </div>
  )
}

const directionMeta = {
  UP: { label: 'Bullish', Icon: ArrowUpRight, className: 'cc-pred-up' },
  DOWN: { label: 'Bearish', Icon: ArrowDownRight, className: 'cc-pred-down' },
  NEUTRAL: { label: 'Neutral', Icon: Minus, className: 'cc-pred-neutral' }
}

export function AiInsightWidget({ symbols = [] }) {
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const requestedSymbols = symbols.slice(0, 5).join(',')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const qs = requestedSymbols ? `?symbols=${requestedSymbols}` : ''
        const { data } = await axios.get(`${API_BASE}/ml-api/predict${qs}`, {
          withCredentials: true
        })
        if (!cancelled) setPredictions(data.predictions || [])
      } catch {
        if (!cancelled) setPredictions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [requestedSymbols])

  return (
    <div className="cc-panel p-5 space-y-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <p className="mf-label">
            Forecasts
          </p>
          <h3 className="mf-h2">Short-term signals</h3>
        </div>
        <Sparkles className="w-4 h-4 text-[var(--stone)]" />
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && predictions.length === 0 && (
        <p className="text-xs text-[#8A867E]">No predictions yet — sync market data and retry.</p>
      )}

      {!loading && (
        <p className="mf-meta">Top directional calls (neutral signals excluded)</p>
      )}

      {!loading && (
        <ul className="space-y-2">
          {[...predictions].sort((a, b) => (b.confidence || 0) - (a.confidence || 0)).filter((p) => p.direction === 'UP').slice(0, 3).concat([...predictions].sort((a, b) => (b.confidence || 0) - (a.confidence || 0)).filter((p) => p.direction === 'DOWN').slice(0, 3)).map((p) => {
            const meta = directionMeta[p.direction] || directionMeta.NEUTRAL
            const Icon = meta.Icon
            return (
              <li key={p.symbol}>
                <Link
                  to={`/markets?stock=${p.symbol}`}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition group"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#111316] border border-white/8 flex items-center justify-center font-mono text-xs font-bold text-[var(--stone)]">
                    {p.symbol.slice(0, 3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#ECE9E2] group-hover:text-[var(--brass)] transition">
                      {p.symbol}
                    </p>
                    <p className="mf-meta font-mono truncate">
                      {meta.label}{Number.isFinite(p.signalsAligned) && Number.isFinite(p.signalsTotal) ? ` · ${p.signalsAligned}/${p.signalsTotal} aligned` : ' · direction only'}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md mf-badge font-mono ${meta.className}`}>
                    <Icon className="w-3 h-3" />
                    {meta.label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* Forecasts naming (compat alias — AiInsightWidget is the same component). */
export const ForecastsWidget = AiInsightWidget
