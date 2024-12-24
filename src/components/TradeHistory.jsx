import React, { useState } from 'react'
import { format } from 'date-fns'
import TradeDetailsModal from './modals/TradeDetailsModal'

function TradeHistory({ trades }) {
  const [selectedTrade, setSelectedTrade] = useState(null)

  return (
    <div className="bg-white rounded-lg shadow">
      {/* ... rest of the component ... */}
      
      {selectedTrade && (
        <TradeDetailsModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
        />
      )}
    </div>
  )
}

export default TradeHistory
