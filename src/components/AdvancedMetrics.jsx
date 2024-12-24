import React from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { calculateMetrics, getMetricColor, getMetricLabel } from '../utils/tradingMetrics'

function AdvancedMetrics({ trades }) {
  const metrics = calculateMetrics(trades)
  if (!metrics) return null

  const monthlyData = Object.entries(metrics.monthlyMetrics).map(([month, data]) => ({
    month,
    profit: data.profit,
    sharpe: data.sharpe,
    winRate: (data.wins / data.trades) * 100
  }))

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-4 gap-4">
        {/* Sharpe Ratio */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Sharpe Ratio</h3>
            <span className="text-xs bg-gray-100 rounded-full px-2 py-1">
              {getMetricLabel('sharpeRatio', metrics.sharpeRatio)}
            </span>
          </div>
          <p className={`text-2xl font-bold mt-2 ${getMetricColor('sharpeRatio', metrics.sharpeRatio)}`}>
            {metrics.sharpeRatio.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Risk-adjusted return measure
          </p>
        </div>

        {/* Profit Factor */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Profit Factor</h3>
            <span className="text-xs bg-gray-100 rounded-full px-2 py-1">
              {getMetricLabel('profitFactor', metrics.profitFactor)}
            </span>
          </div>
          <p className={`text-2xl font-bold mt-2 ${getMetricColor('profitFactor', metrics.profitFactor)}`}>
            {metrics.profitFactor.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Gross profit / Gross loss
          </p>
        </div>

        {/* Expectancy */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Expectancy</h3>
            <span className="text-xs bg-gray-100 rounded-full px-2 py-1">
              {getMetricLabel('expectancy', metrics.expectancy)}
            </span>
          </div>
          <p className={`text-2xl font-bold mt-2 ${getMetricColor('expectancy', metrics.expectancy)}`}>
            ${metrics.expectancy.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Expected value per trade
          </p>
        </div>

        {/* Risk Consistency */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">Risk Consistency</h3>
            <span className="text-xs bg-gray-100 rounded-full px-2 py-1">
              {getMetricLabel('riskConsistency', metrics.riskConsistency)}
            </span>
          </div>
          <p className={`text-2xl font-bold mt-2 ${getMetricColor('riskConsistency', metrics.riskConsistency)}`}>
            {metrics.riskConsistency.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Trade size consistency score
          </p>
        </div>
      </div>

      {/* Monthly Performance Charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Monthly Profit and Sharpe */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium mb-4">Monthly Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                <Tooltip />
                <Bar yAxisId="left" dataKey="profit" fill="#8884d8" name="Profit" />
                <Bar yAxisId="right" dataKey="sharpe" fill="#82ca9d" name="Sharpe" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Metrics Over Time */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium mb-4">Risk Metrics Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="sharpe" stroke="#8884d8" name="Sharpe" />
                <Line type="monotone" dataKey="winRate" stroke="#82ca9d" name="Win Rate" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdvancedMetrics
