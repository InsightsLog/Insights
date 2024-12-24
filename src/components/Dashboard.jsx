import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { getUserTrades } from '../services/tradeService'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import Analytics from './Analytics'
import TradeHistory from './TradeHistory'

function Dashboard() {
  const [currentView, setCurrentView] = useState('dashboard')
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const loadTrades = async () => {
      try {
        const userTrades = await getUserTrades(currentUser.uid)
        setTrades(userTrades)
      } catch (error) {
        console.error('Error loading trades:', error)
      } finally {
        setLoading(false)
      }
    }

    if (currentUser) {
      loadTrades()
    }
  }, [currentUser])

  const handleAddTrade = async (newTrade) => {
    try {
      const addedTrade = await addTrade(currentUser.uid, newTrade)
      setTrades(prevTrades => [addedTrade, ...prevTrades])
    } catch (error) {
      console.error('Error adding trade:', error)
    }
  }

  if (loading) {
    return <div className="h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Navbar currentView={currentView} setCurrentView={setCurrentView} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onAddTrade={handleAddTrade} />
        <main className="flex-1 overflow-y-auto p-6">
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
                    ${(trades.filter(t => t.profit > 0).reduce((sum, t) => sum + t.profit, 0) / trades.filter(t => t.profit > 0).length || 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-gray-500 text-sm">Average Loss</h3>
                  <p className="text-2xl font-bold text-red-600">
                    ${Math.abs(trades.filter(t => t.profit < 0).reduce((sum, t) => sum + t.profit, 0) / trades.filter(t => t.profit < 0).length || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Analytics */}
              <Analytics trades={trades} />
            </div>
          )}
          
          {currentView === 'history' && (
            <TradeHistory trades={trades} />
          )}
          
          {currentView === 'settings' && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4">Settings</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Account Information</h3>
                  <p className="text-gray-600">Email: {currentUser?.email}</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default Dashboard
