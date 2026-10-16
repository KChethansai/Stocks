import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import toast from 'react-hot-toast'
import { X, CheckCircle2, AlertCircle, Search, ArrowLeft } from 'lucide-react'
import { useTrade } from '../../store/tradeStore'
import { useAuth } from '../../store/authStore'
import { formatCurrency } from '../../utils/marketAnalytics'
import { ParticleButton } from '../kokonutui/ParticleButton'
import { BuyButton } from '../ui/BuyButton'
import { Button, Chip } from '../ui/Button'
import { SegmentedControl } from '../ui/SegmentedControl'
import { QuantityStepper } from '../ui/QuantityStepper'
import { Dialog } from '../ui/Dialog'

function provenanceOf(stock) {
  if (!stock || !(Number(stock.price) > 0)) return { state: 'unavailable', label: 'Quote unavailable' }
  if (!stock.lastVerifiedAt || (stock.source && stock.source !== 'yahoo')) return { state: 'unverified', label: 'Unverified quote' }
  if (stock.stale) return { state: 'stale', label: 'Stale quote' }
  if (stock.asOf) {
    return {
      state: 'verified',
      label: `Yahoo · as of ${new Date(stock.asOf).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
    }
  }
  return { state: 'verified', label: 'Yahoo Finance' }
}

function ProvenanceDot({ state }) {
  const color =
    state === 'verified' ? 'bg-[var(--gain)]' : state === 'unavailable' ? 'bg-[var(--stone-muted)]' : 'bg-[#D9A441]'
  return <span aria-hidden="true" className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} />
}

// Shared order ticket: global Trade opens the symbol selector (step 'select');
// stock-specific entries open the ticket prefilled (step 'ticket'). No caller
// may silently force a symbol — a null stock means "choose", never stocks[0].
export default function TradeModal({ stock, isOpen, onClose, defaultSide = 'BUY' }) {
  const { buyStock, sellStock, refreshQuote, portfolio, stocks } = useTrade()
  const { currentUser, patchBalance } = useAuth()
  const [step, setStep] = useState(stock ? 'ticket' : 'select')
  const [selected, setSelected] = useState(stock || null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [orderKey, setOrderKey] = useState(null)
  const [gateMessage, setGateMessage] = useState('')
  const cancelRef = useRef(null)
  const searchRef = useRef(null)

  const {
    handleSubmit,
    setValue,
    reset,
    control
  } = useForm({
    defaultValues: {
      quantity: 1,
      side: defaultSide
    }
  })

  const currentSide = useWatch({ control, name: 'side' }) || defaultSide
  const currentQuantity = Number(useWatch({ control, name: 'quantity' }) || 1)

  // New draft = new idempotency key; retries of one draft reuse the key.
  useEffect(() => {
    if (isOpen) {
      reset({ quantity: 1, side: defaultSide })
      setSelected(stock || null)
      setStep(stock ? 'ticket' : 'select')
      setQuery('')
      setActiveIndex(0)
      setReceipt(null)
      setGateMessage('')
      setSubmitting(false)
      setOrderKey(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
    }
  }, [isOpen, stock, defaultSide, reset])

  // Focus management: search on selector, Cancel (safe default) on review.
  useEffect(() => {
    if (!isOpen) return
    if (step === 'select') searchRef.current?.focus()
    if (step === 'review') cancelRef.current?.focus()
  }, [isOpen, step])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (stocks || []).filter((s) => s && s.symbol)
    if (!q) return list.slice(0, 8)
    return list
      .filter((s) => s.symbol.toLowerCase().includes(q) || (s.name || '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [stocks, query])

  useEffect(() => setActiveIndex(0), [query])

  const chooseSymbol = (s) => {
    if (!s || !(Number(s.price) > 0)) return
    setSelected(s)
    reset({ quantity: 1, side: defaultSide })
    setGateMessage('')
    setStep('ticket')
  }

  if (!isOpen) return null

  // ── Step 0: symbol selector ──────────────────────────────────────
  if (step === 'select' || !selected) {
    return (
      <Dialog open={isOpen} onClose={onClose} side="right" ariaLabel="Choose a symbol to trade" className="p-6">
        <div className="text-[var(--ivory)]">
          <div className="flex items-center justify-between pb-4 border-b border-white/8">
            <div>
              <h3 className="text-base font-bold">Trade</h3>
              <p className="text-xs text-[var(--stone)] mt-0.5">Choose a symbol — none preselected.</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close trade"
              className="p-1.5 rounded-lg text-[var(--stone)] hover:text-[var(--ivory)] hover:bg-[rgba(255,255,255,0.06)] transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="relative mt-4">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--stone)]" aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls="trade-symbol-listbox"
              data-autofocus
              aria-activedescendant={matches[activeIndex] ? `trade-symbol-${matches[activeIndex].symbol}` : undefined}
              aria-label="Search symbols"
              placeholder="Search symbol or company…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, matches.length - 1)) }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)) }
                else if (e.key === 'Enter') { e.preventDefault(); if (matches[activeIndex]) chooseSymbol(matches[activeIndex]) }
              }}
              className="w-full rounded-xl border border-white/10 bg-[#0B0C0E] pl-9 pr-3 py-2.5 text-sm text-[var(--ivory)] placeholder:text-[var(--stone-muted)] focus:outline-none focus:border-[var(--brass)]"
            />
          </div>
          {matches.length === 0 ? (
            <p className="text-xs text-[var(--stone)] mt-4" role="status">No symbols match “{query}”. Try a ticker like AAPL or a company name.</p>
          ) : (
            <ul id="trade-symbol-listbox" role="listbox" aria-label="Symbols" className="mt-3 space-y-1 max-h-[50vh] overflow-y-auto">
              {matches.map((s, i) => {
                const prov = provenanceOf(s)
                const unavailable = prov.state === 'unavailable'
                return (
                  <li key={s.symbol}>
                    <button
                      type="button"
                      id={`trade-symbol-${s.symbol}`}
                      role="option"
                      aria-selected={i === activeIndex}
                      disabled={unavailable}
                      onClick={() => chooseSymbol(s)}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                        i === activeIndex ? 'border-[var(--brass)]/50 bg-white/[0.05]' : 'border-transparent hover:bg-white/[0.04]'
                      } ${unavailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span className="w-9 h-9 rounded-lg bg-[#0B0C0E] border border-white/8 flex items-center justify-center font-mono text-xs font-bold text-[var(--ivory)] shrink-0">
                        {s.symbol.slice(0, 3)}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold font-mono">{s.symbol}</span>
                        <span className="flex items-center gap-1.5 text-[11px] text-[var(--stone)] truncate">
                          <ProvenanceDot state={prov.state} />
                          {unavailable ? 'Unavailable' : `${formatCurrency(s.price)} · ${prov.label}`}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Dialog>
    )
  }

  const quote = provenanceOf(selected)
  const quoteBlocked = quote.state !== 'verified'

  // User's current holding for this stock
  const currentHolding = portfolio?.holdings?.find((h) => h.symbol === selected.symbol)
  const sharesOwned = currentHolding?.quantity || 0
  const cashBalance = Number(currentUser?.balance || 0)
  const totalCost = Number(selected.price || 0) * currentQuantity

  const isBuy = currentSide === 'BUY'
  const maxBuyQty = Math.max(0, Math.floor(cashBalance / (Number(selected.price) || 1)))
  const maxSellQty = sharesOwned
  const overLimit = isBuy ? totalCost > cashBalance : currentQuantity > sharesOwned

  const handleQuickQty = (qty) => {
    setValue('quantity', qty, { shouldValidate: true })
  }

  const handleMax = () => {
    const maxQty = isBuy ? maxBuyQty : maxSellQty
    setValue('quantity', Math.max(1, maxQty), { shouldValidate: true })
  }

  // Ticket-level quote refresh (stale/unverified recovery). The selected
  // symbol, entered quantity, side, and the draft's idempotency key are all
  // preserved: a retry after refresh reuses the same logical order, so a
  // refresh can never duplicate a fill. Failed refreshes leave everything
  // untouched and surface the accurate message.
  const handleRefreshQuote = async () => {
    if (refreshing || !selected?.symbol) return
    setRefreshing(true)
    try {
      const result = await refreshQuote(selected.symbol)
      if (result.success && result.stock) {
        setSelected((prev) => (prev ? { ...prev, ...result.stock } : prev))
        setGateMessage('')
        toast.success(`Quote refreshed — ${selected.symbol} verified as of now.`)
      } else {
        setGateMessage(result.message || 'Live market data is unavailable right now.')
      }
    } finally {
      setRefreshing(false)
    }
  }

  // Ticket submit → review sheet (never executes directly: opening the
  // interface must not imply an order was placed).
  const onSubmitTicket = () => {
    if (quoteBlocked) {
      setGateMessage(quote.state === 'stale' ? 'Quote is stale — refresh market data and retry.' : 'Quote unverified — refresh market data and retry.')
      return
    }
    if (overLimit) {
      setGateMessage(isBuy ? `Exceeds cash balance by ${formatCurrency(totalCost - cashBalance)}.` : `You own ${sharesOwned} shares.`)
      return
    }
    setGateMessage('')
    setStep('review')
  }

  const executeTrade = async () => {
    const qty = Number(currentQuantity)
    const side = currentSide
    if (quoteBlocked || (side === 'BUY' && totalCost > cashBalance) || (side === 'SELL' && qty > sharesOwned)) return { success: false }
    setSubmitting(true)
    try {
      const response = side === 'BUY' ? await buyStock(selected.symbol, qty, orderKey) : await sellStock(selected.symbol, qty, orderKey)
      if (response.success) {
        const tx = response.transaction || response.receipt
        setReceipt(tx ? {
          price: tx.price,
          quantity: tx.quantity,
          total: tx.total,
          id: tx._id || tx.id,
          symbol: tx.symbol || selected.symbol,
          side: tx.type || side
        } : null)
        if (response.balance !== undefined) {
          patchBalance(response.balance)
        }
        setStep('receipt')
        return { success: true }
      }
      // Terminal failure: draft + key preserved, retry reuses the same key.
      toast.error(`${response.message || 'Trade execution failed'} — retry reuses the same order key.`)
      return { success: false }
    } catch {
      toast.error('Trade execution failed — retry reuses the same order key.')
      return { success: false }
    } finally {
      setSubmitting(false)
    }
  }

  const startAgain = () => {
    setReceipt(null)
    reset({ quantity: 1, side: defaultSide })
    setGateMessage('')
    setOrderKey(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
    setStep('ticket')
  }

  const isStockPositive = Number(selected.changePercent || 0) >= 0

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      side="right"
      ariaLabel={`${selected.symbol} order ticket`}
      className="p-6"
    >
      <div className="text-[var(--ivory)]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-sm font-bold text-[var(--ivory)] font-mono">
              {selected.symbol.slice(0, 3)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[var(--ivory)] font-mono">{selected.symbol}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-mono ${
                    isStockPositive
                      ? 'bg-[var(--gain)]/15 text-[var(--gain)]'
                      : 'bg-[var(--loss)]/15 text-[var(--loss)]'
                  }`}
                >
                  {isStockPositive ? '+' : ''}
                  {Number(selected.changePercent || 0).toFixed(2)}%
                </span>
              </div>
              <p className="text-xs text-[var(--stone)] truncate max-w-[200px]">{selected.name}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close trade"
            className="p-1.5 rounded-lg text-[var(--stone)] hover:text-[var(--ivory)] hover:bg-[rgba(255,255,255,0.06)] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'receipt' ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[var(--gain)] mx-auto" />
            <h4 className="text-lg font-bold text-[var(--ivory)]">
              {receipt ? `${receipt.side === 'SELL' ? 'Sold' : 'Bought'} ${receipt.quantity} ${receipt.symbol} at ${formatCurrency(receipt.price)}` : 'Order filled'}
            </h4>
            {receipt && (
              <div className="text-xs text-[var(--stone)] space-y-1">
                <p>Total {formatCurrency(receipt.total)} · Order {String(receipt.id || '').slice(-8)}</p>
                <p>Server fill price — not an estimate.</p>
              </div>
            )}
            <div className="space-y-2 pt-2">
              <Button variant="secondary" type="button" onClick={startAgain} className="w-full py-2.5 rounded-xl">Trade again</Button>
              <Link to="/activity" onClick={onClose} className="block w-full py-2.5 rounded-xl text-center text-sm font-semibold text-[var(--brass)] hover:underline">
                View in Activity
              </Link>
              <Button variant="ghost" type="button" onClick={onClose} className="w-full py-2.5 rounded-xl">Done</Button>
            </div>
          </div>
        ) : step === 'review' ? (
          <div className="mt-5 space-y-4">
            <h4 className="text-sm font-bold">Review order</h4>
            <dl className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#181B1F] divide-y divide-white/5 text-xs">
              {[
                ['Symbol', selected.symbol],
                ['Side', currentSide],
                ['Quantity', String(currentQuantity)],
                ['Execution basis', 'Market — fills at server price'],
                ['Estimated total', formatCurrency(totalCost)],
                ['Order key', `…${String(orderKey || '').slice(-8)}`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-3.5 py-2.5">
                  <dt className="text-[var(--stone)]">{k}</dt>
                  <dd className="font-mono font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mf-meta">Nothing is placed until you confirm. Retries reuse the same order key.</p>
            <div className="sticky bottom-0 bg-[var(--ink-800)] pt-1 pb-1 flex gap-3">
              <Button ref={cancelRef} variant="secondary" type="button" onClick={() => setStep('ticket')} disabled={submitting} className="flex-1 py-2.5 rounded-xl">
                Cancel
              </Button>
              {isBuy ? (
                <BuyButton
                  label={submitting ? 'Executing…' : `Confirm buy ${currentQuantity} ${selected.symbol}`}
                  disabled={submitting}
                  className="flex-1 py-2.5 text-xs font-bold"
                  onClick={executeTrade}
                />
              ) : (
                <ParticleButton
                  type="button"
                  disabled={submitting}
                  tone="red"
                  className="flex-1 py-2.5 text-xs font-bold font-mono"
                  onClick={executeTrade}
                >
                  {submitting ? 'Executing…' : 'Confirm SELL'}
                </ParticleButton>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); onSubmitTicket() }} className="mt-5 space-y-4">
            {/* Side Selector (BUY / SELL) */}
            <SegmentedControl
              value={currentSide}
              onChange={(v) => setValue('side', v)}
              fullWidth
              ariaLabel="Order side"
              options={[
                {
                  value: 'BUY',
                  label: `Buy ${selected.symbol}`,
                  pillClass: 'bg-[var(--gain)] shadow-[0_2px_10px_rgba(79,178,134,0.35)]',
                  activeClass: 'text-black font-bold uppercase tracking-wider'
                },
                {
                  value: 'SELL',
                  label: `Sell ${selected.symbol}`,
                  pillClass: 'bg-[var(--loss)] shadow-[0_2px_10px_rgba(217,102,122,0.35)]',
                  activeClass: 'text-white font-bold uppercase tracking-wider'
                }
              ]}
            />

            {/* Price & Balance Info Bar */}
            <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
              <div>
                <p className="text-[var(--stone)]">Market Price</p>
                <p className="font-semibold text-sm text-[var(--ivory)] font-mono mt-0.5">
                  {formatCurrency(selected.price)}
                </p>
                <p className="flex items-center gap-1.5 text-[11px] mt-1 text-[var(--stone)]">
                  <ProvenanceDot state={quote.state} />
                  {quote.label}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[var(--stone)]">
                  {isBuy ? 'Buying Power' : 'Shares Owned'}
                </p>
                <p className="font-semibold text-sm text-[var(--ivory)] font-mono mt-0.5">
                  {isBuy ? formatCurrency(cashBalance) : `${sharesOwned} shares`}
                </p>
              </div>
            </div>

            {/* Quantity Input with Presets */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-[var(--stone)]">
                  Order Quantity
                </label>
                <div className="flex items-center gap-1.5">
                  {[1, 5, 10].map((qty) => (
                    <Chip
                      key={qty}
                      active={currentQuantity === qty}
                      onClick={() => handleQuickQty(qty)}
                    >
                      +{qty}
                    </Chip>
                  ))}
                  <Chip onClick={handleMax} tone="accent">
                    MAX
                  </Chip>
                </div>
              </div>

              <QuantityStepper
                value={currentQuantity}
                onChange={(n) => setValue('quantity', n)}
                min={1}
                max={Math.max(1, isBuy ? maxBuyQty : maxSellQty)}
                className="w-full"
              />
            </div>

            {/* Estimated Total & Summary */}
            <div className="p-3.5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#181B1F] space-y-2" aria-live="polite">
              <div className="flex items-center justify-between text-xs text-[var(--stone)]">
                <span>Order Type</span>
                <span className="text-[var(--ivory)] font-medium">Market Order (Instant)</span>
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--stone)]">
                <span>Estimated Value</span>
                <span className="text-base font-bold text-[var(--ivory)] font-mono">
                  {formatCurrency(totalCost)}
                </span>
              </div>
              {gateMessage && (
                <div className="flex items-center gap-1.5 text-xs text-[var(--loss)] pt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1">{gateMessage}</span>
                  {(quote.state === 'stale' || quote.state === 'unverified') && (
                    <button
                      type="button"
                      onClick={handleRefreshQuote}
                      disabled={refreshing}
                      className="shrink-0 rounded-lg border border-[var(--brass)]/40 px-2 py-1 font-mono text-[11px] font-semibold text-[var(--brass)] transition hover:bg-[var(--brass)]/10 disabled:opacity-40"
                    >
                      {refreshing ? 'Refreshing…' : 'Refresh quote'}
                    </button>
                  )}
                </div>
              )}
              {!gateMessage && isBuy && totalCost > cashBalance && (
                <div className="flex items-center gap-1.5 text-xs text-[var(--loss)] pt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Exceeds cash balance by {formatCurrency(totalCost - cashBalance)}</span>
                </div>
              )}
              {!gateMessage && !isBuy && currentQuantity > sharesOwned && (
                <div className="flex items-center gap-1.5 text-xs text-[var(--loss)] pt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>You only own {sharesOwned} shares</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="sticky bottom-0 bg-[var(--ink-800)] pt-1 pb-1 flex gap-3">
              <Button
                variant="secondary"
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl"
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-xl">
                Review {isBuy ? 'buy' : 'sell'}
              </Button>
            </div>
            <button
              type="button"
              onClick={() => { reset({ quantity: 1, side: defaultSide }); setQuery(''); setStep('select') }}
              className="flex items-center gap-1.5 text-xs text-[var(--stone)] hover:text-[var(--ivory)] transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Change symbol
            </button>
          </form>
        )}
      </div>
    </Dialog>
  )
}
