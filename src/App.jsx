import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import PrivateRoute from './components/auth/PrivateRoute'
import Login from './components/auth/Login'
import Signup from './components/auth/Signup'
import ForgotPassword from './components/auth/ForgotPassword'
import Dashboard from './components/Dashboard'
import { mockTrades } from './data/mockData'

function App() {
  const [trades, setTrades] = useState(mockTrades)

  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Protected Routes */}
          <Route path="/" element={
            <PrivateRoute>
              <Dashboard trades={trades} setTrades={setTrades} />
            </PrivateRoute>
          } />

          {/* Redirect any unknown routes to home */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
