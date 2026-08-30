import { useState, useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import toast from 'react-hot-toast'
import { X, CheckCircle2, AlertCircle } from 'lucide-react'
import { useTrade } from '../../store/tradeStore'
import { useAuth } from '../../store/authStore'
import { formatCurrency } from '../../utils/marketAnalytics'
import { BorderBeam } from '../magicui/BorderBeam'
import { ShimmerButton } from '../magicui/ShimmerButton'
import { BuyButton } from '../ui/BuyButton'
import { Button, Chip } from '../ui/Button'
import { SegmentedControl } from '../ui/SegmentedControl'
import { QuantityStepper } from '../ui/QuantityStepper'

export default function TradeModal({ stock, isOpen, onClose, defaultSide = 'BUY' }) {
  const { buyStock, sellStock, portfolio } = useTrade()
  const { currentUser, patchBalance } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

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

  useEffect(() => {
    if (isOpen) {
      reset({ quantity: 1, side: defaultSide })
      setConfirmed(false)
    }
  }, [isOpen, defaultSide, reset])

  if (!isOpen || !stock) return null

  // User's current holding for this stock
  const currentHolding = portfolio?.holdings?.find((h) => h.symbol === stock.symbol)
  const sharesOwned = currentHolding?.quantity || 0
  const cashBalance = Number(currentUser?.balance || 0)
  const totalCost = Number(stock.price || 0) * currentQuantity

  const isBuy = currentSide === 'BUY'
  const maxBuyQty = Math.max(0, Math.floor(cashBalance / (Number(stock.price) || 1)))
  const maxSellQty = sharesOwned

  const handleQuickQty = (qty) => {
    setValue('quantity', qty, { shouldValidate: true })
  }

  const handleMax = () => {
    const maxQty = isBuy ? maxBuyQty : maxSellQty
    setValue('quantity', Math.max(1, maxQty), { shouldValidate: true })
  }

  const onSubmitTrade = async (data) => {
    setSubmitting(true)
    const qty = Number(data.quantity)
    const side = data.side

    if (side === 'BUY' && totalCost > cashBalance) {
      toast.error('Insufficient cash balance to execute this trade.')
      setSubmitting(false)
      return
    }

    if (side === 'SELL' && qty > sharesOwned) {
      toast.error(`You only own ${sharesOwned} shares of ${stock.symbol}.`)
      setSubmitting(false)
      return
    }

    const response =
      side === 'BUY' ? await buyStock(stock.symbol, qty) : await sellStock(stock.symbol, qty)

    setSubmitting(false)

    if (response.success) {
      toast.success(response.message || `${side} order filled for ${qty} shares of ${stock.symbol}`)
      if (response.balance !== undefined) {
        patchBalance(response.balance)
      }
      setConfirmed(true)
      setTimeout(() => {
        onClose()
      }, 1400)
    } else {
      toast.error(response.message || 'Trade execution failed')
    }
  }

  const isStockPositive = Number(stock.changePercent || 0) >= 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-md rounded-2xl border border-white/15 bg-[#151820]/95 shadow-2xl p-6 text-[#F5F7FA] relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <BorderBeam size={200} duration={8} colorFrom={isBuy ? '#22C55E' : '#EF4444'} colorTo="#3B82F6" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-sm font-bold text-[#F5F7FA] font-mono">
              {stock.symbol.slice(0, 3)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#F5F7FA] font-mono">{stock.symbol}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-mono ${
                    isStockPositive
                      ? 'bg-[#22C55E]/15 text-[#22C55E]'
                      : 'bg-[#EF4444]/15 text-[#EF4444]'
                  }`}
                >
                  {isStockPositive ? '+' : ''}
                  {Number(stock.changePercent || 0).toFixed(2)}%
                </span>
              </div>
              <p className="text-xs text-[#9CA3AF] truncate max-w-[200px]">{stock.name}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#F5F7FA] hover:bg-[rgba(255,255,255,0.06)] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {confirmed ? (
          <div className="py-10 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[#22C55E] mx-auto animate-bounce" />
            <h4 className="text-lg font-bold text-[#F5F7FA]">Order Executed Successfully!</h4>
            <p className="text-xs text-[#9CA3AF]">
              {currentSide} {currentQuantity} shares of {stock.symbol} at {formatCurrency(stock.price)}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmitTrade)} className="mt-5 space-y-4">
            {/* Side Selector (BUY / SELL) */}
            <SegmentedControl
              value={currentSide}
              onChange={(v) => setValue('side', v)}
              fullWidth
              options={[
                {
                  value: 'BUY',
                  label: `Buy ${stock.symbol}`,
                  pillClass: 'bg-[#22C55E] shadow-[0_2px_10px_rgba(34,197,94,0.35)]',
                  activeClass: 'text-black font-bold uppercase tracking-wider'
                },
                {
                  value: 'SELL',
                  label: `Sell ${stock.symbol}`,
                  pillClass: 'bg-[#EF4444] shadow-[0_2px_10px_rgba(239,68,68,0.35)]',
                  activeClass: 'text-white font-bold uppercase tracking-wider'
                }
              ]}
            />

            {/* Price & Balance Info Bar */}
            <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
              <div>
                <p className="text-[#9CA3AF]">Market Price</p>
                <p className="font-semibold text-sm text-[#F5F7FA] font-mono mt-0.5">
                  {formatCurrency(stock.price)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[#9CA3AF]">
                  {isBuy ? 'Buying Power' : 'Shares Owned'}
                </p>
                <p className="font-semibold text-sm text-[#F5F7FA] font-mono mt-0.5">
                  {isBuy ? formatCurrency(cashBalance) : `${sharesOwned} shares`}
                </p>
              </div>
            </div>

            {/* Quantity Input with Presets */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-[#9CA3AF]">
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
            <div className="p-3.5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#151820] space-y-2">
              <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
                <span>Order Type</span>
                <span className="text-[#F5F7FA] font-medium">Market Order (Instant)</span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
                <span>Estimated Value</span>
                <span className="text-base font-bold text-[#F5F7FA] font-mono">
                  {formatCurrency(totalCost)}
                </span>
              </div>
              {isBuy && totalCost > cashBalance && (
                <div className="flex items-center gap-1.5 text-xs text-[#EF4444] pt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Exceeds cash balance by {formatCurrency(totalCost - cashBalance)}</span>
                </div>
              )}
              {!isBuy && currentQuantity > sharesOwned && (
                <div className="flex items-center gap-1.5 text-xs text-[#EF4444] pt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>You only own {sharesOwned} shares</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl"
              >
                Cancel
              </Button>
              {isBuy ? (
                <BuyButton
                  label={`Buy ${currentQuantity} ${stock.symbol}`}
                  disabled={submitting || totalCost > cashBalance}
                  className="flex-1 py-2.5 text-xs font-bold"
                  onClick={async () => {
                    const qty = Number(currentQuantity)
                    if (totalCost > cashBalance) {
                      toast.error('Insufficient cash balance to execute this trade.')
                      return { success: false }
                    }
                    const response = await buyStock(stock.symbol, qty)
                    if (response.success) {
                      toast.success(response.message || `BUY order filled for ${qty} shares of ${stock.symbol}`)
                      if (response.balance !== undefined) {
                        patchBalance(response.balance)
                      }
                      setConfirmed(true)
                      setTimeout(() => onClose(), 1400)
                    } else {
                      toast.error(response.message || 'Trade execution failed')
                    }
                    return response
                  }}
                />
              ) : (
                <ShimmerButton
                  type="submit"
                  disabled={submitting || currentQuantity > sharesOwned}
                  background="#EF4444"
                  className="flex-1 py-2.5 text-xs font-bold font-mono"
                >
                  {submitting ? 'Executing...' : 'Confirm SELL'}
                </ShimmerButton>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
