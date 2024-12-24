import React from 'react'

function RiskManagement({ trades, accountSize = 100000 }) {
  // Calculate risk metrics
  const calculateRisk = () => {
    const lastTrades = trades.slice(-30) // Last 30 trades
    const avgPositionSize = trades.reduce((sum, t) => sum + (t.entry * t.quantity), 0) / trades.length
    const largestLoss = Math.min(...trades.map(t => t.profit))
    const avgRiskPerTrade = Math.abs(trades.reduce((sum, t) => sum + (t.profit < 0 ? t.profit : 0), 0) / trades.filter(t => t.profit < 0).length)
    
    return {
      avgPositionSize,
      avgRiskPerTrade,
      largestLoss,
      riskPercentage: (avgRiskPerTrade / accountSize) * 100,
      suggestedPositionSize: accountSize * 0.02, // 2% risk rule
      maxDailyLoss: accountSize * 0.06 // 6% max daily loss
    }
  }

  const riskMetrics = calculateRisk()

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Risk Management</h2>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Position Sizing</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-500">Average Position Size</label>
              <p className="text-lg font-semibold">${riskMetrics.avgPositionSize.toFixed(2)}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Suggested Position Size (2% Rule)</label>
              <p className="text-lg font-semibold">${riskMetrics.suggestedPositionSize.toFixed(2)}</p>
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Risk Limits</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-500">Average Risk per Trade</label>
              <p className="text-lg font-semibold">${riskMetrics.avgRiskPerTrade.toFixed(2)}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Max Daily Loss Limit</label>
              <p className="text-lg font-semibold text-red-600">${riskMetrics.maxDailyLoss.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RiskManagement
