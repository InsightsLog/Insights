export const analyzePatterns = (trades) => {
  // Time-based patterns
  const timePatterns = trades.reduce((acc, trade) => {
    const hour = parseInt(trade.time.split(':')[0])
    if (!acc.hourlyPerformance[hour]) {
      acc.hourlyPerformance[hour] = { profit: 0, wins: 0, total: 0 }
    }
    acc.hourlyPerformance[hour].profit += trade.profit
    acc.hourlyPerformance[hour].total++
    if (trade.profit > 0) acc.hourlyPerformance[hour].wins++
    return acc
  }, { hourlyPerformance: {} })

  // Best and worst hours
  const bestHour = Object.entries(timePatterns.hourlyPerformance)
    .sort((a, b) => b[1].profit - a[1].profit)[0]
  const worstHour = Object.entries(timePatterns.hourlyPerformance)
    .sort((a, b) => a[1].profit - b[1].profit)[0]

  // Consecutive patterns
  const consecutivePatterns = trades.reduce((acc, trade, index, arr) => {
    if (index === 0) return acc
    const prevTrade = arr[index - 1]
    
    // Consecutive wins/losses
    if (trade.profit > 0 && prevTrade.profit > 0) acc.consecutiveWins++
    if (trade.profit < 0 && prevTrade.profit < 0) acc.consecutiveLosses++
    
    // Time between trades
    const timeDiff = new Date(trade.date + ' ' + trade.time) - 
                     new Date(prevTrade.date + ' ' + prevTrade.time)
    acc.avgTimeBetweenTrades.push(timeDiff / (1000 * 60)) // in minutes
    
    return acc
  }, { consecutiveWins: 0, consecutiveLosses: 0, avgTimeBetweenTrades: [] })

  // Market condition patterns
  const marketPatterns = trades.reduce((acc, trade) => {
    if (!acc[trade.market]) {
      acc[trade.market] = { profit: 0, wins: 0, total: 0 }
    }
    acc[trade.market].profit += trade.profit
    acc[trade.market].total++
    if (trade.profit > 0) acc[trade.market].wins++
    return acc
  }, {})

  return {
    bestHour,
    worstHour,
    consecutivePatterns,
    marketPatterns,
    timePatterns
  }
}

export const analyzePsychology = (trades) => {
  const psychPatterns = trades.reduce((acc, trade, index, arr) => {
    // Analyze last 5 trades for patterns
    const recentTrades = arr.slice(Math.max(0, index - 5), index)
    
    // Revenge trading detection
    const recentLosses = recentTrades.filter(t => t.profit < 0).length
    if (recentLosses >= 2 && trade.confidence > 3) {
      acc.revengeTrades.push(trade)
    }

    // Overtrading detection (too many trades in short period)
    const tradesInLastHour = recentTrades.filter(t => {
      const timeDiff = new Date(trade.date + ' ' + trade.time) - 
                       new Date(t.date + ' ' + t.time)
      return timeDiff <= 60 * 60 * 1000 // 1 hour
    }).length
    if (tradesInLastHour >= 3) {
      acc.overtrading.push(trade)
    }

    // FOMO detection (entering after big moves)
    if (recentTrades.some(t => Math.abs(t.profit) > 100) && trade.confidence < 3) {
      acc.fomoTrades.push(trade)
    }

    // Emotional trading (high confidence but poor setup)
    if (trade.confidence > 4 && !trade.setup) {
      acc.emotionalTrades.push(trade)
    }

    // Risk management issues
    const avgSize = arr.slice(0, index).reduce((sum, t) => sum + Math.abs(t.profit), 0) / index || 0
    if (Math.abs(trade.profit) > avgSize * 2) {
      acc.sizeIssues.push(trade)
    }

    return acc
  }, {
    revengeTrades: [],
    overtrading: [],
    fomoTrades: [],
    emotionalTrades: [],
    sizeIssues: []
  })

  return psychPatterns
}

export const generateInsights = (trades) => {
  const patterns = analyzePatterns(trades)
  const psychology = analyzePsychology(trades)
  
  const insights = []

  // Pattern-based insights
  if (patterns.bestHour) {
    insights.push({
      type: 'success',
      title: 'Optimal Trading Time',
      message: `You perform best during ${patterns.bestHour[0]}:00 with $${patterns.bestHour[1].profit.toFixed(2)} profit`
    })
  }

  if (patterns.consecutivePatterns.consecutiveLosses > 2) {
    insights.push({
      type: 'warning',
      title: 'Loss Streak Pattern',
      message: 'Consider taking a break after 2 consecutive losses'
    })
  }

  // Psychological insights
  if (psychology.revengeTrades.length > 0) {
    insights.push({
      type: 'danger',
      title: 'Revenge Trading Detected',
      message: 'You tend to overtrade after losses with high confidence'
    })
  }

  if (psychology.overtrading.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Overtrading Pattern',
      message: 'Multiple trades in short periods may indicate overtrading'
    })
  }

  // Market condition insights
  Object.entries(patterns.marketPatterns).forEach(([market, data]) => {
    const winRate = (data.wins / data.total) * 100
    if (winRate > 70) {
      insights.push({
        type: 'success',
        title: `Strong in ${market} Market`,
        message: `${winRate.toFixed(1)}% win rate in ${market} conditions`
      })
    }
  })

  return insights
}
