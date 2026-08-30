const RANGE_LIMITS = {
  '1D': 24,
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  ALL: 999
}

const RANGE_PROFILES = {
  '1D': {
    points: 48,
    volatility: 0.009,
    driftWeight: 0.22,
    cycles: [3.7, 9.4, 17.2],
    phases: [0.05, -0.03, 0.04, -0.015]
  },
  '1W': {
    points: 7,
    volatility: 0.014,
    driftWeight: 0.35,
    cycles: [1.8, 3.5, 6.2],
    phases: [0.01, -0.012, 0.018]
  },
  '1M': {
    points: 30,
    volatility: 0.012,
    driftWeight: 0.52,
    cycles: [2.9, 7.5, 14.5],
    phases: [0.035, -0.018, 0.045, -0.012]
  },
  '3M': {
    points: 64,
    volatility: 0.01,
    driftWeight: 0.68,
    cycles: [4.1, 13.5, 28],
    phases: [0.05, -0.04, 0.065, 0.018]
  },
  '6M': {
    points: 84,
    volatility: 0.008,
    driftWeight: 0.86,
    cycles: [5.3, 22, 48],
    phases: [-0.025, 0.075, -0.045, 0.09, 0.02]
  },
  '1Y': {
    points: 104,
    volatility: 0.007,
    driftWeight: 1.05,
    cycles: [6.5, 31, 68],
    phases: [0.055, -0.06, 0.095, -0.035, 0.08]
  },
  ALL: {
    points: 128,
    volatility: 0.006,
    driftWeight: 1.28,
    cycles: [7.8, 42, 92],
    phases: [-0.08, 0.12, -0.07, 0.16, -0.045, 0.11]
  }
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

export const formatCurrency = (value, digits = 2) => {
  const number = Number(value || 0)
  const sign = number < 0 ? '-' : ''
  return `${sign}$${Math.abs(number).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}`
}

export const formatCompact = (value) => {
  const number = Number(value || 0)
  if (Math.abs(number) >= 1e12) return `$${(number / 1e12).toFixed(2)}T`
  if (Math.abs(number) >= 1e9) return `$${(number / 1e9).toFixed(2)}B`
  if (Math.abs(number) >= 1e6) return `$${(number / 1e6).toFixed(2)}M`
  return formatCurrency(number, 0)
}

export const formatNumber = (value) =>
  Number(value || 0).toLocaleString('en-US')

export const getStockSeed = (symbol = 'SIM') =>
  symbol.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)

const getRangeProfile = (range = '1M') => RANGE_PROFILES[range] || RANGE_PROFILES['1M']

