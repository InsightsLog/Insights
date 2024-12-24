import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { FaChartLine, FaHistory, FaCog, FaSignOutAlt } from 'react-icons/fa'

function Navbar({ currentView, setCurrentView }) {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      console.error('Failed to log out:', error)
    }
  }

  return (
    <nav className="bg-gray-800 text-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <span className="text-xl font-bold">Insights</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                currentView === 'dashboard' 
                  ? 'bg-gray-900 text-white' 
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              <FaChartLine className="inline mr-2" />
              Dashboard
            </button>
            
            <button
              onClick={() => setCurrentView('history')}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                currentView === 'history' 
                  ? 'bg-gray-900 text-white' 
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              <FaHistory className="inline mr-2" />
              History
            </button>
            
            <button
              onClick={() => setCurrentView('settings')}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                currentView === 'settings' 
                  ? 'bg-gray-900 text-white' 
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              <FaCog className="inline mr-2" />
              Settings
            </button>

            <div className="border-l border-gray-700 h-6 mx-2"></div>

            <div className="text-sm text-gray-300">
              {currentUser?.email}
            </div>

            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700"
            >
              <FaSignOutAlt className="inline mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
