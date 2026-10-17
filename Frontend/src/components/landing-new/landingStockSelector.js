// React wiring for the public landing stock selector. All matching logic
// lives in ./stockSearch.js so it stays unit testable without a browser.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTrade } from '../../store/tradeStore'
import { filterStocks } from './stockSearch'

export { useOhlcSeries } from '../charts/market-charts'

export function useLandingStockSelector() {
  const stocks = useTrade((s) => s.stocks)
  const fetchStocks = useTrade((s) => s.fetchStocks)
  const [query, setQuery] = useState('')
  const [symbol, setSymbol] = useState('AAPL')
  const seqRef = useRef(0)

  // The public landing page must work before sign-in: the stock list route is
  // public, so a pre-login visitor still receives the real supported universe.
  useEffect(() => {
    if (!stocks.length) fetchStocks()
  }, [stocks.length, fetchStocks])

  const universe = useMemo(() => (Array.isArray(stocks) ? stocks.filter(Boolean) : []), [stocks])
  const results = useMemo(() => filterStocks(universe, query).slice(0, 8), [universe, query])
  const selected = useMemo(
    () => universe.find((s) => s.symbol === symbol) || universe[0] || null,
    [universe, symbol]
  )

  // If the chosen symbol is not in the universe yet, fall back to the first
  // real row rather than inventing one.
  useEffect(() => {
    if (!universe.length) return
    if (!universe.some((s) => s.symbol === symbol) && universe[0]) {
      seqRef.current += 1
      setSymbol(universe[0].symbol)
    }
  }, [universe, symbol])

  const choose = (next) => {
    if (!next?.symbol) return
    seqRef.current += 1
    setSymbol(next.symbol)
    setQuery('')
  }

  return { universe, results, selected, query, setQuery, choose, loading: !universe.length }
}