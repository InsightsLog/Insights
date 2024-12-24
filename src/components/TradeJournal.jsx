import React, { useState } from 'react'
import { format } from 'date-fns'
import { FaStar } from 'react-icons/fa'

function TradeJournal({ trades }) {
  const [selectedTrade, setSelectedTrade] = useState(null)
  const [filter, setFilter] = useState('all')

  const filteredTrades = trades.filter(trade => {
    if (filter === 'winners') return trade.profit > 0
    if (filter === 'losers') return trade.profit < 0
    return true
  })

  const renderStars = (rating) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <FaStar
            key={star}
            className={star <= rating ? 'text-yellow-400' : 'text-gray-300'}
            size={16}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Trade Journal</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('winners')}
              className={`px-3 py-1 rounded ${filter === 'winners' ? 'bg-green-600 text-white' : 'bg-gray-100'}`}
            >
              Winners
            </button>
            <button
              onClick={() => setFilter('losers')}
              className={`px-3 py-1 rounded ${filter === 'losers' ? 'bg-red-600 text-white' : 'bg-gray-100'}`}
            >
              Losers
            </button>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-6 gap-4 p-4 bg-gray-50 text-sm font-medium text-gray-500">
        <div>Date/Time</div>
        <div>Symbol</div>
        <div>Setup</div>
        <div>Profit/Loss</div>
        <div>Rating</div>
        <div>Actions</div>
      </div>

      <div className="divide-y">
        {filteredTrades.map(trade => (
          <div key={trade.id} className="grid grid-cols-6 gap-4 p-4 hover:bg-gray-50">
            <div className="text-sm">
              {format(new Date(`${trade.date} ${trade.time}`), 'MMM d, yyyy HH:mm')}
            </div>
            <div className="font-medium">{trade.symbol}</div>
            <div className="text-sm">
              {trade.setup} - {trade.strategy}
            </div>
            <div className={`font-medium ${trade.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${trade.profit.toFixed(2)}
            </div>
            <div>
              {renderStars(trade.rating)}
            </div>
            <div>
              <button
                onClick={() => setSelectedTrade(trade)}
                className="text-indigo-600 hover:text-indigo-900"
              >
                Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedTrade && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full m-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold">Trade Details</h3>
                <div className="mt-1">
                  {renderStars(selectedTrade.rating)}
                </div>
              </div>
              <button
                onClick={() => setSelectedTrade(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                ✕
              </button>
            </div>
            
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Symbol</label>
                <p className="font-medium">{selectedTrade.symbol}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Session</label>
                <p className="font-medium">{selectedTrade.session}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Setup</label>
                <p className="font-medium">{selectedTrade.setup}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Strategy</label>
                <p className="font-medium">{selectedTrade.strategy}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Entry</label>
                <p className="font-medium">${selectedTrade.entry}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Exit</label>
                <p className="font-medium">${selectedTrade.exit}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Quantity</label>
                <p className="font-medium">{selectedTrade.quantity}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Profit/Loss</label>
                <p className={`font-medium ${selectedTrade.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${selectedTrade.profit.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-sm text-gray-500">Tags</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {selectedTrade.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label className="text-sm text-gray-500">Notes</label>
              <p className="mt-1 text-sm">{selectedTrade.notes}</p>
            </div>

            <div className="mt-4">
              <label className="text-sm text-gray-500">Lessons Learned</label>
              <p className="mt-1 text-sm">{selectedTrade.lessonsLearned}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TradeJournal
