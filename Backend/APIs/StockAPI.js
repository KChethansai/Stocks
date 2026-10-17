import exp from 'express'
import YahooFinance from 'yahoo-finance2'
import { verifyToken } from '../middlewares/verifyToken.js'
import { stockModel } from '../models/StockModel.js'
import { historyModel, intradayHistoryModel } from '../models/HistoryModel.js'
import { checkPriceTriggers } from '../services/priceMonitor.js'
import { cached, invalidateCache } from '../config/cache.js'
import { baseStocks, toProviderTime } from '../config/universe.js'
import { buildVerifiedQuoteRow, refreshAllowed, rememberRefresh, fetchQuoteWithRetry } from '../services/quoteRefresh.js'
import { isExecutableQuote } from '../services/quotePolicy.js'

export const stockApp = exp.Router()

// Stock list is re-synced on the cadence below, so a 60s in-memory read cache is safe.
const STOCKS_LIST_CACHE_TTL_MS = 60 * 1000

// Sync cadence. The execution gate fills only against a quote verified
// within the freshness window (5 min), so the sync must run comfortably
// inside it — a 5-minute cadence left quotes expiring at almost exactly the
// moment the next sync was due, which is what made orders fail
// intermittently. A 60-second cadence keeps genuine quotes fresh without
// loosening the gate.
const SYNC_INTERVAL_MS = 60 * 1000

// -----------------------------
// Yahoo Finance Setup
// -----------------------------
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey']
})

// -----------------------------
// Per-symbol quote refresh (order-ticket recovery path)
// -----------------------------
// Why this exists: the ticket's provenance gate blocks buys on stale or
// unverified rows, but GET /stocks only triggers a background full-universe
// sync (≥5 min cadence, 60 s read cache) and POST /stocks/seed is throttled
// to once per 5 minutes — so "refresh market data and retry" named an action
// the ticket could not perform. This endpoint force-syncs ONE symbol
// synchronously and persists the verified row, so a subsequent order with the
// same idempotency key can proceed. Failures never touch the stored row and
// never mark failed data fresh: the caller gets an accurate, recoverable
// message instead.
//
// Recovery requires Yahoo's explicit REGULAR state and a recent provider time.
// Closed/unknown state fails closed, leaving the stored row unchanged. This
// is provider-reported state, not an exchange calendar. Execution rechecks
// the stored provider state and age using the same five-minute window.
// Pure helpers live in services/quoteRefresh.js (side-effect free, unit
// tested); the route below only wires transport + persistence.

stockApp.post('/quote/:symbol/refresh', verifyToken('USER'), async (req, res, next) => {
  try {
    const symbol = req.params.symbol?.toUpperCase()?.trim()
    if (!symbol || !/^[A-Z.]{1,10}$/.test(symbol)) {
      return res.status(400).json({ message: 'Invalid stock symbol' })
    }

    const base = baseStocks.find((s) => s.symbol === symbol)
    const existing = await stockModel.findOne({ symbol }).lean()
    if (!base && !existing) {
      return res.status(404).json({ message: 'Stock not found' })
    }
    // Sector/name truth comes from the tracked universe; an existing row
    // outside the universe keeps its stored sector.
    const baseLike = base || { symbol, name: existing.name, sector: existing.sector }

    const throttleKey = `${req.user.id}:${symbol}`
    const allowed = refreshAllowed(throttleKey)
    if (!allowed.ok) {
      // Not a dead end: the order endpoint verifies the quote itself, so a
      // throttled *refresh* never blocks trading. Say so, and stop pointing
      // the user at a manual order retry that is no longer required.
      return res.status(429).json({
        message:
          'Quote refresh throttled — a refresh for this symbol just ran. You can submit the order directly; it verifies the quote automatically.',
        retryAfterMs: allowed.retryAfterMs,
        symbol
      })
    }
    rememberRefresh(throttleKey)

    let quotes
    try {
      quotes = await fetchQuoteWithRetry(symbol, () => yahooFinance.quote(symbol))
    } catch (err) {
      console.error(`[Quote Refresh] Yahoo request failed for ${symbol}:`, err.message)
      const limited = err?.quoteFailure === 'rate-limited'
      return res.status(limited ? 429 : 502).json({
        message: limited
          ? 'The data provider is rate-limiting requests right now. The stored quote is unchanged — you can submit the order and it will retry, or wait a moment and refresh again.'
          : 'Live market data is unavailable right now — the stored quote is unchanged. Retry shortly; the symbol and quantity are preserved.',
        symbol,
        refreshed: false
      })
    }

    const list = Array.isArray(quotes) ? quotes : [quotes]
    const quote = list.find((q) => q?.symbol === symbol)
    const row = buildVerifiedQuoteRow(baseLike, quote)
    if (!row) {
      return res.status(502).json({
        message: 'No usable quote could be verified from the provider (unknown session state, mismatched symbol, or invalid price). The stored quote is unchanged.',
        symbol,
        refreshed: false
      })
    }

    await stockModel.updateOne({ symbol }, { $set: row }, { upsert: true })
    invalidateCache('stocks-list')
    invalidateCache('market-summary')

    return res.status(200).json({
      message: 'Quote refreshed',
      refreshed: true,
      stock: { ...row, stale: false },
      meta: { asOf: row.asOf.toISOString(), source: 'yahoo' }
    })
  } catch (err) {
    next(err)
  }
})

