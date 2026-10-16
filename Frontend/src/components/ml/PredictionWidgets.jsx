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

const directionMeta = {
  UP: { label: 'Bullish', Icon: ArrowUpRight, className: 'cc-pred-up' },
  DOWN: { label: 'Bearish', Icon: ArrowDownRight, className: 'cc-pred-down' },
  NEUTRAL: { label: 'Neutral', Icon: Minus, className: 'cc-pred-neutral' }
}

export function PredictionBadge({ prediction, compact = false }) {
  if (!prediction?.ok && !prediction?.direction) return null
  const dir = prediction.direction || 'NEUTRAL'
  const meta = directionMeta[dir] || directionMeta.NEUTRAL
  const Icon = meta.Icon
  // D7: no confidence/target/range percentages or dollars anywhere. The only
  // figure shown is the countable primary-signal agreement (n/3), which the
  // predictor returns as signalsAligned/signalsTotal — never a success rate.
  const signals =
    Number.isFinite(prediction.signalsAligned) && Number.isFinite(prediction.signalsTotal)
      ? `${prediction.signalsAligned}/${prediction.signalsTotal} signals`
      : null

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md mf-badge font-mono ${meta.className}`}
      >
        <Icon className="w-3 h-3" />
        {meta.label}{signals ? ` · ${signals} aligned` : ''}
      </span>
    )
  }

  return (
    <div className={`inline-flex flex-col gap-1 px-3 py-2 rounded-xl ${meta.className}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold font-mono">
        <Sparkles className="w-3.5 h-3.5" />
        AI · {meta.label}
      </div>
      <div className="mf-meta font-mono opacity-90">
        Direction only{signals ? ` · ${signals} aligned` : ''} · not advice
      </div>
    </div>
  )
}

function AccuracyBadge({ accuracy }) {
  if (!accuracy || accuracy.insufficientData) return <span className="mf-meta">Accuracy pending</span>
  const pct = Math.round(accuracy.accuracy * 100)
  return <span className="inline-flex items-center gap-1 mf-meta font-mono text-[#8A867E]"><span className={`h-1.5 w-1.5 rounded-full ${pct >= 60 ? 'bg-[#4FB286]' : 'bg-[var(--stone)]'}`} />{pct}% {accuracy.demo ? 'demo accuracy' : `accurate · ${accuracy.total} resolved`}</span>
}

export function PredictionPanel({
  symbol,
  prediction,
  loading,
  automationRule,
  onSaveAutomation,
  onToggleAutomation,
  horizon = 1,
  onHorizonChange
  , accuracy
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

  const dir = prediction?.direction || 'NEUTRAL'
  const meta = directionMeta[dir] || directionMeta.NEUTRAL
  const Icon = meta.Icon

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

      <div className="flex items-start justify-between gap-3 relative">
        <div>
          <p className="mf-label mb-1">
            MarketForge AI
          </p>
          <h3 className="font-display font-bold text-lg text-[#ECE9E2]">
            Market outlook
          </h3>
          {!loading && prediction?.ok && (
            <p className="mf-meta font-mono mt-1">
              {prediction.trained ? `Trained model · ${prediction.model || ''}` : 'Heuristic fallback · no trained model served'}
              {prediction.releaseId ? ` · ${prediction.releaseId}` : ''}
            </p>
          )}
        </div>
        {loading ? (
          <div className="h-8 w-24 rounded-lg bg-white/5 animate-pulse" />
        ) : (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold ${meta.className}`}>
            <Icon className="w-3.5 h-3.5" />
            {meta.label}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between"><span className="mf-meta">Forecast horizon</span><Select value={String(horizon)} onChange={(v) => onHorizonChange?.(Number(v))} ariaLabel="Forecast horizon" className="min-w-[7.5rem]" options={[{ value: '1', label: '1 day' }, { value: '5', label: '5 days' }]} /></div>
      <div className="flex items-center justify-between border-b border-white/8 pb-3"><AccuracyBadge accuracy={accuracy} /><span title="Direction classifier (UP / DOWN / NEUTRAL). The model predicts direction only — no price targets, no success-rate claims." className="cursor-help mf-label font-mono text-[#8A867E]">ⓘ Direction signal</span></div>

      {loading && (
        <div className="space-y-2">
          <div className="h-4 w-3/4 rounded bg-white/5 animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-white/5 animate-pulse" />
        </div>
      )}

      {!loading && prediction?.ok && (
        <>
          <div className="rounded-xl border border-white/8 bg-[#111316] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="mf-label">Direction</p>
              <p className="font-mono font-semibold text-sm text-[#ECE9E2]">
                {directionMeta[prediction.direction]?.label ?? 'Neutral'}
                {Number.isFinite(prediction.signalsAligned) && Number.isFinite(prediction.signalsTotal)
                  ? ` · ${prediction.signalsAligned}/${prediction.signalsTotal} signals aligned`
                  : ''}
              </p>
            </div>
            <p className="mf-meta mt-1">Direction-only signal. Not a price target, not investment advice.</p>
          </div>
          <p className="rounded-xl border border-white/8 bg-[#111316]/70 px-3 py-2.5 text-xs text-[#8A867E] leading-relaxed">
            {prediction.explainability?.summary}
          </p>

          {(prediction.explainability?.factors || []).length > 0 && (
            <details className="group rounded-xl border border-white/8 bg-[#111316]/50 px-3 py-2">
              <summary className="cursor-pointer list-none flex items-center justify-between text-xs text-[#8A867E] hover:text-[#ECE9E2] transition">
                <span>Why this forecast</span>
                <span className="font-mono text-[var(--brass)] group-open:hidden">+</span>
                <span className="font-mono text-[var(--brass)] hidden group-open:inline">−</span>
              </summary>
              <ul className="mt-2 space-y-1.5 pb-1">
                {(prediction.explainability?.factors || []).slice(0, 3).map((factor) => (
                  <li key={factor} className="inline-flex mr-1.5 mb-1 rounded-full border border-white/10 bg-[#111316] px-2 py-1 mf-badge text-[#8A867E] font-mono">
                    <span className="text-[var(--stone)] mr-1">•</span><span>{factor}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Automation controls */}
          <div className="pt-3 border-t border-white/8 space-y-2">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-[var(--stone)]" />
              <p className="text-xs font-semibold text-[#ECE9E2]">Paper automation</p>
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
            <p className="mf-meta">
              Auto-trade or alert when confidence clears your threshold — virtual balance only.
              Model signals have not beaten trivial baselines; auto-buy/sell requires a trained model and fresh quotes, and never uses experimental models.
            </p>
            <div className="grid grid-cols-3 gap-2">
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
              />
              <input
                type="number"
                min={1}
                max={1000}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="bg-[#0B0C0E] border border-white/10 rounded-lg px-2 py-2 text-xs font-mono text-[#ECE9E2]"
                title="Quantity"
              />
            </div>
            <Button
              type="button"
              variant="primary"
              disabled={saving}
              onClick={handleSave}
              className="w-full py-2 text-xs"
            >
              {saving ? 'Saving…' : automationRule ? 'Update rule' : 'Enable automation'}
            </Button>
          </div>
        </>
      )}

      {!loading && prediction && !prediction.ok && (
        <p className="text-xs text-[#8A867E]">{prediction.message || 'Prediction unavailable'}</p>
      )}
    </div>
  )
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
