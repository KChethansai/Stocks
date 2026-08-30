import exp from 'express'
import { stockModel } from '../models/StockModel.js'

export const marketApp = exp.Router()

//get market summary
marketApp.get('/summary', async (req, res, next) => {
  try {
    //fetch stocks
    const stocks = await stockModel.find().lean()

    //calculate totals
    const totalMarketCap = stocks.reduce((sum, item) => sum + item.marketCap, 0)
    
    //sort top gainers
    const topGainers = [...stocks]
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 5)
      
    //sort top losers
    const topLosers = [...stocks]
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, 5)

    //return market summary
    return res.status(200).json({
      message: 'Market summary fetched',
      summary: {
        totalMarketCap,
        topGainers,
        topLosers
      }
    })
  } catch (err) {
    next(err)
  }
})