const getRangeLabel = (range, index, total) => {
  if (range === '1D') {
    const minutes = 9 * 60 + 30 + Math.round((index / Math.max(1, total - 1)) * 390)
    const hour = Math.floor(minutes / 60)
    const minute = String(minutes % 60).padStart(2, '0')
    return `${hour}:${minute}`
  }

  const daysBack = Math.max(0, Math.round((1 - index / Math.max(1, total - 1)) * (RANGE_LIMITS[range] || total)))
  const date = new Date()
  date.setDate(date.getDate() - daysBack)

  if (range === '1Y' || range === 'ALL') {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const getPhaseDrift = (phases, progress) => {
  const phaseIndex = Math.min(phases.length - 1, Math.floor(progress * phases.length))
  const phaseStart = phaseIndex / phases.length
  const phaseEnd = (phaseIndex + 1) / phases.length
  const phaseProgress = (progress - phaseStart) / Math.max(0.0001, phaseEnd - phaseStart)
  const previous = phases[Math.max(0, phaseIndex - 1)]
  const current = phases[phaseIndex]
  return previous + (current - previous) * phaseProgress
}

const createRangeCurve = ({ seed, startValue, endValue, range, changePercent = 0, points }) => {
  const profile = getRangeProfile(range)
  const totalPoints = points || profile.points
  const targetChange = clamp(Number(changePercent || 0) / 100, -0.75, 0.75)
  const safeStart = Math.max(0.01, Number(startValue || endValue || 100))
  const safeEnd = Math.max(0.01, Number(endValue || startValue || 100))
  const trendStart = (safeStart + safeEnd / Math.max(0.15, 1 + targetChange * profile.driftWeight)) / 2

  return Array.from({ length: totalPoints }, (_, index) => {
    const progress = totalPoints > 1 ? index / (totalPoints - 1) : 1
    const baseline = trendStart + (safeEnd - trendStart) * progress
    const phaseDrift = getPhaseDrift(profile.phases, progress)
    const cycleOne = Math.sin((progress * Math.PI * profile.cycles[0]) + seed * 0.031) * profile.volatility
    const cycleTwo = Math.cos((progress * Math.PI * profile.cycles[1]) + seed * 0.017) * profile.volatility * 0.58
    const cycleThree = Math.sin((progress * Math.PI * profile.cycles[2]) + seed * 0.011) * profile.volatility * 0.32
    const eventShock =
      Math.exp(-Math.pow(progress - 0.34, 2) / 0.004) * profile.volatility * (seed % 2 === 0 ? -2.1 : 1.55) +
      Math.exp(-Math.pow(progress - 0.72, 2) / 0.007) * profile.volatility * (seed % 3 === 0 ? 1.8 : -1.25)
    const value = baseline * (1 + phaseDrift + cycleOne + cycleTwo + cycleThree + eventShock)

    return {
      label: getRangeLabel(range, index, totalPoints),
      value: Number(Math.max(0, value).toFixed(2))
    }
  }).map((point, index, items) => {
    if (index !== items.length - 1) return point
    return { ...point, value: Number(safeEnd.toFixed(2)) }
  })
}

export const createSparkline = (stockOrPrice, changeOrPoints = 18, maybePoints = 18) => {
  let price = 100
  let change = 0
  let seed = 42
  let points = 18

  if (typeof stockOrPrice === 'object' && stockOrPrice !== null) {
    seed = getStockSeed(stockOrPrice.symbol)
    price = Number(stockOrPrice.price || stockOrPrice.currentPrice || 100)
    change = Number(stockOrPrice.changePercent || 0)
    points = typeof changeOrPoints === 'number' ? changeOrPoints : 18
  } else {
    price = Number(stockOrPrice || 100)
    change = typeof changeOrPoints === 'number' ? changeOrPoints : 0
    points = typeof maybePoints === 'number' ? maybePoints : 18
    seed = Math.abs(Math.round(price * 10)) % 100
  }

  const drift = clamp(change / 100, -0.12, 0.12)

  return Array.from({ length: points }, (_, index) => {
    const wave =
      Math.sin((index + seed) * 0.72) * 0.018 +
      Math.cos((index + seed) * 0.31) * 0.011
    const progress = points > 1 ? index / (points - 1) : 1
    const value = price * (1 - drift + drift * progress + wave)
    return {
      label: `${index + 1}`,
      value: Number(value.toFixed(2))
    }
  })
}

export const createStockHistory = (stock, range = '1M') => {
  const seed = getStockSeed(stock?.symbol)
  const price = Number(stock?.price || stock?.currentPrice || 100)
  const changePercent = Number(stock?.changePercent || 0)

  return createRangeCurve({
    seed,
    startValue: price,
    endValue: price,
    range,
    changePercent
  })
}

export const createPositionHistory = (holding, transactions = [], range = '1M') => {
  if (!holding) return []

  const stockCurve = createStockHistory(
    {
      symbol: holding.symbol,
      price: holding.currentPrice,
      changePercent: holding.pnlPercent
    },
    range
  )

  const buyTotal = transactions
    .filter((item) => item.symbol === holding.symbol && item.type === 'BUY')
    .reduce((sum, item) => sum + Number(item.total || 0), 0)
  const sellTotal = transactions
    .filter((item) => item.symbol === holding.symbol && item.type === 'SELL')
    .reduce((sum, item) => sum + Number(item.total || 0), 0)
  const realizedPnL = Number(
    (sellTotal - (holding.avgBuyPrice || 0) * Math.max(0, sellTotal / (holding.currentPrice || 1))).toFixed(2)
  )

  return stockCurve.map((point) => {
    const marketValue = Number((point.value * holding.quantity).toFixed(2))
    const unrealized = Number((marketValue - holding.invested).toFixed(2))
    return {
      label: point.label,
      price: point.value,
      value: marketValue,
      pnl: Number((unrealized + realizedPnL).toFixed(2)),
      investment: holding.invested || buyTotal
    }
  })
}

export const createPortfolioHistory = (portfolio, transactions = [], range = '1M') => {
  const holdings = portfolio?.holdings || []
  const baseValue = Number(portfolio?.currentValue || 0)
  const invested = Number(portfolio?.totalInvested || 0)
  const totalChange = invested > 0 ? (baseValue - invested) / invested : 0
  const seed = holdings.reduce((sum, holding) => sum + getStockSeed(holding.symbol), transactions.length * 19)

  return createRangeCurve({
    seed,
    startValue: invested || baseValue || 1000,
    endValue: baseValue || invested || 1000,
    range,
    changePercent: totalChange * 100
  }).map((point) => {
    return {
      label: point.label,
      value: point.value,
      pnl: Number((point.value - invested).toFixed(2)),
      exposure: holdings.length
    }
  })
}

export const calculateRealizedPnL = (transactions = []) => {
  const lots = new Map()
  let realized = 0

  ;[...transactions]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach((item) => {
      if (!item.symbol || !['BUY', 'SELL'].includes(item.type)) return
      const queue = lots.get(item.symbol) || []
      if (item.type === 'BUY') {
        queue.push({ quantity: Number(item.quantity || 0), price: Number(item.price || 0) })
      } else {
        let remaining = Number(item.quantity || 0)
        const sellPrice = Number(item.price || 0)
        while (remaining > 0 && queue.length > 0) {
          const lot = queue[0]
          const matched = Math.min(remaining, lot.quantity)
          realized += (sellPrice - lot.price) * matched
          lot.quantity -= matched
          remaining -= matched
          if (lot.quantity <= 0) queue.shift()
        }
      }
      lots.set(item.symbol, queue)
    })

  return Number(realized.toFixed(2))
}

export const summarizePortfolio = (portfolio, transactions = [], stocks = []) => {
  const holdings = portfolio?.holdings || []
  const currentValue = Number(portfolio?.currentValue || 0)
  const totalInvested = Number(portfolio?.totalInvested || 0)
  const realizedPnL = calculateRealizedPnL(transactions)
  const unrealizedPnL = Number(portfolio?.unrealizedPnL || 0)
  const totalPnL = Number((realizedPnL + unrealizedPnL).toFixed(2))
  const todayPnL = holdings.reduce((sum, holding) => {
    const stock = stocks.find((item) => item.symbol === holding.symbol)
    return sum + Number(stock?.change || 0) * Number(holding.quantity || 0)
  }, 0)

  const cashBalance = Number(portfolio?.user?.balance ?? 100000)
  const portfolioValue = Number((currentValue + cashBalance).toFixed(2))
  const totalPnLPercent = totalInvested > 0 ? Number(((totalPnL / totalInvested) * 100).toFixed(2)) : 0

  const stockAllocation = holdings.map((holding) => ({
    label: holding.symbol,
    value: holding.currentValue || 0,
    percent: currentValue > 0 ? ((holding.currentValue || 0) / currentValue) * 100 : 0
  }))

  const sectorMap = new Map()
  holdings.forEach((holding) => {
    const sector = stocks.find((item) => item.symbol === holding.symbol)?.sector || 'Unclassified'
    sectorMap.set(sector, (sectorMap.get(sector) || 0) + Number(holding.currentValue || 0))
  })

  const sectorAllocation = [...sectorMap.entries()].map(([label, value]) => ({
    label,
    value,
    percent: currentValue > 0 ? (value / currentValue) * 100 : 0
  }))

  return {
    currentValue,
    totalInvested,
    investedAmount: totalInvested,
    portfolioValue,
    cashBalance,
    realizedPnL,
    unrealizedPnL,
    totalPnL,
    totalPnLPercent,
    returnPercent: totalPnLPercent,
    todayPnL: Number(todayPnL.toFixed(2)),
    dailyReturn: totalInvested > 0 ? (todayPnL / totalInvested) * 100 : 0,
    weeklyReturn: totalInvested > 0 ? ((unrealizedPnL * 0.38) / totalInvested) * 100 : 0,
    monthlyReturn: totalInvested > 0 ? ((unrealizedPnL * 0.72) / totalInvested) * 100 : 0,
    stockAllocation,
    sectorAllocation,
    assetAllocation: [
      { label: 'Equity', value: currentValue, percent: portfolioValue > 0 ? (currentValue / portfolioValue) * 100 : 0 },
      { label: 'Cash', value: cashBalance, percent: portfolioValue > 0 ? (cashBalance / portfolioValue) * 100 : 100 }
    ]
  }
}

