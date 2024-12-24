import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function PatternDetector({ trades }) {
  // Analyze trading patterns
  const patterns = {
    timePatterns: trades.reduce((acc, trade) => {
      const hour = parseInt(trade.time.split(':')[0])
      if (!acc[hour]) acc[hour] = { wins: 0, losses: 0, profit: 0 }
      acc[hour].profit += trade.profit
      trade.profit > 0 ? acc[hour].wins++ : acc[hour].losses++
      return acc
    }, {}),

    setupEffectiveness: trades.reduce((acc, trade) => {
      if (!acc[trade.setup]) acc[trade.setup] = { wins: 0, losses: 0, profit: 0 }
      acc[trade.setup].profit += trade.profit
      trade.profit > 0 ? acc[trade.setup].wins++ : acc[trade.setup].losses++
      return acc
    }, {}),

    marketConditions: trades.reduce((acc, trade) => {
      if (!acc[trade.market]) acc[trade.market] = { wins: 0, losses: 0, profit: 0 }
      acc[trade.market].profit += trade.profit
      trade.profit > 0 ? acc[trade.market].wins++ : acc[trade.market].losses++
      return acc
    }, {})
  }

  // Identify best and worst conditions
  const bestSetup = Object.entries(patterns.setupEffectiveness)
    .sort((a, b) => b[1].profit - a[1].profit)[0]
  
  const bestTime = Object.entries(patterns.timePatterns)
    .sort((a, b) => b[1].profit - a[1].profit)[0]

  const bestMarket = Object.entries(patterns.marketConditions)
    .sort((a, b) => b[1].profit - a[1].profit)[0]

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Pattern Analysis</h2>
      
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-green-800">Best Setup</h3>
          <p className="text-xl font-bold text-green-600 mt-1">
            {bestSetup?.[0]} (${bestSetup?.[1].profit.toFixed(2)})
          </p>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800">Best Time</h3>
          <p className="text-xl font-bold text-blue-600 mt-1">
            {bestTime?.[0]}:00 (${bestTime?.[1].profit.toFixed(2)})
          </p>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-purple-800">Best Market</h3>
          <p className="text-xl font-bold text-purple-600 mt-1">
            {bestMarket?.[0]} (${bestMarket?.[1].profit.toFixed(2)})
          </p>
        </div>
      </div>

      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={Object.entries(patterns.timePatterns).map(([hour, data]) => ({
            hour: `${hour}:00`,
            profit: data.profit,
            winRate: (data.wins / (data.wins + data.losses)) * 100
          }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="profit" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default PatternDetector
