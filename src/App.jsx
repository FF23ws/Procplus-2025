import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import NotFound from './pages/NotFound.jsx'
import './styles.css'

function Protected({ children }) {
  const isAuthed = !!localStorage.getItem('token')
  const location = useLocation()
  return isAuthed ? children : <Navigate to="/login" replace state={{ from: location }} />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
