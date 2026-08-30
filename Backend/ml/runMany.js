import { connect, disconnect } from 'mongoose'
import { env } from '../config/env.js'
import { stockModel } from '../models/StockModel.js'
import { predict } from './predictor.js'

// Demo utility: evaluates five horizons for every tracked symbol.
await connect(env.dbUrl, { family: 4 })
try {
  const symbols = (await stockModel.find().select('symbol').lean()).map((s) => s.symbol)
  let completed = 0
  for (const symbol of symbols) {
    for (const horizon of [1, 2, 3, 4, 5]) {
      const result = await predict(symbol, { horizon })
      if (result.ok) completed += 1
    }
  }
  console.log(`[ML] Completed ${completed} real predictions across ${symbols.length} symbols.`)
} finally {
  await disconnect()
}
