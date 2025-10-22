import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'

function Home() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Procplus</h1>
      <p>Plataforma de procurement (MVP).</p>
      <nav style={{ display: 'flex', gap: 12 }}>
        <Link to="/">Home</Link>
        <Link to="/login">Login</Link>
        <Link to="/dashboard">Dashboard</Link>
      </nav>
    </div>
  )
}

function Login() {
  return <h2 style={{ padding: 24 }}>Login (breve)</h2>
}

function Dashboard() {
  return <h2 style={{ padding: 24 }}>Dashboard (rota protegida em breve)</h2>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  )
}