// -----------------------------
// Sync Control
// -----------------------------
let lastSyncTime = 0
let syncInProgress = false

const syncStocksData = async (force = false) => {
  try {
    const now = Date.now()

    // Skip if synced within the cadence window (see SYNC_INTERVAL_MS).
    if (!force && now - lastSyncTime < SYNC_INTERVAL_MS) {
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
    let quoteSource = 'yahoo'
    let quotesAsOf = new Date()

    if (isFallback) {
      // Phase 0 correctness: NEVER synthesize prices into ordinary stock
      // records. Preserve the last verified quote and mark it stale so the
      // UI can show "as of {time}" instead of a fabricated live price.
      // No consent flag may mix synthetic prices into trading records.
      console.warn('[Background Sync] Yahoo Finance unavailable. Preserving last verified quotes as stale.')
      const existingStocks = await stockModel.find().lean()
      if (existingStocks.length > 0) {
        await stockModel.updateMany({}, { $set: { stale: true } })
        lastSyncTime = now
        invalidateCache('stocks-list')
        invalidateCache('market-summary')
        console.log(`[Background Sync] Marked ${existingStocks.length} stocks stale; prices untouched.`)
      }
      return []
    } else {
      const quoteMap = new Map(quotes.map(q => [q.symbol, q]))
      quotesAsOf = new Date()
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
            sector: base.sector,
            source: 'yahoo',
            asOf: quotesAsOf,
            providerTime: toProviderTime(quote?.regularMarketTime),
            marketState: quote?.marketState || null,
            lastVerifiedAt: quotesAsOf,
            stale: false
          }
        })
        .filter(stock => Number.isFinite(stock.price) && stock.price > 0)
        .map(stock => ({ ...stock, stale: !isExecutableQuote(stock) }))
    }

    if (stocks.length > 0) {
      const bulkOps = stocks.map(stock => ({
        updateOne: {
          filter: { symbol: stock.symbol },
          update: { $set: stock },
          upsert: true
        }
      }))

      await stockModel.bulkWrite(bulkOps)
      lastSyncTime = now

      // Fresh data is in — drop stale read caches
      invalidateCache('stocks-list')
      invalidateCache('market-summary')

      console.log(`[Background Sync] Successfully updated ${stocks.length} stocks. Source: Yahoo Finance`)

      // Fresh prices are in — evaluate price-alert thresholds on the same
      // tick (no competing poller). Fire-and-forget: a monitor failure must
      // never fail the stock sync.
      checkPriceTriggers().catch((err) =>
        console.error('[PriceMonitor] Tick failed:', err.message)
      )

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

setInterval(() => {
  syncStocksData()
}, SYNC_INTERVAL_MS)

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
    } else if (Date.now() - lastSyncTime >= SYNC_INTERVAL_MS) {
      console.log('[On-Demand Sync] Stale stock data detected (>= 5 minutes). Syncing stocks in background...')
      // Trigger background sync, catch error to prevent blocking request
      syncStocksData().catch(err => console.error('[Background Sync Error]', err.message))
    }

    const stocks = await cached(`stocks-list`, STOCKS_LIST_CACHE_TTL_MS, () =>
      stockModel.find().sort({ symbol: 1 }).lean()
    )

    // Provenance summary: legacy rows without a source are treated as
    // unverified (log windows cannot prove origin). Stale = last Yahoo sync
    // failed or data is older than the 5-minute window.
    const withProvenance = (stocks || []).map((s) => ({
      ...s,
      source: s.source || 'unverified',
      stale: !isExecutableQuote(s)
    }))
    const verifiedAt = withProvenance
      .map((s) => s.lastVerifiedAt ? new Date(s.lastVerifiedAt).getTime() : 0)
      .reduce((a, b) => Math.max(a, b), 0)

    return res.status(200).json({
      message: 'Stocks fetched',
      stocks: withProvenance,
      meta: {
        source: withProvenance.every((s) => s.source === 'yahoo' && !s.stale) ? 'yahoo' : 'mixed',
        asOf: verifiedAt ? new Date(verifiedAt).toISOString() : null,
        stale: withProvenance.some((s) => s.stale)
      }
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
    if (Date.now() - lastSyncTime >= SYNC_INTERVAL_MS) {
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
      stock: {
        ...stock,
        source: stock.source || 'unverified',
        stale: !isExecutableQuote(stock)
      }
    })
  } catch (err) {
    next(err)
  }
})

