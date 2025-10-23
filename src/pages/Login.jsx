import { useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const navigate = useNavigate()
  const loc = useLocation()
  const from = loc.state?.from?.pathname || '/dashboard'

  function handleSubmit(e) {
    e.preventDefault()
    // validação mínima
    if (!email || !pass) return alert('Preencha email e palavra-passe.')
    // fake auth: guarde um token simples
    localStorage.setItem('token', 'demo-token')
    navigate(from, { replace: true })
  }

  return (
    <section>
      <h2>Login</h2>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
        <label>
          Email
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
        </label>
        <label>
          Palavra-passe
          <input type="password" value={pass} onChange={e => setPass(e.target.value)} />
        </label>
        <button type="submit">Entrar</button>
      </form>
    </section>
  )
}
