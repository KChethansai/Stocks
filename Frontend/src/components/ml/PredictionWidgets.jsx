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
import { formatCurrency } from '../../utils/marketAnalytics'
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
  const conf = Math.round((prediction.confidence || 0) * 100)

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold ${meta.className}`}
      >
        <Icon className="w-3 h-3" />
        {meta.label} · {conf}%
      </span>
    )
  }

  return (
    <div className={`inline-flex flex-col gap-1 px-3 py-2 rounded-xl ${meta.className}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold font-mono">
        <Sparkles className="w-3.5 h-3.5" />
        AI · {meta.label}
      </div>
      <div className="text-[11px] font-mono opacity-90">
        Conf {conf}% · tgt {formatCurrency(prediction.predictedPrice)}
      </div>
    </div>
  )
}

function AccuracyBadge({ accuracy }) {
  if (!accuracy || accuracy.insufficientData) return <span className="text-[10px] text-[#5C6B7E]">Accuracy pending</span>
  const pct = Math.round(accuracy.accuracy * 100)
  return <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#8B97A8]"><span className={`h-1.5 w-1.5 rounded-full ${pct >= 60 ? 'bg-[#2ECF8E]' : 'bg-[#60A5FA]'}`} />{pct}% {accuracy.demo ? 'demo accuracy' : `accurate · ${accuracy.total} resolved`}</span>
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
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-[#3B82F6]/10 blur-2xl pointer-events-none" />

      <div className="flex items-start justify-between gap-3 relative">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-[#8B97A8] mb-1">
            MarketForge AI
          </p>
          <h3 className="font-display font-bold text-lg text-[#E8EEF7]">
            Market outlook
          </h3>
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
      <div className="flex items-center justify-between"><span className="text-[11px] text-[#8B97A8]">Forecast horizon</span><Select value={String(horizon)} onChange={(v) => onHorizonChange?.(Number(v))} ariaLabel="Forecast horizon" className="min-w-[7.5rem]" options={[{ value: '1', label: '1 day' }, { value: '5', label: '5 days' }, { value: '10', label: '10 days' }]} /></div>
      <div className="flex items-center justify-between border-b border-white/8 pb-3"><AccuracyBadge accuracy={accuracy} /><span title="Combines SMA crossover, OLS trend slope, momentum and RSI dampening." className="cursor-help text-[10px] font-mono uppercase tracking-wider text-[#5C6B7E]">ⓘ Technical model</span></div>

      {loading && (
        <div className="space-y-2">
          <div className="h-4 w-3/4 rounded bg-white/5 animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-white/5 animate-pulse" />
        </div>
      )}

      {!loading && prediction?.ok && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-[#162235] border border-white/5 p-3">
              <p className="text-[10px] text-[#5C6B7E] font-mono uppercase mb-1">Target</p>
              <p className="font-mono font-semibold text-sm text-[#E8EEF7]">
                {formatCurrency(prediction.predictedPrice)}
              </p>
            </div>
            <div className="rounded-xl bg-[#162235] border border-white/5 p-3">
              <p className="text-[10px] text-[#5C6B7E] font-mono uppercase mb-1">Range</p>
              <p className="font-mono font-semibold text-[11px] text-[#E8EEF7]">
                {formatCurrency(prediction.priceRange?.low)}–{formatCurrency(prediction.priceRange?.high)}
              </p>
            </div>
            <div className="rounded-xl bg-[#162235] border border-white/5 p-3">
              <p className="text-[10px] text-[#5C6B7E] font-mono uppercase mb-1">Confidence</p>
              <p className="font-mono font-semibold text-sm text-[#60A5FA]">
                {Math.round(prediction.confidence * 100)}%
              </p>
            </div>
          </div>
          <div className="space-y-1"><div className="flex justify-between text-[10px] font-mono text-[#8B97A8]"><span>Confidence</span><span className="text-[#60A5FA]">{Math.round(prediction.confidence * 100)}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#3B82F6] transition-all" style={{ width: `${Math.round(prediction.confidence * 100)}%` }} /></div></div>

          <p className="rounded-xl border border-white/8 bg-[#162235]/70 px-3 py-2.5 text-xs text-[#8B97A8] leading-relaxed">
            {prediction.explainability?.summary}
          </p>

          <ul className="space-y-1.5">
            {(prediction.explainability?.factors || []).slice(0, 3).map((factor) => (
              <li key={factor} className="inline-flex mr-1.5 mb-1 rounded-full border border-white/10 bg-[#162235] px-2 py-1 text-[10px] text-[#8B97A8] font-mono">
                <span className="text-[#3B82F6] mr-1">•</span><span>{factor}</span>
              </li>
            ))}
          </ul>

          {/* Automation controls */}
          <div className="pt-3 border-t border-white/8 space-y-3">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#3B82F6]" />
              <p className="text-xs font-semibold text-[#E8EEF7]">Paper automation</p>
              {automationRule?.enabled && (
                <button
                  type="button"
                  onClick={() => onToggleAutomation?.(symbol, false)}
                  className="ml-auto text-[10px] font-mono text-[#F0656E] hover:underline"
                >
                  Disable
                </button>
              )}
            </div>
            <p className="text-[11px] text-[#5C6B7E]">
              Auto-trade or alert when confidence clears your threshold — virtual balance only.
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
                className="bg-[#06090F] border border-white/10 rounded-lg px-2 py-2 text-[11px] font-mono text-[#E8EEF7]"
                title="Confidence threshold"
              />
              <input
                type="number"
                min={1}
                max={1000}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="bg-[#06090F] border border-white/10 rounded-lg px-2 py-2 text-[11px] font-mono text-[#E8EEF7]"
                title="Quantity"
              />
            </div>
            <Button
              type="button"
              variant="primary"
              disabled={saving}
              onClick={handleSave}
              className="w-full py-2.5"
            >
              {saving ? 'Saving…' : automationRule ? 'Update rule' : 'Enable automation'}
            </Button>
          </div>
        </>
      )}

      {!loading && prediction && !prediction.ok && (
        <p className="text-xs text-[#8B97A8]">{prediction.message || 'Prediction unavailable'}</p>
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
          <p className="text-[10px] uppercase tracking-[0.18em] font-mono text-[#8B97A8]">
            AI Insight
          </p>
          <h3 className="font-display font-bold text-[#E8EEF7]">Short-term signals</h3>
        </div>
        <Sparkles className="w-4 h-4 text-[#3B82F6]" />
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && predictions.length === 0 && (
        <p className="text-xs text-[#5C6B7E]">No predictions yet — sync market data and retry.</p>
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
                  <div className="w-9 h-9 rounded-lg bg-[#162235] border border-white/8 flex items-center justify-center font-mono text-[11px] font-bold text-[#60A5FA]">
                    {p.symbol.slice(0, 3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#E8EEF7] group-hover:text-[#60A5FA] transition">
                      {p.symbol}
                    </p>
                    <p className="text-[10px] text-[#5C6B7E] font-mono truncate">
                      {formatCurrency(p.predictedPrice)} · ± band
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono font-semibold ${meta.className}`}>
                    <Icon className="w-3 h-3" />
                    {Math.round(p.confidence * 100)}%
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
