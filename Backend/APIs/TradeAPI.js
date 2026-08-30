import exp from 'express'
import { startSession } from 'mongoose'
import { verifyToken } from '../middlewares/verifyToken.js'
import { stockModel } from '../models/StockModel.js'
import { userModel } from '../models/UserModel.js'
import { portfolioModel } from '../models/PortfolioModel.js'
import { transactionModel } from '../models/TransactionModel.js'
import { orderModel } from '../models/OrderModel.js'

export const tradeApp = exp.Router()

//protect all trade routes
tradeApp.use(verifyToken('USER'))

// Helper for quantity & inputs
const getTradeInput = (body) => ({
  symbol: typeof body.symbol === 'string' ? body.symbol.toUpperCase().trim() : '',
  quantity: Number.parseInt(body.quantity, 10)
})

const validateTradeInput = (symbol, quantity) => {
  return /^[A-Z.]{1,10}$/.test(symbol || '') && Number.isInteger(quantity) && quantity >= 1 && quantity <= 100000
}

// Resilient transaction executor (works seamlessly on Atlas replica sets and standalone dev MongoDB)
const executeWithTransactionFallback = async (workFn) => {
  let session = null
  try {
    session = await startSession()
    let result
    await session.withTransaction(async () => {
      result = await workFn(session)
    })
    return result
  } catch (err) {
    if (
      err.message?.includes('replica set') ||
      err.message?.includes('Transaction numbers') ||
      err.code === 20 ||
      err.codeName === 'IllegalOperation'
    ) {
      return await workFn(null)
    }
    throw err
  } finally {
    if (session) {
      session.endSession()
    }
  }
}

// buy stock
tradeApp.post('/buy', async (req, res, next) => {
  try {
    const { symbol, quantity } = getTradeInput(req.body)

    if (!validateTradeInput(symbol, quantity)) {
      return res.status(400).json({ message: 'Invalid symbol or quantity' })
    }

    const stock = await stockModel.findOne({ symbol }).lean()
    if (!stock) {
      return res.status(404).json({ message: 'Stock not found' })
    }

    const total = Number((stock.price * quantity).toFixed(2))

    const result = await executeWithTransactionFallback(async (session) => {
      const sessionOpt = session ? { session } : {}
      const user = await userModel.findById(req.user.id).session(session || null)
      const existingPortfolio = await portfolioModel.findOne({ userId: req.user.id }).session(session || null)

      if (!user) {
        const error = new Error('User not found')
        error.statusCode = 404
        throw error
      }

      const balanceBefore = user.balance
      if (balanceBefore < total) {
        const error = new Error('Insufficient balance')
        error.statusCode = 400
        throw error
      }

      // Deduct balance
      user.balance = Number((balanceBefore - total).toFixed(2))

      // Resolve portfolio (create if missing)
      const portfolio =
        existingPortfolio ||
        (await portfolioModel.create([{ userId: user._id, holdings: [] }], sessionOpt))[0]

      // Update portfolio holdings
      const holding = portfolio.holdings.find((item) => item.symbol === symbol)
      if (holding) {
        const newQuantity = holding.quantity + quantity
        const weightedAvg =
          (holding.avgBuyPrice * holding.quantity + stock.price * quantity) /
          newQuantity
        holding.quantity = newQuantity
        holding.avgBuyPrice = Number(weightedAvg.toFixed(2))
        holding.currentPrice = stock.price
      } else {
        portfolio.holdings.push({
          symbol: stock.symbol,
          name: stock.name,
          quantity,
          avgBuyPrice: stock.price,
          currentPrice: stock.price
        })
      }

      await user.save(sessionOpt)
      await portfolio.save(sessionOpt)

      await orderModel.create(
        [
          {
            userId: user._id,
            symbol: stock.symbol,
            type: 'BUY',
            quantity,
            price: stock.price,
            total,
            status: 'COMPLETED'
          }
        ],
        sessionOpt
      )

      const createdTxs = await transactionModel.create(
        [
          {
            userId: user._id,
            type: 'BUY',
            symbol: stock.symbol,
            quantity,
            price: stock.price,
            total,
            balanceBefore,
            balanceAfter: user.balance
          }
        ],
        sessionOpt
      )

      return {
        balance: user.balance,
        holdings: portfolio.holdings,
        transaction: createdTxs[0]
      }
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
    const { symbol, quantity } = getTradeInput(req.body)

    if (!validateTradeInput(symbol, quantity)) {
      return res.status(400).json({ message: 'Invalid symbol or quantity' })
    }

    const stock = await stockModel.findOne({ symbol }).lean()
    if (!stock) {
      return res.status(404).json({ message: 'Stock not found' })
    }

    const total = Number((stock.price * quantity).toFixed(2))

    const result = await executeWithTransactionFallback(async (session) => {
      const sessionOpt = session ? { session } : {}
      const user = await userModel.findById(req.user.id).session(session || null)
      const portfolio = await portfolioModel.findOne({ userId: req.user.id }).session(session || null)

      if (!user) {
        const error = new Error('User not found')
        error.statusCode = 404
        throw error
      }
      if (!portfolio) {
        const error = new Error('Portfolio not found')
        error.statusCode = 400
        throw error
      }

      const holdingIndex = portfolio.holdings.findIndex(
        (item) => item.symbol === symbol
      )
      if (holdingIndex === -1) {
        const error = new Error('No holdings found for this stock')
        error.statusCode = 400
        throw error
      }

      const holding = portfolio.holdings[holdingIndex]
      if (holding.quantity < quantity) {
        const error = new Error('Insufficient quantity to sell')
        error.statusCode = 400
        throw error
      }

      const balanceBefore = user.balance
      user.balance = Number((balanceBefore + total).toFixed(2))

      holding.quantity -= quantity
      holding.currentPrice = stock.price
      if (holding.quantity === 0) {
        portfolio.holdings.splice(holdingIndex, 1)
      }

      await user.save(sessionOpt)
      await portfolio.save(sessionOpt)

      await orderModel.create(
        [
          {
            userId: user._id,
            symbol: stock.symbol,
            type: 'SELL',
            quantity,
            price: stock.price,
            total,
            status: 'COMPLETED'
          }
        ],
        sessionOpt
      )

      const createdTxs = await transactionModel.create(
        [
          {
            userId: user._id,
            type: 'SELL',
            symbol: stock.symbol,
            quantity,
            price: stock.price,
            total,
            balanceBefore,
            balanceAfter: user.balance
          }
        ],
        sessionOpt
      )

      return {
        balance: user.balance,
        holdings: portfolio.holdings,
        transaction: createdTxs[0]
      }
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
