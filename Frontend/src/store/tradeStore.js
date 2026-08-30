import { create } from 'zustand'
import axios from 'axios'
import { useAuth } from './authStore'

//base api url
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

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
      return { success: true }
    } catch (err) {
      set({ loading: false })
      return {
        success: false,
        message: err.response?.data?.message || 'Failed to fetch stocks'
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
      return { success: true }
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
  buyStock: async (symbol, quantity) => {
    set({ loading: true })
    try {
      const response = await axios.post(
        `${API_BASE}/trade-api/buy`,
        { symbol, quantity },
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
        return { loading: false, portfolio: updatedPortfolio, transactions: updatedTransactions }
      })
      return {
        success: true,
        message: response.data.message,
        balance: response.data.balance
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
  sellStock: async (symbol, quantity) => {
    set({ loading: true })
    try {
      const response = await axios.post(
        `${API_BASE}/trade-api/sell`,
        { symbol, quantity },
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
        return { loading: false, portfolio: updatedPortfolio, transactions: updatedTransactions }
      })
      return {
        success: true,
        message: response.data.message,
        balance: response.data.balance
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
  // Stores { [symbol]: { data: [], fetchedAt: Date } }
  historyCache: {},
  historyLoading: {},

  // Cache TTL: 1 hour (backend refreshes once/day; we can safely re-use in-session)
  fetchHistory: async (symbol) => {
    if (!symbol) return { success: false, data: [] }

    const CACHE_TTL = 60 * 60 * 1000 // 1 hour

    // Return cached copy if fresh
    const cached = useTrade.getState().historyCache[symbol]
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      return { success: true, data: cached.data }
    }

    // Mark loading
    set((state) => ({
      historyLoading: { ...state.historyLoading, [symbol]: true }
    }))

    try {
      const response = await axios.get(`${API_BASE}/stock-api/history/${symbol}`, {
        withCredentials: true
      })
      const data = response.data.data || []

      set((state) => ({
        historyCache: {
          ...state.historyCache,
          [symbol]: { data, fetchedAt: Date.now() }
        },
        historyLoading: { ...state.historyLoading, [symbol]: false }
      }))

      return { success: true, data }
    } catch (err) {
      set((state) => ({
        historyLoading: { ...state.historyLoading, [symbol]: false }
      }))
      return {
        success: false,
        data: [],
        message: err.response?.data?.message || 'Failed to fetch history'
      }
    }
  },

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
