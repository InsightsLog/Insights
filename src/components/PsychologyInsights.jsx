import React from 'react'
import { analyzePsychology, analyzePatterns, generateInsights } from '../utils/patternAnalysis'

function PsychologyInsights({ trades }) {
  const insights = generateInsights(trades)
  const psychology = analyzePsychology(trades)
  const patterns = analyzePatterns(trades)

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Trading Insights</h2>
      
      {/* Key Insights */}
      <div className="space-y-4 mb-6">
        {insights.map((insight, index) => (
          <div 
            key={index}
            className={`p-4 rounded-lg ${
              insight.type === 'success' ? 'bg-green-50 border-green-500' :
              insight.type === 'warning' ? 'bg-yellow-50 border-yellow-500' :
              'bg-red-50 border-red-500'
            } border-l-4`}
          >
            <h3 className="font-medium">{insight.title}</h3>
            <p className="text-sm text-gray-600">{insight.message}</p>
          </div>
        ))}
      </div>

      {/* Psychological Patterns */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-2">Behavioral Patterns</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span>Revenge Trades:</span>
              <span className="font-medium">{psychology.revengeTrades.length}</span>
            </li>
            <li className="flex justify-between">
              <span>FOMO Trades:</span>
              <span className="font-medium">{psychology.fomoTrades.length}</span>
            </li>
            <li className="flex justify-between">
              <span>Emotional Trades:</span>
              <span className="font-medium">{psychology.emotionalTrades.length}</span>
            </li>
          </ul>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-2">Risk Management</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span>Size Issues:</span>
              <span className="font-medium">{psychology.sizeIssues.length}</span>
            </li>
            <li className="flex justify-between">
              <span>Overtrading Instances:</span>
              <span className="font-medium">{psychology.overtrading.length}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Trading Rules Based on Analysis */}
      <div className="border-t pt-4">
        <h3 className="font-medium mb-3">Suggested Trading Rules</h3>
        <ul className="space-y-2 text-sm">
          {patterns.consecutivePatterns.consecutiveLosses > 2 && (
            <li className="flex items-center text-red-600">
              <span className="w-2 h-2 bg-red-600 rounded-full mr-2" />
              Take a break after 2 consecutive losses
            </li>
          )}
          {psychology.overtrading.length > 0 && (
            <li className="flex items-center text-yellow-600">
              <span className="w-2 h-2 bg-yellow-600 rounded-full mr-2" />
              Limit to 3 trades per hour maximum
            </li>
          )}
          {psychology.sizeIssues.length > 0 && (
            <li className="flex items-center text-orange-600">
              <span className="w-2 h-2 bg-orange-600 rounded-full mr-2" />
              Maintain consistent position sizing
            </li>
          )}
          {patterns.bestHour && (
            <li className="flex items-center text-green-600">
              <span className="w-2 h-2 bg-green-600 rounded-full mr-2" />
              Focus trading during your best hour: {patterns.bestHour[0]}:00
            </li>
          )}
        </ul>
      </div>

      {/* Pattern Recognition */}
      <div className="border-t mt-4 pt-4">
        <h3 className="font-medium mb-3">Recognized Patterns</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 rounded">
            <h4 className="text-sm font-medium">Best Performance</h4>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Time: {patterns.bestHour[0]}:00</li>
              <li>Market: {
                Object.entries(patterns.marketPatterns)
                  .sort((a, b) => b[1].profit - a[1].profit)[0][0]
              }</li>
            </ul>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <h4 className="text-sm font-medium">Areas to Avoid</h4>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Time: {patterns.worstHour[0]}:00</li>
              <li>Consecutive Losses: {patterns.consecutivePatterns.consecutiveLosses}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PsychologyInsights
