import { create } from 'zustand'
import axios from 'axios'
import { useAuth } from './authStore'
import { historyCacheKey, isHistoryFresh } from '../utils/historyCachePolicy'

//base api url
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

// In-flight history requests by symbol|range key: simultaneously mounted
// hooks share one network call instead of fanning out duplicates.
const inflightHistory = new Map()

export const useTrade = create((set) => ({
  stocks: [],
  portfolio: null,
  transactions: [],
  orders: [],
  marketSummary: null,
  loading: false,
  initializing: false,

  //helper: enrich raw holdings (from buy/sell response) with computed pnl fields
  //buy/sell responses return raw DB holdings without pnlPercent, invested, etc.
  //we re-derive them client-side using the current stock prices already in the store.
  enrichHoldings: (rawHoldings, stocks) => {
    const stockMap = new Map((stocks || []).map(s => [s.symbol, s]))
    return (rawHoldings || []).map(h => {
      const stock = stockMap.get(h.symbol)
      const currentPrice = stock?.price ?? h.currentPrice ?? 0
      const invested = Number(((h.quantity ?? 0) * (h.avgBuyPrice ?? 0)).toFixed(2))
      const currentValue = Number(((h.quantity ?? 0) * currentPrice).toFixed(2))
      const pnl = Number((currentValue - invested).toFixed(2))
      const pnlPercent = invested > 0 ? Number(((pnl / invested) * 100).toFixed(2)) : 0
      return { ...h, currentPrice, invested, currentValue, pnl, pnlPercent }
    })
  },

  //patch portfolio state directly after trade (avoids full re-fetch)
  updateAfterTrade: (balance, holdings, transaction) => {
    if (typeof balance === 'number') {
      useAuth.getState().patchBalance(balance)
    }
    set((state) => ({
      portfolio: state.portfolio
        ? {
            ...state.portfolio,
            holdings: holdings || state.portfolio.holdings,
            user: state.portfolio.user
              ? { ...state.portfolio.user, balance }
              : state.portfolio.user
          }
        : state.portfolio,
      transactions: transaction
        ? [transaction, ...state.transactions]
        : state.transactions
    }))
  },

  //fetch all stocks
  fetchStocks: async () => {
    set({ loading: true })
    try {
      const response = await axios.get(`${API_BASE}/stock-api/stocks`, {
        withCredentials: true
      })
      set({ stocks: response.data.stocks, loading: false })
      return { success: true, stale: Boolean(response.data?.meta?.stale) }
    } catch (err) {
      set({ loading: false })
      return {
        success: false,
        message: err.response?.data?.message || 'Failed to fetch stocks'
      }
    }
  },

  // Refresh ONE symbol's quote synchronously (order-ticket recovery path).
  // On success the store row is replaced with the verified row so gates
  // recompute; on failure the stored row is untouched (server guarantee) and
  // the caller gets the accurate message. Never synthesizes.
  refreshQuote: async (symbol) => {
    try {
      const response = await axios.post(`${API_BASE}/stock-api/quote/${symbol}/refresh`, {}, {
        withCredentials: true
      })
      const fresh = response.data?.stock
      if (response.data?.refreshed && fresh) {
        set((state) => ({
          stocks: (state.stocks || []).map((s) => s.symbol === fresh.symbol ? { ...s, ...fresh } : s)
        }))
        return { success: true, stock: fresh }
      }
      return { success: false, message: response.data?.message || 'Quote refresh failed' }
    } catch (err) {
      // A throttle is recoverable and must not read as a hard failure: the
      // order endpoint refreshes the quote itself before deciding.
      if (err.response?.status === 429) {
        return { success: false, throttled: true, message: err.response?.data?.message }
      }
      return {
        success: false,
        message: err.response?.data?.message || 'Live market data is unavailable right now'
      }
    }
  },

  //fetch market summary (top gainers, top losers, total market cap)
  fetchMarketSummary: async () => {
    set({ loading: true })
    try {
      const response = await axios.get(`${API_BASE}/market-api/summary`, {
        withCredentials: true
      })
      set({ marketSummary: response.data.summary, loading: false })
      return { success: true }
    } catch (err) {
      set({ loading: false })
      return {
        success: false,
        message: err.response?.data?.message || 'Failed to fetch market summary'
      }
    }
  },

  //fetch portfolio
  fetchPortfolio: async () => {
    set({ loading: true, initializing: true })
    try {
      const response = await axios.get(`${API_BASE}/trade-api/portfolio`, {
        withCredentials: true
      })
      set({
        portfolio: { ...response.data.portfolio, user: response.data.user },
        loading: false,
        initializing: false
      })
      return { success: true }
    } catch (err) {
      set({ loading: false, initializing: false })
      return {
        success: false,
        message: err.response?.data?.message || 'Failed to fetch portfolio'
      }
    }
  },

  //fetch transactions
  fetchTransactions: async () => {
    set({ loading: true })
    try {
      const response = await axios.get(`${API_BASE}/trade-api/transactions`, {
        withCredentials: true
      })
      set({ transactions: response.data.transactions, loading: false })
      return { success: true, scope: response.data.scope, total: response.data.total }
    } catch (err) {
      set({ loading: false })
      return {
        success: false,
        message: err.response?.data?.message || 'Failed to fetch transactions'
      }
    }
  },

  //fetch order history
  fetchOrders: async () => {
    set({ loading: true })
    try {
      const response = await axios.get(`${API_BASE}/trade-api/orders`, {
        withCredentials: true
      })
      set({ orders: response.data.orders, loading: false })
      return { success: true }
    } catch (err) {
      set({ loading: false })
      return {
        success: false,
        message: err.response?.data?.message || 'Failed to fetch orders'
      }
    }
  },

  //buy stock
  buyStock: async (symbol, quantity, idempotencyKey) => {
    set({ loading: true })
    try {
      const key = idempotencyKey || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
      const response = await axios.post(
        `${API_BASE}/trade-api/buy`,
        { symbol, quantity, idempotencyKey: key },
        { withCredentials: true }
      )
      const { balance, holdings, transaction } = response.data
      if (typeof balance === 'number') {
        useAuth.getState().patchBalance(balance)
      }
      set((state) => {
        // Enrich raw holdings with computed pnl fields before patching store
        const enriched = state.enrichHoldings(holdings, state.stocks)
        const updatedPortfolio = state.portfolio
          ? {
              ...state.portfolio,
              holdings: enriched.length > 0 ? enriched : state.portfolio.holdings,
              user: state.portfolio.user
                ? { ...state.portfolio.user, balance }
                : state.portfolio.user
            }
          : state.portfolio
        const updatedTransactions = transaction
          ? [transaction, ...state.transactions]
          : state.transactions
        return { loading: false, portfolio: updatedPortfolio, transactions: updatedTransactions, performanceCache: {} }
      })
      return {
        success: true,
        message: response.data.message,
        balance: response.data.balance,
        transaction: response.data.transaction,
        receipt: response.data.transaction
          ? {
              price: response.data.transaction.price,
              quantity: response.data.transaction.quantity,
              total: response.data.transaction.total,
              id: response.data.transaction._id,
              symbol: response.data.transaction.symbol,
              side: response.data.transaction.type
            }
          : null
      }
    } catch (err) {
      set({ loading: false })
      return {
        success: false,
        message: err.response?.data?.message || 'Buy failed'
      }
    }
  },

  //sell stock
  sellStock: async (symbol, quantity, idempotencyKey) => {
    set({ loading: true })
    try {
      const key = idempotencyKey || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
      const response = await axios.post(
        `${API_BASE}/trade-api/sell`,
        { symbol, quantity, idempotencyKey: key },
        { withCredentials: true }
      )
      const { balance, holdings, transaction } = response.data
      if (typeof balance === 'number') {
        useAuth.getState().patchBalance(balance)
      }
      set((state) => {
        // Enrich raw holdings with computed pnl fields before patching store
        const enriched = state.enrichHoldings(holdings, state.stocks)
        const updatedPortfolio = state.portfolio
          ? {
              ...state.portfolio,
              // holdings may be empty array on full sell — use enriched directly
              holdings: enriched,
              user: state.portfolio.user
                ? { ...state.portfolio.user, balance }
                : state.portfolio.user
            }
          : state.portfolio
        const updatedTransactions = transaction
          ? [transaction, ...state.transactions]
          : state.transactions
        return { loading: false, portfolio: updatedPortfolio, transactions: updatedTransactions, performanceCache: {} }
      })
      return {
        success: true,
        message: response.data.message,
        balance: response.data.balance,
        transaction: response.data.transaction,
        receipt: response.data.transaction
          ? {
              price: response.data.transaction.price,
              quantity: response.data.transaction.quantity,
              total: response.data.transaction.total,
              id: response.data.transaction._id,
              symbol: response.data.transaction.symbol,
              side: response.data.transaction.type
            }
          : null
      }
    } catch (err) {
      set({ loading: false })
      return {
        success: false,
        message: err.response?.data?.message || 'Sell failed'
      }
    }
  },

  // ── Historical OHLC cache ──────────────────────────────────────────────────
  // Stores { [key]: { data: [], fetchedAt: Date } }; key = `${symbol}|${range}`
  // 'ALL' = daily rows (backend refreshes once/day -> long TTL), '1D' = intraday.
  historyCache: {},
  historyLoading: {},
  sparklineCache: {},
  performanceCache: {},

  fetchHistory: async (symbol, range = 'ALL', opts = {}) => {
    if (!symbol) return { success: false, data: [], fetchedAt: 0 }

    const key = historyCacheKey(symbol, range)

    // Return cached copy if fresh (D10: report the entry timestamp so charts
    // label series freshness from its own source, never from a re-render).
    // Freshness rules (future-dated/malformed entries are never fresh) live
    // in historyCachePolicy and are unit-tested.
    const cached = useTrade.getState().historyCache[key]
    if (isHistoryFresh(cached, range)) {
      return { success: true, data: cached.data, fetchedAt: cached.fetchedAt }
    }

    // Dedupe: hooks mounting together (S01 + S06 both want NVDA|ALL) share
    // one network request. A caller with an abort signal races the shared
    // call: aborting rejects only that caller's await (hook guards drop it),
    // never the shared request others still need.
    if (inflightHistory.has(key)) {
      const shared = inflightHistory.get(key)
      if (!opts.signal || opts.signal.aborted) {
        if (!opts.signal) return shared
        return shared.catch(() => ({ success: false, data: [], aborted: true, fetchedAt: 0 }))
      }
      const abortRejection = new Promise((_, reject) => {
        const onAbort = () => {
          const err = new Error('aborted')
          err.code = 'ERR_CANCELED'
          reject(err)
        }
        opts.signal.addEventListener('abort', onAbort, { once: true })
      })
      return Promise.race([shared, abortRejection]).catch((err) => {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
          return { success: false, data: [], aborted: true, fetchedAt: 0 }
        }
        throw err
      })
    }

    // Mark loading
    set((state) => ({
      historyLoading: { ...state.historyLoading, [key]: true }
    }))

    const run = async () => {
      try {
        const url = range === '1D'
          ? `${API_BASE}/stock-api/history/${symbol}?interval=60m`
          : `${API_BASE}/stock-api/history/${symbol}`
        const response = await axios.get(url, { withCredentials: true })
        const data = response.data.data || []
        const fetchedAt = Date.now()

        set((state) => ({
          historyCache: {
            ...state.historyCache,
            [key]: { data, fetchedAt }
          },
          historyLoading: { ...state.historyLoading, [key]: false }
        }))

        return { success: true, data, fetchedAt }
      } catch (err) {
        set((state) => ({
          historyLoading: { ...state.historyLoading, [key]: false }
        }))
        // Aborted requests are not failures — the hook refetches on visibility.
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
          return { success: false, data: [], aborted: true, fetchedAt: 0 }
        }
        return {
          success: false,
          data: [],
          fetchedAt: 0,
          message: err.response?.data?.message || 'Failed to fetch history'
        }
      } finally {
        inflightHistory.delete(key)
      }
    }

    const shared = run()
    inflightHistory.set(key, shared)
    return shared
  },

  // Last 30 daily closes for sparklines (small payload via ?limit=)
  fetchSparkline: async (symbol) => {
    if (!symbol) return { success: true, data: [] }
    const cached = useTrade.getState().sparklineCache[symbol]
    if (cached && Date.now() - cached.fetchedAt < 60 * 60 * 1000) {
      return { success: true, data: cached.data }
    }
    try {
      const response = await axios.get(
        `${API_BASE}/stock-api/history/${symbol}?limit=30`,
        { withCredentials: true }
      )
      const data = (response.data.data || []).map((d) => ({
        label: new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: Number(d.close)
      }))
      set((state) => ({
        sparklineCache: { ...state.sparklineCache, [symbol]: { data, fetchedAt: Date.now() } }
      }))
      return { success: true, data }
    } catch {
      return { success: true, data: [] }
    }
  },

  // Real portfolio equity curve for a range (computed server-side).
  // Fresh enough: invalidated on every trade.
  fetchPortfolioPerformance: async (range = '1M') => {
    const key = String(range || '1M').toUpperCase()
    const cached = useTrade.getState().performanceCache[key]
    if (cached && Date.now() - cached.fetchedAt < 30 * 1000) {
      return { success: true, data: cached.data, meta: cached.meta }
    }
    try {
      const response = await axios.get(
        `${API_BASE}/trade-api/performance?range=${key}`,
        { withCredentials: true }
      )
      const data = response.data.data || []
      const meta = response.data.meta || {}
      set((state) => ({
        performanceCache: {
          ...state.performanceCache,
          [key]: { data, meta, fetchedAt: Date.now() }
        }
      }))
      return { success: true, data, meta }
    } catch (err) {
      return {
        success: false,
        data: [],
        meta: {},
        message: err.response?.data?.message || 'Failed to fetch performance'
      }
    }
  },

  invalidatePerformanceCache: () => set({ performanceCache: {} }),

  // ── Centralized polling ────────────────────────────────────────────────────
  // A single shared interval that refreshes stocks every 30 seconds.
  // Components call startPolling() on mount and stopPolling() on unmount.
  // The ref-count mechanism ensures the interval survives partial unmounts
  // (e.g. switching tabs) and only tears down when all subscribers are gone.
  _pollRefCount: 0,
  _pollInterval: null,

  startPolling: () => {
    set((state) => {
      const newCount = state._pollRefCount + 1
      if (newCount === 1 && !state._pollInterval) {
        const interval = setInterval(() => {
          useTrade.getState().fetchStocks()
        }, 30 * 1000)
        return { _pollRefCount: newCount, _pollInterval: interval }
      }
      return { _pollRefCount: newCount }
    })
  },

  stopPolling: () => {
    set((state) => {
      const newCount = Math.max(0, state._pollRefCount - 1)
      if (newCount === 0 && state._pollInterval) {
        clearInterval(state._pollInterval)
        return { _pollRefCount: 0, _pollInterval: null }
      }
      return { _pollRefCount: newCount }
    })
  }
}))
