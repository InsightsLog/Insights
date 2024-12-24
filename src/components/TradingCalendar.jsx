import React from 'react'

function TradingCalendar({ trades }) {
  const today = new Date()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  
  // Get days in current month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  
  // Create calendar data
  const calendarData = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(currentYear, currentMonth, i + 1)
    const dayTrades = trades.filter(t => new Date(t.date).toDateString() === date.toDateString())
    
    return {
      date,
      trades: dayTrades,
      profit: dayTrades.reduce((sum, t) => sum + t.profit, 0),
      numTrades: dayTrades.length
    }
  })

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Trading Calendar</h2>
      
      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
        
        {/* Offset for first day of month */}
        {Array.from({ length: new Date(currentYear, currentMonth, 1).getDay() }).map((_, i) => (
          <div key={`empty-${i}`} className="h-24" />
        ))}
        
        {calendarData.map(({ date, profit, numTrades }) => (
          <div
            key={date.toISOString()}
            className={`h-24 p-2 border rounded ${
              profit > 0 ? 'bg-green-50' : profit < 0 ? 'bg-red-50' : 'bg-gray-50'
            }`}
          >
            <div className="text-sm font-medium">{date.getDate()}</div>
            {numTrades > 0 && (
              <>
                <div className={`text-sm ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${profit.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">
                  {numTrades} trade{numTrades !== 1 ? 's' : ''}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default TradingCalendar
