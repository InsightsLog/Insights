import React from 'react'
import TradeForm from './TradeForm'

function Sidebar({ trades, onAddTrade }) {
  return (
    <div className="w-96 bg-gray-50 border-r p-4 overflow-y-auto">
      <TradeForm onSubmit={onAddTrade} />
    </div>
  )
}

export default Sidebar
