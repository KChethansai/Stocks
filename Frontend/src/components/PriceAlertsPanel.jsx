import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Bell, BellRing, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Button } from './ui/Button'
import { SegmentedControl } from './ui/SegmentedControl'
import {
  fetchPriceAlerts,
  createPriceAlert,
  deletePriceAlert
} from './priceAlertsApi'

// Manage price-threshold alerts for the selected symbol. Alerts are evaluated
// server-side on the 5-min stock-sync tick; firing writes to the existing
// notification inbox (Topbar bell). One-shot semantics: a fired alert never
// refires — delete it or let it sit in the Fired section as history.
export default function PriceAlertsPanel({ symbol, currentPrice }) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [targetPrice, setTargetPrice] = useState('')
  const [direction, setDirection] = useState('ABOVE')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchPriceAlerts()
      .then((rows) => {
        if (!cancelled) setAlerts(rows)
      })
      .catch(() => {
        if (!cancelled) setAlerts([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Prefill the input with the live price whenever the symbol changes.
  useEffect(() => {
    if (Number(currentPrice) > 0) setTargetPrice(Number(currentPrice).toFixed(2))
  }, [symbol, currentPrice])

  const symbolAlerts = alerts.filter((a) => a.symbol === symbol)
  const activeAlerts = symbolAlerts.filter((a) => !a.triggered)
  const firedAlerts = symbolAlerts.filter((a) => a.triggered)

  const handleCreate = async () => {
    const price = Number(targetPrice)
    if (!Number.isFinite(price) || price < 0.01) {
      toast.error('Enter a target price of at least $0.01.')
      return
    }
    setSubmitting(true)
    try {
      const alert = await createPriceAlert({ symbol, targetPrice: price, direction })
      setAlerts((rows) => [alert, ...rows])
      toast.success(`Alert set: ${symbol} ${direction === 'ABOVE' ? 'above' : 'below'} $${price.toFixed(2)}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create alert')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deletePriceAlert(id)
      setAlerts((rows) => rows.filter((a) => a._id !== id))
      toast.success('Alert removed')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove alert')
    }
  }

  return (
    <div className="bg-[#111318] rounded-2xl border border-[rgba(255,255,255,0.08)] p-5 sm:p-6 flex flex-col shadow-xl">
      <div className="flex items-center gap-2 mb-1">
        <Bell className="w-4 h-4 text-[#3B82F6]" />
        <h3 className="text-sm font-semibold text-[#F5F7FA] m-0">
          Price Alerts — {symbol}
        </h3>
      </div>
      <p className="text-[11px] font-mono text-text-muted mt-0 mb-4">
        Checked every ~5 min. Fires once, then lands in your inbox.
      </p>

      <SegmentedControl
        value={direction}
        onChange={setDirection}
        ariaLabel="Alert direction"
        fullWidth
        className="mb-3"
        options={[
          { value: 'ABOVE', label: 'Above', icon: ArrowUpRight },
          { value: 'BELOW', label: 'Below', icon: ArrowDownRight }
        ]}
      />

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-text-muted">$</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            aria-label="Target price"
            className="w-full bg-[#09090B] border border-[rgba(255,255,255,0.1)] rounded-lg pl-7 pr-3 py-2 text-sm font-mono text-[#F5F7FA] focus:outline-none focus:border-[#3B82F6]"
          />
        </div>
        <Button
          variant="primary"
          onClick={handleCreate}
          disabled={submitting || !symbol}
          className="py-2 text-xs shrink-0"
        >
          {submitting ? 'Setting...' : 'Set Alert'}
        </Button>
      </div>

      {loading ? (
        <div className="animate-pulse flex flex-col gap-2">
          <div className="h-8 rounded-lg bg-[rgba(255,255,255,0.06)]" />
          <div className="h-8 rounded-lg bg-[rgba(255,255,255,0.04)]" />
        </div>
      ) : symbolAlerts.length === 0 ? (
        <p className="text-xs font-mono text-text-muted m-0">
          No alerts for {symbol} yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 m-0 p-0 list-none">
          {activeAlerts.map((a) => (
            <li
              key={a._id}
              className="flex items-center justify-between gap-2 bg-[#09090B] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2"
            >
              <span className="text-xs font-mono text-[#F5F7FA] flex items-center gap-1.5 min-w-0">
                {a.direction === 'ABOVE' ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 text-[#EF4444] shrink-0" />
                )}
                <span className="truncate">
                  {a.direction === 'ABOVE' ? 'Above' : 'Below'} ${Number(a.targetPrice).toFixed(2)}
                </span>
              </span>
              <button
                onClick={() => handleDelete(a._id)}
                className="text-[#9CA3AF] hover:text-[#EF4444] transition shrink-0"
                title="Remove alert"
                aria-label={`Remove alert ${a.direction} ${a.targetPrice}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
          {firedAlerts.map((a) => (
            <li
              key={a._id}
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 border border-[rgba(59,130,246,0.25)] bg-[rgba(59,130,246,0.06)]"
            >
              <span className="text-xs font-mono text-[#9CA3AF] flex items-center gap-1.5 min-w-0">
                <BellRing className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />
                <span className="truncate">
                  Fired {a.direction === 'ABOVE' ? 'above' : 'below'} ${Number(a.targetPrice).toFixed(2)}
                </span>
              </span>
              <button
                onClick={() => handleDelete(a._id)}
                className="text-[#9CA3AF] hover:text-[#EF4444] transition shrink-0"
                title="Dismiss"
                aria-label="Dismiss fired alert"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
