import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { getSession, onAuthStateChange, sendPasswordReset, signIn, signInWithGoogle, signOut, supabaseConfigured, updatePassword } from './lib/supabase.js'
import OrganizationPage from './OrganizationPage.jsx'
import ProcurementPage from './ProcurementPage.jsx'
import SuppliersPage from './SuppliersPage.jsx'
import ApprovalsPage from './ApprovalsPage.jsx'

// Production entrypoint: organization, procurement and supplier workspaces.
const tenders = [
  { ref: 'PP-2026-014', title: 'Aquisição de equipamentos informáticos', fund: 'União Europeia', value: '2.480.000 MZN', status: 'Em avaliação' },
  { ref: 'PP-2026-012', title: 'Serviços de transporte e logística', fund: 'Fundos próprios', value: '870.000 MZN', status: 'Publicado' },
  { ref: 'PP-2026-009', title: 'Material de formação', fund: 'Governo Americano', value: '425.000 MZN', status: 'Aprovado' },
]

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  useEffect(() => {
    getSession().then(session => {
      if (session) navigate('/set-password', { replace: true })
    }).catch(() => {})
  }, [navigate])
  const submit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try { await signIn(email, password); navigate('/app') }
    catch (err) { setError(err.message || 'Não foi possível iniciar a sessão.') }
    finally { setLoading(false) }
  }
  const reset = async () => {
    if (!email) return setError('Introduza primeiro o seu endereço de e-mail.')
    setError(''); setLoading(true)
    try {
      await sendPasswordReset(email)
      setResetSent(true)
    } catch (err) {
      setError(err.message || 'Não foi possível enviar o pedido.')
    } finally {
      setLoading(false)
    }
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
        <label>Palavra-passe<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required /></label>
        {error && <p className="note">{error}</p>}
        <button className="primary" disabled={loading}>{loading ? 'A verificar…' : 'Entrar na plataforma'}</button>
        <button type="button" className="text-button" onClick={reset} disabled={loading}>Esqueci a palavra-passe</button>
        <button type="button" className="google" onClick={() => signInWithGoogle().catch(e => setError(e.message))}>G&nbsp;&nbsp; Continuar com Google</button>
        {resetSent && <p className="success">Enviámos uma ligação segura para criar a sua palavra-passe.</p>}
        <p className="note">{supabaseConfigured ? 'Ligação segura activa.' : 'Modo de demonstração: configure o Supabase para activar contas reais.'}</p>
      </form>
    </section>
  </main>
}

function SetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(null)

  useEffect(() => {
    getSession().then(session => setSessionReady(Boolean(session))).catch(() => setSessionReady(false))
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (password.length < 8) return setError('A palavra-passe deve ter pelo menos 8 caracteres.')
    if (password !== confirmation) return setError('As palavras-passe não coincidem.')
    setError(''); setLoading(true)
    try {
      await updatePassword(password)
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err.message || 'Não foi possível criar a palavra-passe.')
    } finally {
      setLoading(false)
    }
  }

  if (sessionReady === null) return <main className="loading-page">A validar o convite…</main>
  if (!sessionReady) return <Navigate to="/login" replace />

  return <main className="login-page">
    <section className="brand-panel">
      <div className="logo light">P<span>+</span></div>
      <div>
        <p className="eyebrow">CONTA PROTEGIDA</p>
        <h1>Crie a sua palavra-passe.</h1>
        <p>Conclua a activação da conta para entrar no espaço seguro da sua organização.</p>
      </div>
      <small>Procplus Enterprise · Moçambique</small>
    </section>
    <section className="login-panel">
      <form onSubmit={submit}>
        <div className="logo mobile">P<span>+</span></div>
        <p className="eyebrow green">ÚLTIMO PASSO</p>
        <h2>Definir palavra-passe</h2>
        <p className="muted">Use pelo menos 8 caracteres.</p>
        <label>Nova palavra-passe<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required /></label>
        <label>Confirmar palavra-passe<input type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="new-password" required /></label>
        {error && <p className="note error">{error}</p>}
        <button className="primary" disabled={loading}>{loading ? 'A guardar…' : 'Criar palavra-passe'}</button>
      </form>
    </section>
  </main>
}

function Layout() {
  const navigate = useNavigate()
  const logout = async () => { await signOut(); navigate('/login') }
  return <div className="shell">
    <aside>
      <div className="logo light small">P<span>+</span><b>procplus</b></div>
      <nav>
        <NavLink end to="/app">◫ <span>Visão geral</span></NavLink>
        <NavLink to="/app/organizacao">◫ <span>Organização</span></NavLink>
        {['Concursos', 'Fornecedores', 'Contratos', 'Aprovações', 'Relatórios'].map(x =>
          <NavLink key={x} to={`/app/${x.toLowerCase()}`}>◫ <span>{x}</span></NavLink>
        )}
      </nav>
      <div className="org"><b>ADPP Moçambique</b><small>Plano Enterprise</small></div>
      <button className="logout" onClick={logout}>Terminar sessão</button>
    </aside>
    <section className="workspace">
      <header><div><small>QUINTA-FEIRA, 23 DE JULHO</small><h2>Bom dia, Fernando</h2></div><div className="avatar">FF</div></header>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="organizacao" element={<OrganizationPage />} />
        <Route path="concursos" element={<ProcurementPage />} />
        <Route path="fornecedores" element={<SuppliersPage />} />
        <Route path="aprovações" element={<ApprovalsPage />} />
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
function Protected() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    getSession().then(setSession).catch(() => setSession(null))
    return onAuthStateChange(setSession)
  }, [])
  if (session === undefined) return <main className="loading-page">A validar a sessão…</main>
  return session ? <Layout /> : <Navigate to="/login" replace />
}
export default function App() { return <Routes><Route path="/login" element={<Login />} /><Route path="/set-password" element={<SetPassword />} /><Route path="/app/*" element={<Protected />} /><Route path="*" element={<Navigate to="/app" replace />} /></Routes> }
