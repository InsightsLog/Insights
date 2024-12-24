import React from 'react'
import { format } from 'date-fns'
import { FaTimes, FaStar } from 'react-icons/fa'

function TradeDetailsModal({ trade, onClose }) {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {trade.symbol} - {trade.type.toUpperCase()}
            </h3>
            <p className="text-sm text-gray-500">
              {format(new Date(`${trade.date} ${trade.time}`), 'PPpp')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <FaTimes size={24} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          {/* Trade Details */}
          <div className="col-span-2 bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Trade Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Entry Price</p>
                <p className="font-medium">${trade.entry}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Exit Price</p>
                <p className="font-medium">${trade.exit}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Quantity</p>
                <p className="font-medium">{trade.quantity}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Profit/Loss</p>
                <p className={`font-medium ${trade.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${trade.profit.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Strategy & Setup */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Strategy & Setup</h4>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-500">Strategy</p>
                <p className="font-medium">{trade.strategy}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Setup</p>
                <p className="font-medium">{trade.setup}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Market Bias</p>
                <p className="font-medium">{trade.market}</p>
              </div>
            </div>
          </div>

          {/* Session & Rating */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Session & Rating</h4>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-500">Session</p>
                <p className="font-medium">{trade.session}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Rating</p>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <FaStar
                      key={star}
                      className={star <= trade.rating ? 'text-yellow-400' : 'text-gray-300'}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="col-span-2 bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Notes</h4>
            <p className="text-sm text-gray-700">{trade.notes}</p>
          </div>

          {/* Lessons Learned */}
          <div className="col-span-2 bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Lessons Learned</h4>
            <p className="text-sm text-gray-700">{trade.lessonsLearned}</p>
          </div>

          {/* Tags */}
          {trade.tags && trade.tags.length > 0 && (
            <div className="col-span-2 bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {trade.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TradeDetailsModal
