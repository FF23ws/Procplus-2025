import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section>
      <h2>404 — Página não encontrada</h2>
      <p><Link to="/">Voltar ao início</Link></p>
    </section>
  )
}
