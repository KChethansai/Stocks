import exp from 'express'
import YahooFinance from 'yahoo-finance2'
import { verifyToken } from '../middlewares/verifyToken.js'
import { stockModel } from '../models/StockModel.js'
import { userModel } from '../models/UserModel.js'
import { portfolioModel } from '../models/PortfolioModel.js'
import { transactionModel } from '../models/TransactionModel.js'
import { orderModel } from '../models/OrderModel.js'
import { historyModel } from '../models/HistoryModel.js'
import { executePaperTrade } from '../services/tradeService.js'

export const tradeApp = exp.Router()

const RANGE_DAYS = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, ALL: 730 }
const MAX_POINTS = 240
const DAY_MS = 24 * 60 * 60 * 1000
const SPX_CACHE_TTL_MS = 24 * 60 * 60 * 1000

const rangeDays = (range) => {
  if (range === 'YTD') {
    const startOfYear = Date.UTC(new Date().getFullYear(), 0, 1)
    return Math.max(1, Math.floor((Date.now() - startOfYear) / DAY_MS))
  }
  return RANGE_DAYS[range] || null
}

// Realized-and-unrealized equity curve built from the actual transaction log,
// valued daily at real market closes. Never synthetic.
const buildEquityCurve = async (transactions, userBalance, days) => {
  const initialBalance = Number(userBalance ?? 100000)

  const events = transactions.map(t => ({
    day: new Date(t.createdAt).getTime(),
    symbol: t.symbol,
    delta: t.type === 'BUY'
      ? Number(t.quantity || 0)
      : t.type === 'SELL' ? -Number(t.quantity || 0) : 0,
    balanceAfter: Number(t.balanceAfter)
  }))

  const tradedSymbols = [...new Set(transactions
    .filter(t => t.symbol && ['BUY', 'SELL'].includes(t.type))
    .map(t => t.symbol))]

  // Close price for a symbol on/before a given day (carried forward on holidays)
  const series = new Map()
  if (tradedSymbols.length) {
    const histories = await historyModel.find({ symbol: { $in: tradedSymbols } }).lean()
    for (const h of histories) series.set(h.symbol, h.data || [])
  }
  const closeOnOrBefore = (symbol, dayMs) => {
    const data = series.get(symbol)
    if (!data || !data.length) return null
    let lo = 0
    let hi = data.length - 1
    let best = null
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const t = new Date(data[mid].timestamp).getTime()
      if (t <= dayMs) {
        best = data[mid]
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return best ? Number(best.close) : Number(data[0].close)
  }

  const startCash = events.length
    ? Number(transactions[0].balanceBefore ?? initialBalance)
    : initialBalance

  const endMs = new Date()
  endMs.setHours(0, 0, 0, 0)
  const startMs = endMs.getTime() - (days - 1) * DAY_MS

  const points = []
  let eventIndex = 0
  let cash = startCash
  const holdings = new Map()

  for (let dayMs = startMs; dayMs <= endMs.getTime(); dayMs += DAY_MS) {
    const dayEnd = dayMs + DAY_MS - 1
    while (eventIndex < events.length && events[eventIndex].day <= dayEnd) {
      const ev = events[eventIndex]
      if (ev.symbol) {
        holdings.set(ev.symbol, (holdings.get(ev.symbol) || 0) + ev.delta)
      }
      cash = ev.balanceAfter
      eventIndex++
    }

    let value = cash
    let holdingsCount = 0
    for (const [symbol, qty] of holdings) {
      if (qty <= 0) continue
      holdingsCount++
      const close = closeOnOrBefore(symbol, dayMs)
      if (close != null) value += qty * close
    }

    points.push({
      timestamp: dayMs,
      label: new Date(dayMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: Math.round(value * 100) / 100,
      pnl: Math.round((value - startCash) * 100) / 100,
      holdingsCount
    })
  }

  const stride = Math.max(1, Math.ceil(points.length / MAX_POINTS))
  return { points: points.filter((_, i) => i % stride === 0 || i === points.length - 1), startCash, startMs }
}

// ── S&P 500 benchmark return over the requested window (real, 24h-cached) ────
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

const fetchSPXSeries = async () => {
  const cached = await historyModel.findOne({ symbol: '^GSPC' }).lean()
  if (cached && Date.now() - new Date(cached.updatedAt).getTime() < SPX_CACHE_TTL_MS) {
    return cached.data
  }
  const period1 = new Date()
  period1.setDate(period1.getDate() - 400)
  const result = await yahooFinance.chart('^GSPC', { period1, interval: '1d' })
  const data = (result?.quotes || [])
    .filter(d => d.close)
    .map(d => ({ timestamp: new Date(d.date), close: Number(d.close) }))
    .sort((a, b) => a.timestamp - b.timestamp)
  await historyModel.findOneAndUpdate(
    { symbol: '^GSPC' },
    { symbol: '^GSPC', data, updatedAt: new Date() },
    { upsert: true, new: true }
  )
  return data
}

const benchmarkReturnFor = async (startMs) => {
  try {
    const series = await fetchSPXSeries()
    if (!series || !series.length) return null
    const i0 = series.findIndex(d => new Date(d.timestamp).getTime() >= startMs)
    const before = Number(series[i0 > 0 ? i0 - 1 : 0].close)
    const last = Number(series[series.length - 1].close)
    if (!before || !last) return null
    return Math.round(((last - before) / before) * 10000) / 100
  } catch {
    return null
  }
}

//protect all trade routes
tradeApp.use(verifyToken('USER'))

// buy stock
tradeApp.post('/buy', async (req, res, next) => {
  try {
    const result = await executePaperTrade({
      userId: req.user.id,
      symbol: req.body.symbol,
      quantity: req.body.quantity,
      side: 'BUY',
      source: 'MANUAL'
    })

    return res.status(200).json({
      message: 'Buy order executed',
      balance: result.balance,
      holdings: result.holdings,
      transaction: result.transaction
    })
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message })
    }
    next(err)
  }
})