// Manual seed/update route — throttled so any authenticated user cannot force
// repeated full Yahoo syncs (third-party API cost / abuse vector).
stockApp.post('/stocks/seed', verifyToken('USER'), async (req, res, next) => {
  try {
    if (Date.now() - lastSyncTime < 5 * 60 * 1000) {
      return res.status(200).json({
        message: 'Stock data is fresh — manual sync is throttled to once per 5 minutes',
        count: 0,
        stocks: []
      })
    }

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
// Per-stock news (via Yahoo search)
// -----------------------------
// search() is the only yahoo-finance2 module carrying news (no standalone
// news module in v3.14.1). News tolerates staleness, so a 30-min in-memory
// cache per symbol keeps us far under Yahoo rate limits. Fail-soft: Yahoo
// errors return 200 with an empty (or stale-cached) list, never a 502 —
// a missing panel must not break the detail view.
const NEWS_CACHE_TTL_MS = 30 * 60 * 1000
const NEWS_COUNT = 8
// Bounded LRU: the key space is attacker-influenced (any valid ticker), so
// an unbounded Map would grow heap until entries age out. Evict oldest-first.
const NEWS_CACHE_MAX = 200
const newsCache = new Map()
const setNewsCache = (symbol, entry) => {
  if (newsCache.has(symbol)) newsCache.delete(symbol)
  newsCache.set(symbol, entry)
  if (newsCache.size > NEWS_CACHE_MAX) {
    const oldest = newsCache.keys().next().value
    newsCache.delete(oldest)
  }
}

stockApp.get('/news/:symbol', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')

    const symbol = req.params.symbol?.toUpperCase()?.trim()
    if (!symbol || !/^[A-Z.]{1,10}$/.test(symbol)) {
      return res.status(400).json({ message: 'Invalid stock symbol' })
    }

    const hit = newsCache.get(symbol)
    if (hit && Date.now() - hit.at < NEWS_CACHE_TTL_MS) {
      return res.status(200).json({ message: 'News fetched (cache)', symbol, news: hit.items })
    }

    let items = []
    try {
      const results = await yahooFinance.search(symbol, { quotesCount: 0, newsCount: NEWS_COUNT })
      items = (results?.news || [])
        .map((a) => {
          // providerPublishTime arrives in ms on some articles, s on others.
          const ts = Number(a?.providerPublishTime) || 0
          return {
            title: a?.title || '',
            publisher: a?.publisher || 'Yahoo Finance',
            link: a?.link || a?.url || '',
            publishedAt: ts ? new Date(ts > 1e12 ? ts : ts * 1000).toISOString() : null
          }
        })
        .filter((a) => a.title)
        .slice(0, NEWS_COUNT)
    } catch (err) {
      console.error(`[News] Yahoo Finance search failed for ${symbol}:`, err.message)
      // Stale cache beats an empty panel; empty beats an error.
      return res.status(200).json({
        message: 'News temporarily unavailable',
        symbol,
        stale: true,
        news: hit?.items || []
      })
    }

    setNewsCache(symbol, { at: Date.now(), items })
    return res.status(200).json({ message: 'News fetched (live)', symbol, news: items })
  } catch (err) {
    next(err)
  }
})
// Daily candles don't change intraday: 24h cache. Intraday (60m) candles are
// fresher: 15m cache. Both are answered from the same route via ?interval=.
const HISTORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const INTRADAY_CACHE_TTL_MS = 15 * 60 * 1000
const MAX_LIMIT = 500

stockApp.get('/history/:symbol', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')

    const symbol = req.params.symbol?.toUpperCase()?.trim()
    if (!symbol || !/^[A-Z.]{1,10}$/.test(symbol)) {
      return res.status(400).json({ message: 'Invalid stock symbol' })
    }

    const interval = String(req.query.interval || '1d')
    if (!['1d', '60m'].includes(interval)) {
      return res.status(400).json({ message: 'Unsupported interval' })
    }
    const requestedLimit = Math.max(0, Math.min(Number(req.query.limit) || 0, MAX_LIMIT))

    const isIntraday = interval === '60m'
    const Model = isIntraday ? intradayHistoryModel : historyModel
    const ttlMs = isIntraday ? INTRADAY_CACHE_TTL_MS : HISTORY_CACHE_TTL_MS
    const periodDays = isIntraday ? 6 : 730

    // Check MongoDB cache first
    const cached = await Model.findOne({ symbol }).lean()
    const now = Date.now()

    if (cached && (now - new Date(cached.updatedAt).getTime()) < ttlMs) {
      const data = requestedLimit ? cached.data.slice(-requestedLimit) : cached.data
      return res.status(200).json({ message: 'History fetched (cache)', symbol, interval, data })
    }

    // Cache miss — fetch from Yahoo Finance
    console.log(`[History] Fetching ${isIntraday ? 'intraday (60m)' : 'daily'} data for ${symbol} from Yahoo Finance`)

    const period2 = new Date()
    const period1 = new Date()
    period1.setDate(period1.getDate() - periodDays)

    let rawData = []
    try {
      if (isIntraday) {
        // hourly: chart() over the last 6 days
        const result = await yahooFinance.chart(symbol, { period1, interval })
        rawData = result?.quotes || []
      } else {
        // daily: chart() over the last 730 days (historical() maps here anyway)
        const result = await yahooFinance.chart(symbol, { period1, interval: '1d' })
        rawData = result?.quotes || []
      }
    } catch (err) {
      console.error(`[History] Yahoo Finance fetch failed for ${symbol}:`, err.message)
      // If cache exists (even stale), return it as fallback
      if (cached) {
        const data = requestedLimit ? cached.data.slice(-requestedLimit) : cached.data
        return res.status(200).json({ message: 'History fetched (stale cache fallback)', symbol, interval, data })
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
    await Model.findOneAndUpdate(
      { symbol },
      { symbol, data, updatedAt: new Date() },
      { upsert: true, new: true }
    )

    const limitData = requestedLimit ? data.slice(-requestedLimit) : data
    console.log(`[History] Cached ${data.length} candles for ${symbol} (${interval})`)
    return res.status(200).json({ message: 'History fetched (live)', symbol, interval, data: limitData })
  } catch (err) {
    next(err)
  }
})
