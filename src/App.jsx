import React from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
} from 'react-router-dom'

// páginas simples (placeholder)
function Home() {
  return (
    <section style={{ padding: 24 }}>
      <h1>Procplus</h1>
      <p>Plataforma de procurement (MVP).</p>
      <nav style={{ display: 'flex', gap: 12 }}>
        <Link to="/">Home</Link>
        <Link to="/login">Login</Link>
        <Link to="/dashboard">Dashboard</Link>
      </nav>
    </section>
  )
}

function Login() {
  return (
    <section style={{ padding: 24 }}>
      <h2>Login</h2>
      <p>(colocar formulário real depois)</p>
      <Link to="/">Voltar</Link>
    </section>
  )
}

function Dashboard() {
  return (
    <section style={{ padding: 24 }}>
      <h2>Dashboard</h2>
      <p>(widgets / métricas aqui)</p>
      <Link to="/">Voltar</Link>
    </section>
  )
}

function NotFound() {
  return (
    <section style={{ padding: 24 }}>
      <h2>404</h2>
      <p>Página não encontrada.</p>
      <Link to="/">Ir para Home</Link>
    </section>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route index element={<Home />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
