import React from 'react'

function PerformanceGoals({ trades }) {
  // Calculate current month's performance
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const monthlyTrades = trades.filter(trade => {
    const tradeDate = new Date(trade.date)
    return tradeDate.getMonth() === currentMonth && tradeDate.getFullYear() === currentYear
  })

  const monthlyProfit = monthlyTrades.reduce((sum, trade) => sum + trade.profit, 0)
  const monthlyWinRate = (monthlyTrades.filter(t => t.profit > 0).length / monthlyTrades.length * 100) || 0

  // Example goals
  const goals = {
    monthly: {
      profit: 5000,
      winRate: 60,
      tradesPerDay: 5
    }
  }

  // Calculate progress
  const profitProgress = (monthlyProfit / goals.monthly.profit) * 100
  const winRateProgress = (monthlyWinRate / goals.monthly.winRate) * 100

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Monthly Goals</h2>
      
      <div className="space-y-6">
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Profit Goal</span>
            <span className="text-sm text-gray-500">
              ${monthlyProfit.toFixed(2)} / ${goals.monthly.profit}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${profitProgress >= 100 ? 'bg-green-600' : 'bg-blue-600'}`}
              style={{ width: `${Math.min(profitProgress, 100)}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Win Rate Goal</span>
            <span className="text-sm text-gray-500">
              {monthlyWinRate.toFixed(1)}% / {goals.monthly.winRate}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${winRateProgress >= 100 ? 'bg-green-600' : 'bg-blue-600'}`}
              style={{ width: `${Math.min(winRateProgress, 100)}%` }}
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Trading Rules</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center">
              <span className="w-2 h-2 bg-gray-400 rounded-full mr-2" />
              Maximum {goals.monthly.tradesPerDay} trades per day
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-gray-400 rounded-full mr-2" />
              No revenge trading
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-gray-400 rounded-full mr-2" />
              Stick to risk management rules
            </li>
            <li className="flex items-center">
              <span className="w-2 h-2 bg-gray-400 rounded-full mr-2" />
              Review trades daily
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default PerformanceGoals
