import { useState } from 'react'
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'

const tenders = [
  { ref: 'PP-2026-014', title: 'Aquisição de equipamentos informáticos', fund: 'União Europeia', value: '2.480.000 MZN', status: 'Em avaliação' },
  { ref: 'PP-2026-012', title: 'Serviços de transporte e logística', fund: 'Fundos próprios', value: '870.000 MZN', status: 'Publicado' },
  { ref: 'PP-2026-009', title: 'Material de formação', fund: 'Governo Americano', value: '425.000 MZN', status: 'Aprovado' },
]

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const submit = (e) => {
    e.preventDefault()
    if (!email) return
    localStorage.setItem('procplus_session', email)
    navigate('/app')
  }
  return <main className="login-page">
    <section className="brand-panel">
      <div className="logo light">P<span>+</span></div>
      <div>
        <p className="eyebrow">PROCUREMENT INTELIGENTE</p>
        <h1>Transparência em cada decisão.</h1>
        <p>Planeie, compre, avalie e reporte num só lugar — com as regras de cada financiador incorporadas no processo.</p>
      </div>
      <small>Procplus Enterprise · Moçambique</small>
    </section>
    <section className="login-panel">
      <form onSubmit={submit}>
        <div className="logo mobile">P<span>+</span></div>
        <p className="eyebrow green">BEM-VINDO</p>
        <h2>Iniciar sessão</h2>
        <p className="muted">Aceda ao espaço seguro da sua organização.</p>
        <label>E-mail profissional<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@organizacao.org" required /></label>
        <label>Palavra-passe<input type="password" placeholder="••••••••" required /></label>
        <button className="primary">Entrar na plataforma</button>
        <button type="button" className="google">G&nbsp;&nbsp; Continuar com Google</button>
        <p className="note">A autenticação definitiva será ligada ao Supabase na próxima etapa.</p>
      </form>
    </section>
  </main>
}

function Layout() {
  const navigate = useNavigate()
  const logout = () => { localStorage.removeItem('procplus_session'); navigate('/login') }
  return <div className="shell">
    <aside>
      <div className="logo light small">P<span>+</span><b>procplus</b></div>
      <nav>
        {['Visão geral', 'Concursos', 'Fornecedores', 'Contratos', 'Aprovações', 'Relatórios'].map((x, i) =>
          <NavLink key={x} to={i ? `/app/${x.toLowerCase()}` : '/app'}>◫ <span>{x}</span>{x === 'Aprovações' && <em>4</em>}</NavLink>
        )}
      </nav>
      <div className="org"><b>ADPP Moçambique</b><small>Plano Enterprise</small></div>
      <button className="logout" onClick={logout}>Terminar sessão</button>
    </aside>
    <section className="workspace">
      <header><div><small>QUINTA-FEIRA, 23 DE JULHO</small><h2>Bom dia, Fernando</h2></div><div className="avatar">FF</div></header>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="*" element={<ComingSoon />} />
      </Routes>
    </section>
  </div>
}

function Dashboard() {
  return <main className="dashboard">
    <div className="headline"><div><h1>Visão geral</h1><p>Acompanhe os processos e as decisões que precisam da sua atenção.</p></div><button className="primary compact">+ Novo processo</button></div>
    <section className="metrics">
      <article><small>PROCESSOS ACTIVOS</small><strong>18</strong><span className="up">↑ 3 este mês</span></article>
      <article><small>AGUARDAM APROVAÇÃO</small><strong>4</strong><span className="warn">Acção necessária</span></article>
      <article><small>VALOR EM PROCESSO</small><strong>12,8M</strong><span>MZN</span></article>
      <article><small>CONFORMIDADE</small><strong>96%</strong><span className="up">Dentro das regras</span></article>
    </section>
    <section className="grid">
      <article className="card wide"><div className="card-title"><div><h3>Processos recentes</h3><p>Últimas actividades da organização</p></div><button>Ver todos</button></div>
        <div className="table">{tenders.map(t => <div className="row" key={t.ref}><div><b>{t.title}</b><small>{t.ref} · {t.fund}</small></div><strong>{t.value}</strong><span className={`pill ${t.status === 'Aprovado' ? 'approved' : ''}`}>{t.status}</span></div>)}</div>
      </article>
      <article className="card"><div className="card-title"><div><h3>Conformidade</h3><p>Estado por origem dos fundos</p></div></div>
        {['União Europeia', 'Fundos próprios', 'Governo Americano', 'Governo de Moçambique'].map((x, i) => <div className="compliance" key={x}><span>{x}</span><b>{[98, 96, 94, 100][i]}%</b><i><u style={{width:`${[98,96,94,100][i]}%`}} /></i></div>)}
      </article>
    </section>
  </main>
}

function ComingSoon() { return <main className="dashboard"><div className="empty"><h2>Módulo em preparação</h2><p>Esta área será activada nos próximos incrementos da versão Enterprise.</p></div></main> }
function Protected() { return localStorage.getItem('procplus_session') ? <Layout /> : <Navigate to="/login" replace /> }
export default function App() { return <Routes><Route path="/login" element={<Login />} /><Route path="/app/*" element={<Protected />} /><Route path="*" element={<Navigate to="/app" replace />} /></Routes> }
