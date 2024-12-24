import React from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function MarketCorrelation({ trades }) {
  // Group trades by symbol
  const symbolData = trades.reduce((acc, trade) => {
    if (!acc[trade.symbol]) {
      acc[trade.symbol] = {
        totalProfit: 0,
        trades: 0,
        winRate: 0,
        avgProfit: 0
      }
    }
    
    acc[trade.symbol].totalProfit += trade.profit
    acc[trade.symbol].trades++
    acc[trade.symbol].winRate = trades
      .filter(t => t.symbol === trade.symbol && t.profit > 0).length / 
      trades.filter(t => t.symbol === trade.symbol).length * 100
    acc[trade.symbol].avgProfit = acc[trade.symbol].totalProfit / acc[trade.symbol].trades
    
    return acc
  }, {})

  const correlationData = Object.entries(symbolData).map(([symbol, data]) => ({
    symbol,
    winRate: data.winRate,
    avgProfit: data.avgProfit,
    totalProfit: data.totalProfit,
    trades: data.trades
  }))

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Symbol Analysis</h2>
      
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Win Rate vs Average Profit</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="winRate" name="Win Rate" unit="%" />
                <YAxis type="number" dataKey="avgProfit" name="Avg Profit" unit="$" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={correlationData} fill="#8884d8" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700">Symbol Performance</h3>
          {correlationData
            .sort((a, b) => b.totalProfit - a.totalProfit)
            .map(data => (
              <div key={data.symbol} className="bg-gray-50 p-3 rounded">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{data.symbol}</span>
                  <span className={`font-medium ${
                    data.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ${data.totalProfit.toFixed(2)}
                  </span>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Win Rate: {data.winRate.toFixed(1)}% | Trades: {data.trades}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

export default MarketCorrelation
