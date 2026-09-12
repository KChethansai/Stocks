import exp from 'express'
import { verifyToken } from '../middlewares/verifyToken.js'
import { priceAlertModel } from '../models/PriceAlertModel.js'

export const priceAlertApp = exp.Router()

priceAlertApp.use(verifyToken('USER'))

const isValidSymbol = (symbol) => /^[A-Z.]{1,10}$/.test(symbol || '')
const isObjectId = (value) => /^[a-fA-F0-9]{24}$/.test(value || '')

// GET /alert-api/alerts — active (untriggered) first, newest first
priceAlertApp.get('/alerts', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')

    const alerts = await priceAlertModel
      .find({ userId: req.user.id })
      .sort({ triggered: 1, createdAt: -1 })
      .limit(100)
      .lean()

    return res.status(200).json({ message: 'Price alerts fetched', alerts })
  } catch (err) {
    next(err)
  }
})

// POST /alert-api/alerts { symbol, targetPrice, direction }
priceAlertApp.post('/alerts', async (req, res, next) => {
  try {
    const symbol = String(req.body?.symbol || '').toUpperCase().trim()
    const targetPrice = Number(req.body?.targetPrice)
    const direction = String(req.body?.direction || '').toUpperCase().trim()

    if (!isValidSymbol(symbol)) {
      return res.status(400).json({ message: 'Invalid stock symbol' })
    }
    if (!Number.isFinite(targetPrice) || targetPrice < 0.01) {
      return res.status(400).json({ message: 'Target price must be at least $0.01' })
    }
    if (!['ABOVE', 'BELOW'].includes(direction)) {
      return res.status(400).json({ message: 'Direction must be ABOVE or BELOW' })
    }

    const alert = await priceAlertModel.create({
      userId: req.user.id,
      symbol,
      targetPrice: Number(targetPrice.toFixed(2)),
      direction
    })

    return res.status(201).json({ message: 'Price alert created', alert })
  } catch (err) {
    next(err)
  }
})

// DELETE /alert-api/alerts/:id
priceAlertApp.delete('/alerts/:id', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid alert id' })
    }

    const alert = await priceAlertModel
      .findOneAndDelete({ _id: req.params.id, userId: req.user.id })
      .lean()

    if (!alert) {
      return res.status(404).json({ message: 'Price alert not found' })
    }

    return res.status(200).json({ message: 'Price alert deleted' })
  } catch (err) {
    next(err)
  }
})
