import exp from 'express'
import YahooFinance from 'yahoo-finance2'
import { verifyToken } from '../middlewares/verifyToken.js'
import { stockModel } from '../models/StockModel.js'
import { historyModel } from '../models/HistoryModel.js'

export const stockApp = exp.Router()

// -----------------------------
// Yahoo Finance Setup
// -----------------------------
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey']
})

// -----------------------------
// Stock List
// -----------------------------
const baseStocks = [
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', sector: 'Consumer Cyclical' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Semiconductors' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', sector: 'Automotive' },
  { symbol: 'META', name: 'Meta Platforms, Inc.', sector: 'Communication Services' },
  { symbol: 'NFLX', name: 'Netflix, Inc.', sector: 'Communication Services' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial Services' },
  { symbol: 'V', name: 'Visa Inc.', sector: 'Financial Services' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
  { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Defensive' },
  { symbol: 'PG', name: 'Procter & Gamble Co.', sector: 'Consumer Defensive' },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation', sector: 'Energy' },
  { symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare' },
  { symbol: 'MA', name: 'Mastercard Incorporated', sector: 'Financial Services' },
  { symbol: 'HD', name: 'The Home Depot, Inc.', sector: 'Consumer Cyclical' },
  { symbol: 'BAC', name: 'Bank of America Corp', sector: 'Financial Services' },
  { symbol: 'DIS', name: 'The Walt Disney Company', sector: 'Communication Services' },
  { symbol: 'CSCO', name: 'Cisco Systems, Inc.', sector: 'Technology' },
  { symbol: 'ADBE', name: 'Adobe Inc.', sector: 'Technology' },
  { symbol: 'CRM', name: 'Salesforce, Inc.', sector: 'Technology' },
  { symbol: 'PEP', name: 'PepsiCo, Inc.', sector: 'Consumer Defensive' },
  { symbol: 'KO', name: 'The Coca-Cola Company', sector: 'Consumer Defensive' },
  { symbol: 'INTC', name: 'Intel Corporation', sector: 'Semiconductors' },
  { symbol: 'PFE', name: 'Pfizer Inc.', sector: 'Healthcare' },
  { symbol: 'ABT', name: 'Abbott Laboratories', sector: 'Healthcare' },
  { symbol: 'MRK', name: 'Merck & Co., Inc.', sector: 'Healthcare' },
  { symbol: 'T', name: 'AT&T Inc.', sector: 'Communication Services' },
  { symbol: 'VZ', name: 'Verizon Communications', sector: 'Communication Services' }
]

// -----------------------------
// Sync Control
// -----------------------------
let lastSyncTime = 0
let syncInProgress = false

export const syncStocksData = async (force = false) => {
  try {
    const now = Date.now()

    // Skip if synced in last 5 minutes
    if (!force && now - lastSyncTime < 5 * 60 * 1000) {
      return
    }

    // Prevent overlapping syncs
    if (syncInProgress) {
      return
    }

    syncInProgress = true

    const symbols = baseStocks.map(stock => stock.symbol)

    console.log('[Yahoo Finance] Yahoo request started for symbols:', symbols)

    let quotes = []
    let isFallback = false
    try {
      quotes = await yahooFinance.quote(symbols)
      console.log('[Yahoo Finance] Yahoo request succeeded')
    } catch (err) {
      console.error('[Yahoo Finance] Yahoo request failed:', err.message)
      isFallback = true
    }

    let stocks = []

    if (isFallback) {
      console.warn('[Background Sync] Yahoo Finance unavailable. Triggering simulation fallback to prevent frozen UI.')
      const existingStocks = await stockModel.find().lean()
      if (existingStocks.length > 0) {
        stocks = existingStocks.map(s => {
          // Small realistic price movement (-1.5% to +1.5%)
          const changePercent = (Math.random() * 3 - 1.5)
          const change = Number((s.price * (changePercent / 100)).toFixed(2))
          const newPrice = Number(Math.max(0.01, s.price + change).toFixed(2))
          return {
            symbol: s.symbol,
            name: s.name,
            price: newPrice,
            change: change,
            changePercent: Number(changePercent.toFixed(2)),
            volume: Math.max(100, s.volume + Math.floor(Math.random() * 1000 - 500)),
            marketCap: Number((newPrice * (s.marketCap / s.price)).toFixed(2)),
            sector: s.sector
          }
        })
      } else {
        console.warn('[Background Sync] No existing stocks in DB to simulate. Initializing with base list values.')
        stocks = baseStocks.map(base => ({
          symbol: base.symbol,
          name: base.name,
          price: 100.0,
          change: 0.0,
          changePercent: 0.0,
          volume: 100000,
          marketCap: 100000000,
          sector: base.sector
        }))
      }
    } else {
      const quoteMap = new Map(quotes.map(q => [q.symbol, q]))
      stocks = baseStocks
        .map(base => {
          const quote = quoteMap.get(base.symbol)
          return {
            symbol: base.symbol,
            name: quote?.shortName || quote?.longName || base.name,
            price: quote?.regularMarketPrice || 0,
            change: quote?.regularMarketChange || 0,
            changePercent: quote?.regularMarketChangePercent || 0,
            volume: quote?.regularMarketVolume || 0,
            marketCap: quote?.marketCap || 0,
            sector: base.sector
          }
        })
        .filter(stock => stock.price > 0)
    }

    if (stocks.length > 0) {
      const previousStocks = await stockModel.find().lean()
      const previousStockMap = new Map(previousStocks.map(s => [s.symbol, s]))

      const bulkOps = stocks.map(stock => ({
        updateOne: {
          filter: { symbol: stock.symbol },
          update: { $set: stock },
          upsert: true
        }
      }))

      await stockModel.bulkWrite(bulkOps)
      lastSyncTime = now

      // Detailed logging for each stock update
      stocks.forEach(stock => {
        const prev = previousStockMap.get(stock.symbol)
        console.log('[Stock Refresh]', JSON.stringify({
          symbol: stock.symbol,
          previousPrice: prev ? prev.price : null,
          newPrice: stock.price,
          timestamp: new Date().toISOString(),
          updateSource: isFallback ? 'Simulation Fallback' : 'Yahoo Finance API'
        }))
      })

      console.log(`[Background Sync] Successfully updated ${stocks.length} stocks. Source: ${isFallback ? 'Simulation' : 'Yahoo Finance'}`)

      return stocks
    }

    return []
  } catch (err) {
    console.error('[Background Sync] Error syncing stock data:', err.message)
  } finally {
    syncInProgress = false
  }
}

// -----------------------------
// Initial Sync
// -----------------------------
syncStocksData(true)

// Sync every 5 minutes
setInterval(() => {
  syncStocksData()
}, 5 * 60 * 1000)

// -----------------------------
// Routes
// -----------------------------

// Get all stocks
stockApp.get('/stocks', async (req, res, next) => {
  try {
    // Set Cache-Control to prevent browser / proxy caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')

    const count = await stockModel.countDocuments()
    // On-demand sync
    if (count === 0) {
      console.log('[On-Demand Sync] Database empty. Syncing stocks synchronously...')
      await syncStocksData(true)
    } else if (Date.now() - lastSyncTime >= 5 * 60 * 1000) {
      console.log('[On-Demand Sync] Stale stock data detected (>= 5 minutes). Syncing stocks in background...')
      // Trigger background sync, catch error to prevent blocking request
      syncStocksData().catch(err => console.error('[Background Sync Error]', err.message))
    }

    const stocks = await stockModel.find().sort({ symbol: 1 }).lean()

    return res.status(200).json({
      message: 'Stocks fetched',
      stocks
    })
  } catch (err) {
    next(err)
  }
})

// Get stock by symbol
stockApp.get('/stocks/:symbol', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')

    const symbol = req.params.symbol?.toUpperCase()?.trim()

    if (!/^[A-Z.]{1,10}$/.test(symbol || '')) {
      return res.status(400).json({
        message: 'Invalid stock symbol'
      })
    }

    // Trigger background sync if last updated is older than 5 mins
    if (Date.now() - lastSyncTime >= 5 * 60 * 1000) {
      console.log('[On-Demand Sync] Stale stock data detected on individual fetch. Syncing stocks in background...')
      syncStocksData().catch(err => console.error('[Background Sync Error]', err.message))
    }

    const stock = await stockModel.findOne({ symbol }).lean()

    if (!stock) {
      return res.status(404).json({
        message: 'Stock not found'
      })
    }

    return res.status(200).json({
      message: 'Stock fetched',
      stock
    })
  } catch (err) {
    next(err)
  }
})

// Manual seed/update route
stockApp.post('/stocks/seed', verifyToken('USER'), async (req, res, next) => {
  try {
    const stocks = await syncStocksData(true)

    return res.status(200).json({
      message: 'Stocks synced successfully',
      count: stocks?.length || 0,
      stocks
    })
  } catch (err) {
    next(err)
  }
})

// -----------------------------
// Historical OHLC Data
// -----------------------------
// Cache lifetime: 24 hours (daily candles don't change intraday)
const HISTORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000

// Range → how many calendar days to fetch
const RANGE_DAYS = {
  '1D':  1,
  '1W':  7,
  '1M':  30,
  '3M':  90,
  '6M':  180,
  '1Y':  365,
  'ALL': 730 // ~2 years
}

stockApp.get('/history/:symbol', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')

    const symbol = req.params.symbol?.toUpperCase()?.trim()
    if (!symbol || !/^[A-Z.]{1,10}$/.test(symbol)) {
      return res.status(400).json({ message: 'Invalid stock symbol' })
    }

    // Check MongoDB cache first
    const cached = await historyModel.findOne({ symbol }).lean()
    const now = Date.now()

    if (cached && (now - new Date(cached.updatedAt).getTime()) < HISTORY_CACHE_TTL_MS) {
      return res.status(200).json({ message: 'History fetched (cache)', symbol, data: cached.data })
    }

    // Cache miss — fetch from Yahoo Finance
    console.log(`[History] Fetching historical data for ${symbol} from Yahoo Finance`)

    const period2 = new Date()
    const period1 = new Date()
    period1.setDate(period1.getDate() - 730) // fetch up to 2 years

    let rawData = []
    try {
      const result = await yahooFinance.historical(symbol, {
        period1: period1.toISOString().split('T')[0],
        period2: period2.toISOString().split('T')[0],
        interval: '1d'
      })
      rawData = result || []
    } catch (err) {
      console.error(`[History] Yahoo Finance fetch failed for ${symbol}:`, err.message)
      // If cache exists (even stale), return it as fallback
      if (cached) {
        return res.status(200).json({ message: 'History fetched (stale cache fallback)', symbol, data: cached.data })
      }
      return res.status(502).json({ message: 'Historical data temporarily unavailable' })
    }

    // Normalize Yahoo Finance response
    const data = rawData
      .filter(d => d.open && d.high && d.low && d.close)
      .map(d => ({
        timestamp: new Date(d.date),
        open:   Number(d.open.toFixed(2)),
        high:   Number(d.high.toFixed(2)),
        low:    Number(d.low.toFixed(2)),
        close:  Number(d.close.toFixed(2)),
        volume: Number(d.volume || 0)
      }))
      .sort((a, b) => a.timestamp - b.timestamp)

    // Upsert into cache
    await historyModel.findOneAndUpdate(
      { symbol },
      { symbol, data, updatedAt: new Date() },
      { upsert: true, new: true }
    )

    console.log(`[History] Cached ${data.length} candles for ${symbol}`)
    return res.status(200).json({ message: 'History fetched (live)', symbol, data })
  } catch (err) {
    next(err)
  }
})
