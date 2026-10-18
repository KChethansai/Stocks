import { useEffect, useState } from 'react'
import { Bot } from 'lucide-react'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'

// Paper-automation controls for a symbol (alert / auto-buy / auto-sell
// rules on virtual balance). This panel intentionally carries no forecast
// presentation: no direction call, no signal counts, no accuracy claims.
// Prediction APIs, the trained model, and the dedicated Forecast accuracy
// page are untouched.
//
// The forecast *widget* that used to live here was removed: the dashboard's
// Signals tab renders its own list (it needs per-signal data the widget
// suppressed, and a row count sized to the rail). `AiInsightWidget` and its
// `ForecastsWidget` alias therefore had no importer left.
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
