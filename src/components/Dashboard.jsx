import React, { useState } from 'react'
import Analytics from './Analytics'
import TradeHistory from './TradeHistory'
import PsychologyInsights from './PsychologyInsights'

function Dashboard({ trades, setTrades, currentView }) {
  const [selectedTab, setSelectedTab] = useState('overview')

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      {currentView === 'dashboard' && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-gray-500 text-sm">Total Profit</h3>
              <p className={`text-2xl font-bold ${trades.reduce((sum, t) => sum + t.profit, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${trades.reduce((sum, t) => sum + t.profit, 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-gray-500 text-sm">Win Rate</h3>
              <p className="text-2xl font-bold">
                {((trades.filter(t => t.profit > 0).length / trades.length) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-gray-500 text-sm">Average Win</h3>
              <p className="text-2xl font-bold text-green-600">
                ${(trades.filter(t => t.profit > 0).reduce((sum, t) => sum + t.profit, 0) / trades.filter(t => t.profit > 0).length).toFixed(2)}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-gray-500 text-sm">Average Loss</h3>
              <p className="text-2xl font-bold text-red-600">
                ${Math.abs(trades.filter(t => t.profit < 0).reduce((sum, t) => sum + t.profit, 0) / trades.filter(t => t.profit < 0).length).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', name: 'Overview' },
                { id: 'insights', name: 'Trading Insights' },
                { id: 'history', name: 'History' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={`
                    py-2 px-1 border-b-2 font-medium text-sm
                    ${selectedTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                  `}
                >
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {selectedTab === 'overview' && <Analytics trades={trades} />}
            {selectedTab === 'insights' && <PsychologyInsights trades={trades} />}
            {selectedTab === 'history' && <TradeHistory trades={trades} />}
          </div>
        </div>
      )}
      
      {currentView === 'settings' && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Settings</h2>
          <p className="text-gray-600">Settings panel coming soon...</p>
        </div>
      )}
    </div>
  )
}

export default Dashboard
