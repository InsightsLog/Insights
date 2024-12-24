import React, { useState } from 'react'
import { FaTimes, FaStar } from 'react-icons/fa'

function TradeForm({ onSubmit }) {
  const [trade, setTrade] = useState({
    symbol: '',
    type: 'buy',
    entry: '',
    exit: '',
    quantity: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0],
    setup: 'scalp',
    timeframe: '5m',
    confidence: 3,
    notes: '',
    tags: [],
    market: 'bullish',
    session: 'ny',
    strategy: 'rejection',
    rating: 3,
    lessonsLearned: ''
  })

  const [newTag, setNewTag] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const profit = (trade.type === 'buy' ? 
      (parseFloat(trade.exit) - parseFloat(trade.entry)) : 
      (parseFloat(trade.entry) - parseFloat(trade.exit))) * parseFloat(trade.quantity)
    
    onSubmit({ ...trade, profit })
    
    // Reset form
    setTrade({
      symbol: '',
      type: 'buy',
      entry: '',
      exit: '',
      quantity: '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0],
      setup: 'scalp',
      timeframe: '5m',
      confidence: 3,
      notes: '',
      tags: [],
      market: 'bullish',
      session: 'ny',
      strategy: 'rejection',
      rating: 3,
      lessonsLearned: ''
    })
    setNewTag('')
  }

  const addTag = (e) => {
    e.preventDefault()
    if (newTag.trim() && !trade.tags.includes(newTag.trim())) {
      setTrade({ ...trade, tags: [...trade.tags, newTag.trim()] })
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove) => {
    setTrade({ ...trade, tags: trade.tags.filter(tag => tag !== tagToRemove) })
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Log Trade</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Trade Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Symbol</label>
            <input
              type="text"
              value={trade.symbol}
              onChange={e => setTrade({ ...trade, symbol: e.target.value.toUpperCase() })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select
              value={trade.type}
              onChange={e => setTrade({ ...trade, type: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="buy">Buy/Long</option>
              <option value="sell">Sell/Short</option>
            </select>
          </div>
        </div>

        {/* Price and Quantity */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Entry Price</label>
            <input
              type="number"
              step="0.01"
              value={trade.entry}
              onChange={e => setTrade({ ...trade, entry: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Exit Price</label>
            <input
              type="number"
              step="0.01"
              value={trade.exit}
              onChange={e => setTrade({ ...trade, exit: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Quantity</label>
            <input
              type="number"
              value={trade.quantity}
              onChange={e => setTrade({ ...trade, quantity: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
            />
          </div>
        </div>

        {/* Strategy and Setup */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Strategy</label>
            <select
              value={trade.strategy}
              onChange={e => setTrade({ ...trade, strategy: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="rejection">Rejection</option>
              <option value="continuation">Continuation</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Setup</label>
            <select
              value={trade.setup}
              onChange={e => setTrade({ ...trade, setup: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="scalp">Scalp</option>
              <option value="intraday">Intraday</option>
              <option value="swing">Swing</option>
            </select>
          </div>
        </div>

        {/* Session and Market */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Session</label>
            <select
              value={trade.session}
              onChange={e => setTrade({ ...trade, session: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="tokyo">Tokyo</option>
              <option value="eu-brinks">EU Brinks</option>
              <option value="london">London</option>
              <option value="us-brinks">US Brinks</option>
              <option value="ny">New York</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Market Bias</label>
            <select
              value={trade.market}
              onChange={e => setTrade({ ...trade, market: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="bullish">Bullish</option>
              <option value="bearish">Bearish</option>
              <option value="neutral">Neutral</option>
              <option value="choppy">Choppy</option>
            </select>
          </div>
        </div>

        {/* Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Trade Rating</label>
          <div className="flex space-x-2 mt-1">
            {[1, 2, 3, 4, 5].map(rating => (
              <button
                key={rating}
                type="button"
                onClick={() => setTrade({ ...trade, rating })}
                className={`flex-1 py-2 rounded flex items-center justify-center ${
                  trade.rating === rating 
                    ? 'bg-yellow-400 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <FaStar className={trade.rating >= rating ? 'text-yellow-500' : 'text-gray-400'} />
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            value={trade.notes}
            onChange={e => setTrade({ ...trade, notes: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            rows="3"
            placeholder="What worked? What didn't? Key observations..."
          />
        </div>

        {/* Lessons Learned */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Lessons Learned</label>
          <textarea
            value={trade.lessonsLearned}
            onChange={e => setTrade({ ...trade, lessonsLearned: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            rows="3"
            placeholder="What lessons did you learn from this trade? What would you do differently next time?"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Tags</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {trade.tags.map(tag => (
              <span 
                key={tag} 
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-1 inline-flex items-center p-0.5 hover:bg-indigo-200 rounded-full"
                >
                  <FaTimes />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-1 flex">
            <input
              type="text"
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              placeholder="Add a tag..."
              className="flex-1 rounded-l-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={addTag}
              className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-700 hover:bg-gray-100"
            >
              Add
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700"
        >
          Log Trade
        </button>
      </form>
    </div>
  )
}

export default TradeForm