// sell stock
tradeApp.post('/sell', async (req, res, next) => {
  try {
    const result = await executePaperTrade({
      userId: req.user.id,
      symbol: req.body.symbol,
      quantity: req.body.quantity,
      side: 'SELL',
      source: 'MANUAL'
    })

    return res.status(200).json({
      message: 'Sell order executed',
      balance: result.balance,
      holdings: result.holdings,
      transaction: result.transaction
    })
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message })
    }
    next(err)
  }
})

//get portfolio equity curve — real, computed from transactions + market closes
tradeApp.get('/performance', async (req, res, next) => {
  try {
    const days = rangeDays(String(req.query.range || '1M').toUpperCase())
    if (!days) {
      return res.status(400).json({ message: 'Unsupported range' })
    }

    const [transactions, user] = await Promise.all([
      transactionModel.find({ userId: req.user.id }).sort({ createdAt: 1 }).lean(),
      userModel.findById(req.user.id).select('balance').lean()
    ])

    const { points, startCash, startMs } = await buildEquityCurve(transactions, user?.balance, days)

    const startEquity = points.length ? points[0].value : Number(user?.balance ?? 100000)
    const endEquity = points.length ? points[points.length - 1].value : startEquity
    const totalPnl = Math.round((endEquity - startCash) * 100) / 100

    const [benchmarkReturn] = await Promise.all([
      benchmarkReturnFor(startMs).catch(() => null)
    ])

    return res.status(200).json({
      message: 'Performance fetched',
      range: String(req.query.range || '1M').toUpperCase(),
      data: points,
      meta: {
        startEquity,
        endEquity,
        totalPnl,
        returnPercent: startEquity > 0 ? Math.round(((endEquity - startEquity) / startEquity) * 10000) / 100 : 0,
        benchmarkReturn
      }
    })
  } catch (err) {
    next(err)
  }
})

//get portfolio
tradeApp.get('/portfolio', async (req, res, next) => {
  try {
    const portfolio = await portfolioModel.findOne({ userId: req.user.id }).lean()
    const user = await userModel
      .findById(req.user.id)
      .select('balance username email')
      .lean()
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    //handle empty portfolio
    if (!portfolio) {
      return res.status(200).json({
        message: 'Portfolio fetched',
        portfolio: {
          holdings: [],
          totalInvested: 0,
          currentValue: 0,
          unrealizedPnL: 0
        },
        user
      })
    }

    //fetch current stock prices
    const symbols = portfolio.holdings.map((item) => item.symbol)
    const stocks = await stockModel.find({ symbol: { $in: symbols } }).lean()
    const stockMap = new Map(stocks.map((item) => [item.symbol, item]))

    //calculate P&L per holding
    const holdings = portfolio.holdings.map((item) => {
      const stock = stockMap.get(item.symbol)
      const currentPrice = stock?.price ?? item.currentPrice
      const invested = Number((item.quantity * item.avgBuyPrice).toFixed(2))
      const currentValue = Number((item.quantity * currentPrice).toFixed(2))
      const pnl = Number((currentValue - invested).toFixed(2))
      const pnlPercent =
        invested > 0 ? Number(((pnl / invested) * 100).toFixed(2)) : 0

      return {
        symbol: item.symbol,
        name: item.name,
        quantity: item.quantity,
        avgBuyPrice: item.avgBuyPrice,
        currentPrice,
        invested,
        currentValue,
        pnl,
        pnlPercent
      }
    })

    //calculate portfolio totals
    const totalInvested = Number(
      holdings.reduce((sum, item) => sum + item.invested, 0).toFixed(2)
    )
    const currentValue = Number(
      holdings.reduce((sum, item) => sum + item.currentValue, 0).toFixed(2)
    )
    const unrealizedPnL = Number((currentValue - totalInvested).toFixed(2))

    return res.status(200).json({
      message: 'Portfolio fetched',
      portfolio: { holdings, totalInvested, currentValue, unrealizedPnL },
      user
    })
  } catch (err) {
    next(err)
  }
})

//get transactions
tradeApp.get('/transactions', async (req, res, next) => {
  try {
    //fetch transactions sorted by newest first
    const transactions = await transactionModel
      .find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
    return res
      .status(200)
      .json({ message: 'Transactions fetched', transactions })
  } catch (err) {
    next(err)
  }
})

//get order history
tradeApp.get('/orders', async (req, res, next) => {
  try {
    //fetch orders sorted by newest first
    const orders = await orderModel
      .find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
    return res.status(200).json({ message: 'Orders fetched', orders })
  } catch (err) {
    next(err)
  }
})
