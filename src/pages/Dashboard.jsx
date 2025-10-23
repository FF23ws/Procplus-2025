import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const navigate = useNavigate()
  function logout() {
    localStorage.removeItem('token')
    navigate('/login', { replace: true })
  }
  return (
    <section>
      <h2>Dashboard</h2>
      <p>Área autenticada.</p>
      <button onClick={logout}>Sair</button>
    </section>
  )
}
