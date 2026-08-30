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

const calculateRealizedPnL = (transactions = []) => {
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
    stockAllocation,
    sectorAllocation,
    assetAllocation: [
      { label: 'Equity', value: currentValue, percent: portfolioValue > 0 ? (currentValue / portfolioValue) * 100 : 0 },
      { label: 'Cash', value: cashBalance, percent: portfolioValue > 0 ? (cashBalance / portfolioValue) * 100 : 100 }
    ]
  }
}

