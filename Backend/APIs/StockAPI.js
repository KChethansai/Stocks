import exp from 'express'
import YahooFinance from 'yahoo-finance2'
import { verifyToken } from '../middlewares/verifyToken.js'
import { stockModel } from '../models/StockModel.js'
import { historyModel, intradayHistoryModel } from '../models/HistoryModel.js'
import { checkPriceTriggers } from '../services/priceMonitor.js'
import { cached, invalidateCache } from '../config/cache.js'
import { baseStocks, toProviderTime } from '../config/universe.js'
import { buildVerifiedQuoteRow, refreshAllowed, rememberRefresh, fetchQuoteWithRetry } from '../services/quoteRefresh.js'
import { withProviderBudget } from '../services/providerBudget.js'
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

// Closed-market cadence. A closed session's data cannot change until the next
// session opens: the provider keeps returning the same last close. Polling it
// every 60 seconds all weekend burns provider budget for zero information and
// is what turned one provider rejection into an 18-hour outage. Outside a
// regular session the last close is still bound by
// MAX_CLOSED_QUOTE_AGE_MS and remains usable, so a slow cadence is safe.
const CLOSED_SYNC_INTERVAL_MS = 15 * 60 * 1000

// Chooses the cadence from what the provider last reported. Unknown state
// uses the slow cadence: we should not assume the market is open and spend
// provider budget proving it.
export function nextSyncDelayMs(marketState) {
  return marketState === 'REGULAR' ? SYNC_INTERVAL_MS : CLOSED_SYNC_INTERVAL_MS
}

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
      // A refresh for this symbol already ran inside the throttle window, so
      // the stored row is already the newest verified data. Returning 429 here
      // reported "rate limited" for a request that never needed to be made,
      // which read as an outage. Serve the verified row instead.
      const fresh = await stockModel.findOne({ symbol }).lean()
      if (fresh && isExecutableQuote(fresh, symbol)) {
        return res.status(200).json({
          message: `Quote for ${symbol} was verified moments ago — showing that verified quote.`,
          refreshed: true,
          cachedWithinThrottle: true,
          stock: { ...fresh, stale: false },
          meta: { asOf: new Date(fresh.providerTime).toISOString(), source: 'yahoo' }
        })
      }
      return res.status(429).json({
        message:
          'A refresh for this symbol just ran. You can submit the order directly — it verifies the quote automatically.',
        retryAfterMs: allowed.retryAfterMs,
        symbol
      })
    }
    rememberRefresh(throttleKey)

    // Shared provider budget: an open circuit makes no provider call at all.
    const budget = await withProviderBudget(() => fetchQuoteWithRetry(symbol, () => yahooFinance.quote(symbol)), Date.now())

    let quotes
    if (budget.ok) {
      quotes = budget.value
    } else {
      const limited = budget.reason === 'rate-limited'
      const cooling = budget.reason === 'circuit-open'
      console.error(`[Quote Refresh] ${symbol} provider path unavailable:`, budget.reason, budget.error?.message || '')
      // Even when the provider is unreachable, a genuinely valid stored quote
      // is still a truthful answer. Say what happened and hand it back.
      const stored = await stockModel.findOne({ symbol }).lean()
      const usable = stored && isExecutableQuote(stored, symbol)
      if (usable) {
        return res.status(200).json({
          message: cooling
            ? `The data provider is cooling down after repeated failures. Showing ${symbol}'s last verified close.`
            : limited
              ? `The data provider is rate-limiting requests. Showing ${symbol}'s last verified close.`
              : `Live market data is unavailable right now. Showing ${symbol}'s last verified close.`,
          refreshed: false,
          degraded: true,
          stock: { ...stored, stale: false },
          meta: { asOf: new Date(stored.providerTime).toISOString(), source: 'yahoo' }
        })
      }
      return res.status(cooling ? 503 : limited ? 429 : 502).json({
        message: cooling
          ? 'The data provider is cooling down after repeated failures, and no verified quote is stored for this symbol. Retry shortly.'
          : limited
            ? 'The data provider is rate-limiting requests right now, and no verified quote is stored for this symbol. Retry shortly.'
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

    // Shared provider budget. The Oct 2026 incident was an unbounded retry
    // loop: ~1440 failed calls/day against a provider that was rejecting us,
    // which kept quotes 18h stale and kept the rejection going. An open
    // circuit makes NO provider call at all and preserves the stored rows.
    const budget = await withProviderBudget(async () => {
      console.log('[Yahoo Finance] Yahoo request started for symbols:', symbols)
      const fetched = await yahooFinance.quote(symbols)
      console.log('[Yahoo Finance] Yahoo request succeeded')
      return fetched
    }, now)

    let quotes = []
    let isFallback = false
    if (budget.ok) {
      quotes = budget.value
    } else {
      isFallback = true
      if (budget.reason === 'circuit-open') {
        console.warn(
          `[Background Sync] Provider circuit open until ${new Date(budget.retryAt).toISOString()}; skipping provider call entirely.`
        )
      } else {
        console.error('[Yahoo Finance] Yahoo request failed:', budget.error?.message)
      }
    }

    let stocks = []
    let quoteSource = 'yahoo'
    let quotesAsOf = new Date()

    if (isFallback) {
      // Phase 0 correctness: NEVER synthesize prices into ordinary stock
      // records. Preserve every stored quote exactly as verified.
      //
      // The old behaviour stamped `stale: true` on every row whenever the
      // provider was unreachable. That conflated two unrelated facts: "I
      // cannot reach the provider right now" and "this data is no longer
      // valid". On a weekend it made Friday's genuine close fail the
      // execution gate and showed a red stale banner, so orders were
      // rejected against perfectly valid data.
      //
      // `stale` now means exactly "not valid for its own session" —
      // computed with the same gate that guards execution. A bounded last
      // close stays usable; a row with no session state still fails closed.
      // The outage is recorded separately so the UI can say so honestly.
      console.warn('[Background Sync] Yahoo Finance unavailable. Preserving stored quotes untouched.')
      const existingStocks = await stockModel.find().lean()
      if (existingStocks.length > 0) {
        const at = new Date(now)
        const ops = existingStocks.map((row) => ({
          updateOne: {
            filter: { symbol: row.symbol },
            update: {
              $set: {
                stale: !isExecutableQuote({ ...row, source: row.source || 'yahoo' }, row.symbol, now),
                providerUnavailableAt: at
              }
            }
          }
        }))
        await stockModel.bulkWrite(ops)
        lastSyncTime = now
        invalidateCache('stocks-list')
        invalidateCache('market-summary')
        const stillValid = ops.filter((o) => !o.updateOne.update.$set.stale).length
        console.log(
          `[Background Sync] Provider unreachable. ${existingStocks.length} quotes preserved (${stillValid} still valid for their session); no price touched.`
        )
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
      // What the provider actually reported, used only to pick a sync
      // cadence. Never used to decide whether data is trustworthy.
      lastMarketState = stocks.find((s) => s.marketState)?.marketState ?? null

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
// Self-rescheduling instead of a fixed interval, so the cadence can follow the
// market: 60s while a regular session is open, 15 minutes while closed.
// `lastMarketState` is set by the sync from what the provider actually
// reported — never assumed, never invented. Declared before the first sync
// runs so the initial call cannot hit the temporal dead zone.
let lastMarketState = null

syncStocksData(true)

async function scheduleSync() {
  await syncStocksData()
  setTimeout(scheduleSync, nextSyncDelayMs(lastMarketState))
}

setTimeout(scheduleSync, SYNC_INTERVAL_MS)

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

    // "The provider is unreachable" and "this data is not usable" are
    // different facts with different remedies, so the UI is told both.
    const providerDownAt = withProvenance
      .map((s) => (s.providerUnavailableAt ? new Date(s.providerUnavailableAt).getTime() : 0))
      .reduce((a, b) => Math.max(a, b), 0)

    return res.status(200).json({
      message: 'Stocks fetched',
      stocks: withProvenance,
      meta: {
        source: withProvenance.every((s) => s.source === 'yahoo' && !s.stale) ? 'yahoo' : 'mixed',
        asOf: verifiedAt ? new Date(verifiedAt).toISOString() : null,
        stale: withProvenance.some((s) => s.stale),
        usableCount: withProvenance.filter((s) => !s.stale).length,
        totalCount: withProvenance.length,
        providerUnavailableAt: providerDownAt ? new Date(providerDownAt).toISOString() : null
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
