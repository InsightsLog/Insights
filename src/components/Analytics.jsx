import React, { useState } from 'react'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { calculateMetrics, getMetricColor, getMetricLabel } from '../utils/tradingMetrics'

function Analytics({ trades }) {
  const [selectedMetric, setSelectedMetric] = useState('profit')
  const metrics = calculateMetrics(trades)

  if (!trades || trades.length === 0) {
    return <div>No trade data available</div>
  }

  // Calculate performance metrics for different categories
  const calculateCategoryMetrics = (category) => {
    return trades.reduce((acc, trade) => {
      const key = trade[category]
      if (!acc[key]) {
        acc[key] = {
          total: 0,
          wins: 0,
          losses: 0,
          profit: 0
        }
      }
      acc[key].profit += trade.profit
      if (trade.profit > 0) acc[key].wins++
      else acc[key].losses++
      acc[key].total++
      return acc
    }, {})
  }

  // Prepare data for charts
  const prepareChartData = (metrics) => {
    return Object.entries(metrics).map(([key, data]) => ({
      name: key,
      profit: data.profit,
      winRate: (data.wins / data.total) * 100
    }))
  }

  const sessionMetrics = calculateCategoryMetrics('session')
  const biasMetrics = calculateCategoryMetrics('market')
  const strategyMetrics = calculateCategoryMetrics('strategy')
  const setupMetrics = calculateCategoryMetrics('setup')

  const sessionData = prepareChartData(sessionMetrics)
  const biasData = prepareChartData(biasMetrics)
  const strategyData = prepareChartData(strategyMetrics)
  const setupData = prepareChartData(setupMetrics)

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#a4de6c']

  return (
    <div className="space-y-6">
      {/* Advanced Metrics Cards */}
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
        </div>
      </div>

      {/* Metric Toggle */}
      <div className="flex justify-end space-x-2">
        <button
          onClick={() => setSelectedMetric('profit')}
          className={`px-3 py-1 rounded ${
            selectedMetric === 'profit' 
              ? 'bg-indigo-600 text-white' 
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          Profit
        </button>
        <button
          onClick={() => setSelectedMetric('winRate')}
          className={`px-3 py-1 rounded ${
            selectedMetric === 'winRate' 
              ? 'bg-indigo-600 text-white' 
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          Win Rate
        </button>
      </div>

      {/* Performance Analysis */}
      <div className="grid grid-cols-2 gap-6">
        {/* Session Performance */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium mb-4">Session Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sessionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar 
                  dataKey={selectedMetric} 
                  fill="#8884d8"
                  name={selectedMetric === 'profit' ? 'Profit ($)' : 'Win Rate (%)'}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Market Bias Performance */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium mb-4">Market Bias Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={biasData}
                  dataKey={selectedMetric}
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value.toFixed(1)}${selectedMetric === 'profit' ? '$' : '%'}`}
                >
                  {biasData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Strategy and Setup Performance */}
      <div className="grid grid-cols-2 gap-6">
        {/* Strategy Performance */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium mb-4">Strategy Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={strategyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar 
                  dataKey={selectedMetric}
                  fill="#8884d8"
                  name={selectedMetric === 'profit' ? 'Profit ($)' : 'Win Rate (%)'}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Setup Performance */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium mb-4">Setup Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={setupData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar 
                  dataKey={selectedMetric}
                  fill="#8884d8"
                  name={selectedMetric === 'profit' ? 'Profit ($)' : 'Win Rate (%)'}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Equity Curve */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-medium mb-4">Equity Curve</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={trades.map((trade, index) => ({
                date: new Date(trade.date).toLocaleDateString(),
                profit: trades.slice(0, index + 1).reduce((sum, t) => sum + t.profit, 0)
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="profit" stroke="#8884d8" fill="#8884d8" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default Analytics
