import exp from 'express'
import { verifyToken } from '../middlewares/verifyToken.js'
import { stockModel } from '../models/StockModel.js'
import { userModel } from '../models/UserModel.js'
import { portfolioModel } from '../models/PortfolioModel.js'
import { transactionModel } from '../models/TransactionModel.js'
import { orderModel } from '../models/OrderModel.js'
import { executePaperTrade } from '../services/tradeService.js'

export const tradeApp = exp.Router()

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

//get portfolio
tradeApp.get('/portfolio', async (req, res, next) => {
  try {
    //fetch portfolio and user
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
