import React from 'react'
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import NotFound from './pages/NotFound.jsx'

function Protected({ children }) {
  const isAuthed = !!localStorage.getItem('token')
  const loc = useLocation()
  return isAuthed ? children : <Navigate to="/login" replace state={{ from: loc }} />
}

export default function App() {
  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h1>Procplus</h1>
      <p>Plataforma de procurement (MVP).</p>
      <nav style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <Link to="/">Home</Link>
        <Link to="/login">Login</Link>
        <Link to="/dashboard">Dashboard</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  )
}

