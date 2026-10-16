import { toProviderTime } from '../config/universe.js'

export function isExecutableQuote(stock, symbol = stock?.symbol, now = Date.now()) {
  if (!stock || stock.symbol !== symbol || stock.source !== 'yahoo' || stock.stale || stock.marketState !== 'REGULAR') return false
  if (!Number.isFinite(stock.price) || stock.price <= 0) return false
  return [stock.providerTime, stock.lastVerifiedAt].every(value => {
    const time = toProviderTime(value)?.getTime()
    const age = now - time
    return Number.isFinite(age) && age >= 0 && age <= 5 * 60 * 1000
  })
}
