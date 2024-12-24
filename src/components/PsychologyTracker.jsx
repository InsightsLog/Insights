import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function PsychologyTracker({ trades }) {
  // Analyze psychological patterns
  const psychData = trades.map((trade, index) => {
    const prevTrades = trades.slice(Math.max(0, index - 5), index)
    const recentLosses = prevTrades.filter(t => t.profit < 0).length
    const isOvertrading = prevTrades.length >= 3 && 
      prevTrades.every(t => new Date(t.date).toDateString() === new Date(trade.date).toDateString())
    
    return {
      ...trade,
      isRevengeTrade: recentLosses >= 2 && trade.confidence < 3,
      isOvertrading,
      isEmotional: trade.confidence > 4 && Math.abs(trade.profit) > 100,
    }
  })

  const emotionalPatterns = psychData.reduce((acc, trade) => {
    if (trade.isRevengeTrade) acc.revengeTrades++
    if (trade.isOvertrading) acc.overtrading++
    if (trade.isEmotional) acc.emotionalTrades++
    return acc
  }, { revengeTrades: 0, overtrading: 0, emotionalTrades: 0 })

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Psychology Analysis</h2>
      
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-red-800">Revenge Trades</h3>
          <p className="text-xl font-bold text-red-600 mt-1">
            {emotionalPatterns.revengeTrades}
          </p>
        </div>
        
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-yellow-800">Overtrading</h3>
          <p className="text-xl font-bold text-yellow-600 mt-1">
            {emotionalPatterns.overtrading}
          </p>
        </div>
        
        <div className="bg-orange-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-orange-800">Emotional Trades</h3>
          <p className="text-xl font-bold text-orange-600 mt-1">
            {emotionalPatterns.emotionalTrades}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">Confidence vs. Profit Correlation</h3>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trades}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="confidence" stroke="#8884d8" />
              <Line type="monotone" dataKey="profit" stroke="#82ca9d" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default PsychologyTracker
