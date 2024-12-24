export const calculateMetrics = (trades) => {
  if (!trades.length) return null

  // Basic calculations
  const profits = trades.map(t => t.profit)
  const winningTrades = trades.filter(t => t.profit > 0)
  const losingTrades = trades.filter(t => t.profit < 0)
  
  // Average profit and standard deviation
  const avgProfit = profits.reduce((sum, p) => sum + p, 0) / trades.length
  const variance = profits.reduce((sum, p) => sum + Math.pow(p - avgProfit, 2), 0) / trades.length
  const stdDev = Math.sqrt(variance)

  // Sharpe Ratio (assuming risk-free rate of 0% for simplicity)
  const sharpeRatio = stdDev !== 0 ? (avgProfit / stdDev) * Math.sqrt(252) : 0

  // Profit Factor
  const grossProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0)
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0))
  const profitFactor = grossLoss !== 0 ? grossProfit / grossLoss : grossProfit

  // Expectancy
  const winRate = winningTrades.length / trades.length
  const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0
  const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0
  const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss)

  // Risk Consistency Score
  const coefficientOfVariation = stdDev / Math.abs(avgProfit)
  const riskConsistency = Math.max(0, Math.min(100, 100 * (1 - coefficientOfVariation)))

  return {
    sharpeRatio,
    profitFactor,
    expectancy,
    riskConsistency,
    avgProfit,
    stdDev,
    winRate: winRate * 100,
    avgWin,
    avgLoss
  }
}

export const getMetricColor = (metric, value) => {
  switch (metric) {
    case 'sharpeRatio':
      return value >= 2 ? 'text-green-600' : value >= 1 ? 'text-yellow-600' : 'text-red-600'
    case 'profitFactor':
      return value >= 2 ? 'text-green-600' : value >= 1.5 ? 'text-yellow-600' : 'text-red-600'
    case 'expectancy':
      return value >= 1 ? 'text-green-600' : value >= 0 ? 'text-yellow-600' : 'text-red-600'
    case 'riskConsistency':
      return value >= 70 ? 'text-green-600' : value >= 50 ? 'text-yellow-600' : 'text-red-600'
    default:
      return 'text-gray-900'
  }
}

export const getMetricLabel = (metric, value) => {
  switch (metric) {
    case 'sharpeRatio':
      return value >= 2 ? 'Excellent' : value >= 1 ? 'Good' : 'Needs Improvement'
    case 'profitFactor':
      return value >= 2 ? 'Strong' : value >= 1.5 ? 'Good' : 'Weak'
    case 'expectancy':
      return value >= 1 ? 'Profitable' : value >= 0 ? 'Break Even' : 'Losing'
    case 'riskConsistency':
      return value >= 70 ? 'Consistent' : value >= 50 ? 'Moderate' : 'Inconsistent'
    default:
      return ''
  }
}
